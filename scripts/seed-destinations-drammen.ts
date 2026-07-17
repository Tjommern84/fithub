#!/usr/bin/env tsx
/**
 * Manuelt seed av kjente turmål i Drammen-området for å teste appen
 * mens Overpass API-kvoter er oppbrukt.
 *
 * Koordinater hentet fra OSM/Kartverket.
 *
 * Usage:
 *   npx tsx scripts/seed-destinations-drammen.ts
 *   npx tsx scripts/seed-destinations-drammen.ts --dry-run
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  try {
    const text = readFileSync(join(process.cwd(), '.env.local'), 'utf-8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  } catch { /* no .env.local */ }
}
loadEnv();

const dryRun = process.argv.includes('--dry-run');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!dryRun && (!SUPABASE_URL || !SUPABASE_KEY)) {
  console.error('Mangler env-variabler'); process.exit(1);
}
const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);

const DESTINATIONS = [
  // Drammen-nære turmål
  { name: 'Spiraltoppen',       type: 'viewpoint', lat: 59.7461, lon: 10.2013, ele: 303, id: 'manual_spiraltoppen' },
  { name: 'Konnerudkollen',     type: 'peak',      lat: 59.7278, lon: 10.1856, ele: 387, id: 'manual_konnerudkollen' },
  { name: 'Landfalltjern',      type: 'viewpoint', lat: 59.7561, lon: 10.1644, ele: 290, id: 'manual_landfalltjern' },
  { name: 'Gråkampen',          type: 'peak',      lat: 59.7189, lon: 10.1523, ele: 425, id: 'manual_graakampen' },
  { name: 'Høvleriet',          type: 'viewpoint', lat: 59.7622, lon: 10.1933, ele: 200, id: 'manual_hovleriet' },
  { name: 'Vestfosstoppen',     type: 'peak',      lat: 59.7050, lon: 10.1500, ele: 356, id: 'manual_vestfosstoppen' },
  // Oslo
  { name: 'Tryvannstårnet',     type: 'viewpoint', lat: 59.9940, lon: 10.6688, ele: 529, id: 'manual_tryvann' },
  { name: 'Kolsåstoppen',       type: 'peak',      lat: 59.9133, lon: 10.5275, ele: 383, id: 'manual_kolsas' },
  { name: 'Vardåsen',           type: 'peak',      lat: 59.9022, lon: 10.4783, ele: 397, id: 'manual_vardaas' },
  // Bergen
  { name: 'Ulriken',            type: 'peak',      lat: 60.3714, lon: 5.3944,  ele: 643, id: 'manual_ulriken' },
  { name: 'Fløyen',             type: 'viewpoint', lat: 60.3950, lon: 5.3506,  ele: 399, id: 'manual_floyen' },
  // Trondheim
  { name: 'Gråkallen',          type: 'peak',      lat: 63.4392, lon: 10.3178, ele: 556, id: 'manual_graakallen' },
];

async function main() {
  console.log('🏔  FitHub – seed Drammen/test-destinasjoner');
  if (dryRun) console.log('   [DRY RUN]');

  const rows = DESTINATIONS.map(d => ({
    source:           'manual',
    source_id:        d.id,
    name:             d.name,
    destination_type: d.type,
    lat:              d.lat,
    lon:              d.lon,
    elevation_m:      d.ele,
    geom:             `SRID=4326;POINT(${d.lon} ${d.lat})`,
    osm_tags:         {},
  }));

  if (dryRun) {
    console.log(`\nVille upsert ${rows.length} destinasjoner:`);
    rows.forEach(r => console.log(`  ${r.name} (${r.destination_type}, ${r.elevation_m}m)`));
    return;
  }

  const { error } = await supabase!
    .from('destinations')
    .upsert(rows, { onConflict: 'source,source_id' });

  if (error) {
    console.error('Feil:', error.message);
    process.exit(1);
  }
  console.log(`\n✓ Upsert ${rows.length} destinasjoner`);
  console.log('  Sjekk http://localhost:3000 — "Turmål nær deg" skal vises fra Drammen.');
}

main().catch(err => { console.error(err); process.exit(1); });
