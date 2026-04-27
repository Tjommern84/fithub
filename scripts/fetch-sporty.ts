#!/usr/bin/env tsx
/**
 * Henter alle Sporty-lokasjoner fra sporty.no/__NEXT_DATA__ og inserter i DB.
 *
 * Usage:
 *   npx tsx scripts/fetch-sporty.ts --dry-run
 *   npx tsx scripts/fetch-sporty.ts
 */
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';

loadEnvConfig(process.cwd());

const DRY_RUN = process.argv.includes('--dry-run');
const WEBSITE_BASE = 'https://sporty.no/treningssenter';
const LIST_URL = 'https://sporty.no/treningssenter';
const USER_AGENT = 'FitHub/1.0 (tjommern@gmail.com)';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

interface SporgyGym {
  brp_id: string;
  cms_slug: string;
  name: string;
  region: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

async function fetchAllGyms(): Promise<SporgyGym[]> {
  const res = await fetch(LIST_URL, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fra sporty.no`);
  const html = await res.text();

  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error('__NEXT_DATA__ ikke funnet i HTML');

  const nextData = JSON.parse(match[1]) as {
    props: { pageProps: { response: { data: SporgyGym[] } } };
  };

  return nextData.props.pageProps.response.data;
}

async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=no&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'no' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const results = await res.json() as Array<{ lat: string; lon: string }>;
    return results.length ? { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) } : null;
  } catch {
    return null;
  }
}

function makeId(cms_slug: string): string {
  return 'sporty_' + cms_slug
    .toLowerCase()
    .replace(/[æ]/g, 'ae').replace(/[ø]/g, 'o').replace(/[å]/g, 'a')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 55);
}

function extractCity(address: string | null): string | null {
  if (!address) return null;
  const m = address.match(/\d{4}\s+([^,\n]+)/);
  return m ? m[1].trim().toLowerCase() : null;
}

async function main() {
  console.log(`\nfetch-sporty${DRY_RUN ? '  DRY RUN' : ''}\n`);

  console.log('Henter lokasjoner fra sporty.no...');
  const gyms = await fetchAllGyms();
  console.log(`Fant ${gyms.length} Sporty-lokasjoner\n`);

  if (DRY_RUN) {
    for (const g of gyms) {
      const id = makeId(g.cms_slug);
      const city = extractCity(g.address);
      console.log(`  [dry] ${id.padEnd(40)} ${(city ?? '?').padEnd(20)} ${g.address ?? ''}`);
    }
    console.log('\n[dry-run] Ingen endringer skrevet.\n');
    return;
  }

  let ok = 0, failed = 0;
  let lastGeocode = 0;

  for (const gym of gyms) {
    const id = makeId(gym.cms_slug);
    process.stdout.write(`  ${gym.name.padEnd(40)} `);

    const city = extractCity(gym.address);

    // Rate-limit Nominatim to 1 req/sec
    let coords: { lat: number; lon: number } | null = null;
    if (gym.address) {
      const now = Date.now();
      const wait = 1100 - (now - lastGeocode);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      coords = await geocodeAddress(gym.address);
      lastGeocode = Date.now();
    }

    const pointWkt = coords ? `SRID=4326;POINT(${coords.lon} ${coords.lat})` : null;

    const { error: svcErr } = await supabase.from('services').upsert({
      id,
      name: gym.name,
      address: gym.address,
      phone: gym.phone,
      type: 'styrke',
      main_category: 'trene-selv',
      description: 'Sporty treningssenter',
      price_level: 'medium',
      venues: ['gym'],
      goals: ['strength', 'weight_loss', 'endurance', 'start'],
      tags: ['treningssenter', 'styrketrening', 'kondisjon', 'sporty'],
      is_active: true,
      website: `${WEBSITE_BASE}/${gym.cms_slug}`,
      ...(pointWkt ? { base_location: pointWkt } : {}),
    }, { onConflict: 'id' });

    if (svcErr) {
      console.log(`❌ service: ${svcErr.message}`);
      failed++;
      continue;
    }

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

    await supabase.from('service_types').upsert(
      ['styrke', 'kondisjon'].map((t) => ({ service_id: id, type: t })),
      { onConflict: 'service_id,type' }
    );

    console.log(`✅ ${id} ${coords ? '📍' : '  '} ${city ?? '?'}`);
    ok++;
  }

  console.log(`\nFerdig.  OK: ${ok}  Feilet: ${failed}\n`);
}

main().catch(console.error);
