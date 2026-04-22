#!/usr/bin/env tsx
/**
 * Finn nærmeste norske kommune for OSM-tjenester uten by-info
 *
 * Henter kommunesentroider fra Geonorge API (357 kommuner),
 * beregner nærmeste kommune per tjeneste via Haversine,
 * og oppdaterer services.city + service_coverage i Supabase.
 *
 * Usage:
 *   npx tsx scripts/geocode-osm-cities.ts
 *   npx tsx scripts/geocode-osm-cities.ts --dry-run
 *   npx tsx scripts/geocode-osm-cities.ts --limit=100
 *   npx tsx scripts/geocode-osm-cities.ts --prefix=osm_
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import type { OsmFacility } from './find-osm-facilities';

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

const args = process.argv.slice(2);
const dryRun   = args.includes('--dry-run');
const limitArg = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0') || null;
const prefix   = args.find(a => a.startsWith('--prefix='))?.split('=')[1] ?? 'osm_';
const jsonlFile = join(process.cwd(), 'data', 'osm-facilities.jsonl');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
                  ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
                  ?? '';

interface Kommune {
  name: string;
  lat: number;
  lon: number;
}

// ── Haversine ─────────────────────────────────────────────────────────────
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestKommune(lat: number, lon: number, kommuner: Kommune[]): Kommune {
  let best = kommuner[0];
  let bestDist = Infinity;
  for (const k of kommuner) {
    const d = haversineKm(lat, lon, k.lat, k.lon);
    if (d < bestDist) { bestDist = d; best = k; }
  }
  return best;
}

// ── Hent kommuner fra Geonorge ────────────────────────────────────────────
async function fetchKommuner(): Promise<Kommune[]> {
  console.log('🗺️  Henter kommuner fra Geonorge…');
  const list = await fetch('https://ws.geonorge.no/kommuneinfo/v1/kommuner', {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  }).then(r => r.json()) as { kommunenummer: string; kommunenavn: string }[];

  const kommuner: Kommune[] = [];
  let done = 0;
  for (const k of list) {
    try {
      const detail = await fetch(
        `https://ws.geonorge.no/kommuneinfo/v1/kommuner/${k.kommunenummer}`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) }
      ).then(r => r.json()) as { punktIOmrade: { coordinates: [number, number] } };
      const [lon, lat] = detail.punktIOmrade.coordinates;
      kommuner.push({ name: k.kommunenavn.toLowerCase(), lat, lon });
    } catch { /* skip */ }
    done++;
    if (done % 50 === 0) process.stdout.write(`\r   ${done}/${list.length} kommuner hentet…`);
  }
  process.stdout.write('\n');
  console.log(`   ✅ ${kommuner.length} kommuner lastet\n`);
  return kommuner;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('📍 FitHub – geocode tjenester til nærmeste kommune');
  if (dryRun) console.log('   [DRY RUN – ingen endringer lagres]');
  console.log();

  if (!SUPABASE_URL) { console.error('❌ NEXT_PUBLIC_SUPABASE_URL mangler'); process.exit(1); }

  const kommuner = await fetchKommuner();
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Les koordinater fra JSONL (Supabase returnerer base_location som hex WKB)
  if (!existsSync(jsonlFile)) {
    console.error(`❌ Finner ikke ${jsonlFile} — kjør npm run osm:find først`);
    process.exit(1);
  }
  const coordMap = new Map<string, { lat: number; lon: number }>();
  for (const line of readFileSync(jsonlFile, 'utf-8').split('\n').filter(Boolean)) {
    const f = JSON.parse(line) as OsmFacility;
    if (f.lat !== null && f.lon !== null) {
      const id = `osm_${f.mapping.osmValue}_${f.osm_type}_${f.osm_id}`
        .toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/_{2,}/g, '_').replace(/^_|_$/g, '').slice(0, 85);
      coordMap.set(id, { lat: f.lat, lon: f.lon });
    }
  }
  console.log(`   ${coordMap.size} koordinater fra JSONL\n`);

  // Hent tjenester uten city fra Supabase
  console.log(`🔍 Henter ${prefix}*-tjenester uten by-info…`);
  let query = supabase
    .from('services')
    .select('id, name, city')
    .like('id', `${prefix}%`)
    .is('city', null);

  if (limitArg) query = query.limit(limitArg);

  const { data: services, error } = await query;
  if (error) { console.error('❌ Supabase-feil:', error.message); process.exit(1); }
  if (!services?.length) { console.log('✅ Ingen tjenester å oppdatere'); return; }

  console.log(`   ${services.length} tjenester å oppdatere\n`);

  let updated = 0, skippedNoCoords = 0, coverageAdded = 0, errors = 0;

  for (let i = 0; i < services.length; i++) {
    const svc = services[i];
    const coords = coordMap.get(svc.id);

    if (!coords) { skippedNoCoords++; continue; }
    const { lat, lon } = coords;

    const kommune = nearestKommune(lat, lon, kommuner);

    if (i % 100 === 0) {
      process.stdout.write(`\r   [${i + 1}/${services.length}]  ✓ ${updated}  skip ${skippedNoCoords}  ✗ ${errors}   `);
    }

    if (dryRun) {
      if (i < 10) console.log(`   ${svc.name} → ${kommune.name}`);
      updated++;
      continue;
    }

    const { error: updErr } = await supabase
      .from('services')
      .update({ city: kommune.name })
      .eq('id', svc.id);

    if (updErr) { errors++; continue; }
    updated++;

    try {
      await supabase
        .from('service_coverage')
        .insert({ service_id: svc.id, type: 'city', city: kommune.name });
      coverageAdded++;
    } catch { /* duplicate — already has coverage */ }
  }

  process.stdout.write('\n');
  console.log('\n✅ Ferdig!');
  console.log(`   Oppdatert  : ${updated}`);
  console.log(`   Ingen koord: ${skippedNoCoords}`);
  console.log(`   Coverage   : ${coverageAdded}`);
  console.log(`   Feil       : ${errors}`);
  if (dryRun) console.log('\n   Kjør uten --dry-run for å lagre');
}

main().catch(err => { console.error('\n❌ Uventet feil:', err); process.exit(1); });
