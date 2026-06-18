#!/usr/bin/env tsx
/**
 * Leser data/wikipedia/cities.ndjson (output fra scripts/parse-wikipedia-cities.ts)
 * og setter is_city=true på matchende rader i `settlements` (sql/26_settlements_is_city.sql).
 *
 * Matching: eksakt navn (case-insensitive), deretter sjekk om bynavnet er ett av
 * leddene i et slash-sammenslått settlement-navn (f.eks. "Fredrikstad" matcher
 * "Fredrikstad/Sarpsborg" — SSB slår sammen tettsteder som har vokst sammen).
 * Byer uten treff geokodes via Nominatim og settes inn som nye settlements-rader
 * med source='wikipedia-byer'.
 *
 * Usage:
 *   npx tsx scripts/push-wikipedia-cities.ts --dry-run
 *   npx tsx scripts/push-wikipedia-cities.ts
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

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const inPath = args.find((a) => a.startsWith('--in='))?.split('=')[1]
  ?? join('data', 'wikipedia', 'cities.ndjson');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Mangler NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY i .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

type City = { name: string; municipality: string | null; county: string | null };
type SettlementRow = { id: string; name: string };

async function geocode(name: string): Promise<{ lat: number; lon: number } | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(name)}`,
    { headers: { 'User-Agent': 'fithub-cities-import/1.0' } }
  );
  if (!res.ok) return null;
  const results = await res.json() as Array<{ lat: string; lon: string; addresstype?: string }>;
  if (results.length === 0) return null;
  // Foretrekk selve bypunktet over en kommune-administrativ grense (annen centroid).
  const preferred = results.find((r) => ['city', 'town', 'village', 'hamlet'].includes(r.addresstype ?? '')) ?? results[0];
  return { lat: Number(preferred.lat), lon: Number(preferred.lon) };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const cities: City[] = readFileSync(inPath, 'utf-8').trim().split('\n').map((l) => JSON.parse(l));
  console.log(`${cities.length} byer lest fra ${inPath}\n`);

  const { data: settlements, error: fetchError } = await supabase
    .from('settlements')
    .select('id, name');
  if (fetchError) { console.error('Kunne ikke hente settlements:', fetchError.message); process.exit(1); }

  const byExactName = new Map<string, SettlementRow>();
  const slashParts: { row: SettlementRow; parts: string[] }[] = [];
  for (const s of (settlements ?? []) as SettlementRow[]) {
    byExactName.set(s.name.toLowerCase(), s);
    if (s.name.includes('/')) {
      slashParts.push({ row: s, parts: s.name.split('/').map((p) => p.trim().toLowerCase()) });
    }
  }

  let directMatches = 0, slashMatches = 0, geocoded = 0, failed = 0;
  const failedNames: string[] = [];

  for (const city of cities) {
    const lower = city.name.toLowerCase();
    let match = byExactName.get(lower);

    if (!match) {
      const slashHit = slashParts.find((sp) => sp.parts.includes(lower));
      if (slashHit) { match = slashHit.row; slashMatches++; }
    } else {
      directMatches++;
    }

    if (match) {
      console.log(`✓ ${city.name} -> match: ${match.name}`);
      if (!dryRun) {
        const { error } = await supabase.from('settlements').update({ is_city: true }).eq('id', match.id);
        if (error) console.error(`  Feil ved oppdatering av ${city.name}:`, error.message);
      }
      continue;
    }

    // Ingen treff -- geokod og sett inn ny rad
    const coords = await geocode(`${city.name}, Norge`);
    await sleep(1100); // Nominatim usage policy: maks ~1 req/sek
    if (!coords) {
      console.log(`✗ ${city.name} -> ingen treff i settlements og geokoding feilet`);
      failed++;
      failedNames.push(city.name);
      continue;
    }
    console.log(`+ ${city.name} -> geokodet (${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}), ny rad`);
    geocoded++;
    if (!dryRun) {
      const { error } = await supabase.from('settlements').insert({
        source: 'wikipedia-byer',
        source_local_id: null,
        name: city.name,
        county: city.county,
        municipality: city.municipality,
        population: null,
        is_city: true,
        geom: `SRID=4326;POINT(${coords.lon} ${coords.lat})`,
      });
      if (error) console.error(`  Feil ved insert av ${city.name}:`, error.message);
    }
  }

  console.log(`\nFerdig${dryRun ? ' [DRY RUN]' : ''}.`);
  console.log(`Direkte navnematch: ${directMatches}`);
  console.log(`Slash-navnematch:   ${slashMatches}`);
  console.log(`Geokodet (nye):     ${geocoded}`);
  console.log(`Feilet helt:        ${failed}`, failedNames.length ? `(${failedNames.join(', ')})` : '');
  console.log(`Totalt:             ${cities.length}`);
}

main();
