#!/usr/bin/env tsx
/**
 * Henter alle Feel24-lokasjoner fra Sanity API og inserter i DB.
 *
 * Usage:
 *   npx tsx scripts/fetch-feel24.ts --dry-run
 *   npx tsx scripts/fetch-feel24.ts
 */
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

loadEnvConfig(process.cwd());

const DRY_RUN = process.argv.includes('--dry-run');
const WEBSITE = 'https://feel24.no';
const SANITY_PROJECT = '3rghyqle';
const SANITY_DATASET = 'production';
const SANITY_API_VERSION = '2021-06-07';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Maps Feel24 feature slugs → our service types (multiple allowed)
const FEATURE_TYPE_MAP: Record<string, string[]> = {
  'personlig-trener':    ['pt'],
  'treningsprogram':     ['pt'],
  'treningsveileder':    ['pt'],
  'gruppetimer':         ['gruppe'],
  'spinning':            ['gruppe'],
  'kostholdsveiledning': ['ernæring'],
  'nutrition':           ['ernæring'],
  'kroppsanalyse':       ['helse'],
  'fysioterapeut':       ['rehab'],
  'kiropraktor':         ['rehab'],
  'fotterapeut':         ['helse'],
  'solarium':            ['helse'],
};

interface SanityGym {
  name: string;
  slug: string;
  address: string | null;
  email: string | null;
  facebook: string | null;
  instagram: string | null;
  position: { lat: number; lng: number } | null;
  place: { name: string; slug: string } | null;
  features: { title: string; slug: string }[];
}

async function fetchAllGyms(): Promise<SanityGym[]> {
  const query = `*[_type=="gym"]{
    name,
    "slug": slug,
    address,
    email,
    position,
    facebook,
    instagram,
    "place": place->{name, "slug": slug.current},
    "features": features[]->{"title": title[_key=="no"][0].value, "slug": slug.current}
  }`;

  const encoded = encodeURIComponent(query);
  const url = `https://${SANITY_PROJECT}.api.sanity.io/v${SANITY_API_VERSION}/data/query/${SANITY_DATASET}?query=${encoded}`;

  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Sanity API feil: ${res.status}`);
  const data = await res.json() as { result: SanityGym[] };
  return data.result;
}

function makeId(slug: string): string {
  return 'feel24_' + slug
    .toLowerCase()
    .replace(/[æ]/g, 'ae').replace(/[ø]/g, 'o').replace(/[å]/g, 'a')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60);
}

function gymUrl(slug: string): string {
  return `${WEBSITE}/treningssentre/treningssenter-${slug}/${slug}`;
}

async function main() {
  console.log(`\nfetch-feel24${DRY_RUN ? '  DRY RUN' : ''}\n`);

  console.log('Henter lokasjoner fra Sanity API...');
  const gyms = await fetchAllGyms();
  console.log(`Fant ${gyms.length} Feel24-lokasjoner\n`);

  // Save JSONL
  const outPath = path.join(process.cwd(), 'data', 'feel24-gyms.jsonl');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, gyms.map((g) => JSON.stringify(g)).join('\n'));
  console.log(`Lagret → ${outPath}\n`);

  if (DRY_RUN) {
    for (const g of gyms) {
      const id = makeId(g.slug);
      const city = g.place?.slug ?? null;
      const hasCoords = !!g.position;
      const featureSlugs = g.features?.map((f) => f.slug) ?? [];
      const extraTypes = [...new Set(featureSlugs.flatMap((s) => FEATURE_TYPE_MAP[s] ?? []))];
      console.log(`  [dry] ${id.padEnd(35)} ${city ?? '?'.padEnd(20)} ${hasCoords ? '📍' : '  '} ${g.address ?? ''}`);
      if (extraTypes.length) console.log(`        service_types: styrke, kondisjon, ${extraTypes.join(', ')}`);
    }
    console.log('\n[dry-run] Ingen endringer skrevet.\n');
    return;
  }

  let inserted = 0, updated = 0, failed = 0;

  for (const gym of gyms) {
    const id = makeId(gym.slug);
    process.stdout.write(`  ${gym.name.padEnd(35)} `);

    const city = gym.place?.slug?.toLowerCase() ?? null;
    const lat = gym.position?.lat ?? null;
    const lng = gym.position?.lng ?? null;
    const pointWkt = lat && lng ? `SRID=4326;POINT(${lng} ${lat})` : null;

    const featureSlugs = gym.features?.map((f) => f.slug) ?? [];
    const extraTypes = [...new Set(featureSlugs.flatMap((s) => FEATURE_TYPE_MAP[s] ?? []))];
    const allTypes = ['styrke', 'kondisjon', ...extraTypes];

    // Upsert service
    const { error: svcErr } = await supabase.from('services').upsert({
      id,
      name: gym.name,
      address: gym.address,
      type: 'styrke',
      main_category: 'trene-selv',
      description: 'Feel24 – treningssenter åpent 24/7',
      price_level: 'low',
      venues: ['gym'],
      goals: ['strength', 'weight_loss', 'kondisjon'],
      tags: ['treningssenter', 'styrketrening', 'kondisjon', 'feel24', '24timer'],
      is_active: true,
      website: WEBSITE,
      ...(pointWkt ? { base_location: pointWkt } : {}),
    }, { onConflict: 'id' });

    if (svcErr) {
      console.log(`❌ service: ${svcErr.message}`);
      failed++;
      continue;
    }

    // Coverage — check-then-insert (no unique constraint)
    if (city) {
      const { data: existingCov } = await supabase
        .from('service_coverage')
        .select('id')
        .eq('service_id', id)
        .eq('type', 'city')
        .eq('city', city)
        .maybeSingle();

      if (!existingCov) {
        const { error: covErr } = await supabase.from('service_coverage').insert({
          service_id: id,
          type: 'city',
          city,
        });
        if (covErr) console.log(`  ⚠️  coverage: ${covErr.message}`);
      }
    }

    // service_types
    await supabase.from('service_types').upsert(
      allTypes.map((t) => ({ service_id: id, type: t })),
      { onConflict: 'service_id,type' }
    );

    const isNew = !!(svcErr === null);
    console.log(`✅ ${id}`);
    inserted++;
  }

  console.log(`\nFerdig.  Behandlet: ${inserted}  Feilet: ${failed}\n`);
}

main().catch(console.error);
