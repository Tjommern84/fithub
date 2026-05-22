#!/usr/bin/env tsx
/**
 * Legger til de 22 manglende EVO-lokasjonene i databasen.
 * Geokoder adresser via Nominatim og inserter services + coverage + service_types.
 *
 * Usage:
 *   npx tsx scripts/push-evo-missing.ts --dry-run
 *   npx tsx scripts/push-evo-missing.ts
 */
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';

loadEnvConfig(process.cwd());

const DRY_RUN = process.argv.includes('--dry-run');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const MISSING: { name: string; address: string; city: string }[] = [
  { name: 'EVO Nannestad',     address: 'Teiealleen 5, 2030 Nannestad',          city: 'nannestad' },
  { name: 'EVO Sandvika',      address: 'Leif Tronstads plass 7, Sandvika',       city: 'bærum' },
  { name: 'EVO SNØ Lørenskog', address: 'Snøfonna 1, 1470 Lørenskog',             city: 'lørenskog' },
  { name: 'EVO Bøler',         address: 'Utmarkveien 1, 0689 Oslo',               city: 'oslo' },
  { name: 'EVO Grorud',        address: 'Rosenbergveien 15, 0963 Oslo',           city: 'oslo' },
  { name: 'EVO Holmlia',       address: 'Holmlia Senter vei 18, Oslo',            city: 'oslo' },
  { name: 'EVO Løren',         address: 'Lørenveien 37, 0585 Oslo',               city: 'oslo' },
  { name: 'EVO Nordberg',      address: 'Langmyrgrenda 1, 0861 Oslo',             city: 'oslo' },
  { name: 'EVO Teisen',        address: 'Ole Deviks vei 6, 0666 Oslo',            city: 'oslo' },
  { name: 'EVO Vålerenga',     address: 'Østerdalsgata 7, 0658 Oslo',             city: 'oslo' },
  { name: 'EVO Vollebekk',     address: 'Brobekkveien 53, Oslo',                  city: 'oslo' },
  { name: 'EVO Gressvik',      address: 'Storveien 81, 1621 Gressvik',            city: 'fredrikstad' },
  { name: 'EVO Østfoldhallen', address: 'Dikeveien 28, 1661 Rolvsøy',             city: 'fredrikstad' },
  { name: 'EVO Bryne Torg',    address: 'Meierigata 3, Bryne',                    city: 'bryne' },
  { name: 'EVO Kannik',        address: 'Engelsminnegata 16, 4008 Stavanger',     city: 'stavanger' },
  { name: 'EVO Sola',          address: 'Vingvegen 3, 4050 Sola',                 city: 'sola' },
  { name: 'EVO Heimdal',       address: 'Industriveien 13, 7080 Heimdal',         city: 'trondheim' },
  { name: 'EVO Sorgenfri',     address: 'Sorgenfriveien 28, 7031 Trondheim',      city: 'trondheim' },
  { name: 'EVO Tiller',        address: 'Ivar Lykkes veg 9, 7075 Tiller',        city: 'trondheim' },
  { name: 'EVO Nøtterøy',      address: 'Kjernåsveien 13A, 3142 Vestskogen',     city: 'nøtterøy' },
  { name: 'EVO Fyllingsdalen', address: 'Hjalmar Brantings vei 2a, Fyllingsdalen', city: 'bergen' },
  { name: 'EVO Sandsli',       address: 'Sandsliåsen 40, Sandsli',                city: 'bergen' },
];

async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  await new Promise((r) => setTimeout(r, 1100)); // Nominatim rate limit
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address + ', Norge')}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'fithub/1.0 (fithub.no)' } });
    const data = await res.json() as Array<{ lat: string; lon: string }>;
    if (!data[0]) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch { return null; }
}

function makeId(name: string, address: string): string {
  return 'evo_' + (name + '_' + address.split(',')[0])
    .toLowerCase()
    .replace(/[æ]/g, 'ae').replace(/[ø]/g, 'o').replace(/[å]/g, 'a')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60);
}

async function main() {
  console.log(`\npush-evo-missing${DRY_RUN ? '  DRY RUN' : ''}\n`);
  let inserted = 0, failed = 0;

  for (const loc of MISSING) {
    process.stdout.write(`  ${loc.name.padEnd(24)} `);

    const coords = await geocode(loc.address);
    if (!coords) {
      console.log('❌ geocode feilet');
      failed++;
      continue;
    }

    const id = makeId(loc.name, loc.address);
    const pointWkt = `SRID=4326;POINT(${coords.lon} ${coords.lat})`;

    if (DRY_RUN) {
      console.log(`[dry] ${id}  ${coords.lat.toFixed(4)},${coords.lon.toFixed(4)}`);
      continue;
    }

    // Insert service
    const { error: svcErr } = await supabase.from('services').upsert({
      id,
      name: loc.name,
      address: loc.address,
      type: 'styrke',
      main_category: 'trene-selv',
      description: 'EVO Fitness – treningssenter',
      price_level: 'medium',
      venues: ['gym'],
      goals: ['strength', 'weight_loss', 'kondisjon'],
      tags: ['treningssenter', 'styrketrening', 'kondisjon', 'evo'],
      is_active: true,
      website: 'https://www.evo.no',
      base_location: pointWkt,
    }, { onConflict: 'id' });

    if (svcErr) { console.log(`❌ service: ${svcErr.message}`); failed++; continue; }

    // Coverage — check first to avoid duplicates
    const { data: existingCov } = await supabase
      .from('service_coverage')
      .select('id')
      .eq('service_id', id)
      .eq('type', 'city')
      .eq('city', loc.city)
      .maybeSingle();

    let covErr = null;
    if (!existingCov) {
      const res = await supabase.from('service_coverage').insert({
        service_id: id,
        type: 'city',
        city: loc.city,
      });
      covErr = res.error;
    }

    if (covErr) console.log(`  ⚠️  coverage: ${covErr.message}`);

    // service_types
    await supabase.from('service_types').upsert(
      ['styrke', 'kondisjon'].map((t) => ({ service_id: id, type: t })),
      { onConflict: 'service_id,type' }
    );

    console.log(`✅ ${id}`);
    inserted++;
  }

  console.log(`\nFerdig.  Lagt til: ${inserted}  Feilet: ${failed}\n`);
}

main().catch(console.error);
