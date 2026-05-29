#!/usr/bin/env tsx
/**
 * Finn tufteparker og utendørs treningsplasser via Serper.dev (Google Places).
 *
 * Usage:
 *   npx tsx scripts/find-tufteparker.ts
 *   npx tsx scripts/find-tufteparker.ts --city=bergen
 *   npx tsx scripts/find-tufteparker.ts --limit=5
 */

import { readFileSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';

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
const cityFilter = args.find(a => a.startsWith('--city='))?.split('=')[1]?.toLowerCase() ?? null;
const limitArg   = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0') || null;
const delayMs    = parseInt(args.find(a => a.startsWith('--delay='))?.split('=')[1] ?? '1500');

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const outDir  = join(process.cwd(), 'data');
const outFile = join(outDir, 'tufteparker.jsonl');
mkdirSync(outDir, { recursive: true });

const QUERIES = [
  { query: 'tuftepark', tags: ['tuftepark', 'utetrening', 'styrke', 'gratis'] },
  { query: 'utendørs treningspark', tags: ['tuftepark', 'utetrening', 'gratis'] },
  { query: 'utendørs treningsplass', tags: ['utetrening', 'gratis'] },
];

const CITIES = [
  'Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Tromsø',
  'Drammen', 'Fredrikstad', 'Kristiansand', 'Sandnes', 'Haugesund',
  'Tønsberg', 'Skien', 'Porsgrunn', 'Ålesund', 'Sandefjord',
  'Moss', 'Sarpsborg', 'Bodø', 'Hamar', 'Gjøvik',
  'Larvik', 'Halden', 'Arendal', 'Molde', 'Lillestrøm',
  'Asker', 'Kongsberg', 'Horten', 'Notodden', 'Elverum',
  'Steinkjer', 'Lillehammer',
];

interface SerperPlace {
  title: string;
  address: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
  rating?: number;
  ratingCount?: number;
}

async function searchPlaces(query: string): Promise<SerperPlace[]> {
  const res = await fetch('https://google.serper.dev/places', {
    method: 'POST',
    headers: { 'X-API-KEY': SERPER_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, gl: 'no', hl: 'no' }),
  });
  if (!res.ok) throw new Error(`Serper HTTP ${res.status}`);
  const data = await res.json() as { places?: SerperPlace[] };
  return data.places ?? [];
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('🌳 FitHub – finn tufteparker via Google Places');
  if (!SERPER_API_KEY) { console.error('❌ SERPER_API_KEY mangler'); process.exit(1); }

  const cities = cityFilter ? CITIES.filter(c => c.toLowerCase() === cityFilter) : CITIES;
  const searches = QUERIES.flatMap(q => cities.map(city => ({ ...q, city })));
  const todo = limitArg ? searches.slice(0, limitArg) : searches;

  console.log(`   ${QUERIES.length} søketyper × ${cities.length} byer = ${searches.length} søk`);
  if (limitArg) console.log(`   Begrenset til ${limitArg}`);
  console.log(`   Output: ${outFile}\n`);

  let total = 0;
  for (let i = 0; i < todo.length; i++) {
    const { query, tags, city } = todo[i];
    const fullQuery = `${query} ${city}`;
    process.stdout.write(`[${i + 1}/${todo.length}] ${fullQuery}… `);

    try {
      const places = await searchPlaces(fullQuery);
      for (const p of places) {
        if (!p.title || !p.latitude) continue;
        appendFileSync(outFile, JSON.stringify({
          name: p.title,
          address: p.address,
          city: city.toLowerCase(),
          lat: p.latitude,
          lon: p.longitude,
          phone: p.phone ?? null,
          website: p.website ?? null,
          rating: p.rating ?? 0,
          ratingCount: p.ratingCount ?? 0,
          tags,
        }) + '\n');
        total++;
      }
      console.log(`${places.length} treff`);
    } catch (e) {
      console.log(`✗ ${e}`);
    }

    if (i < todo.length - 1) await sleep(delayMs);
  }

  console.log(`\n✅ Ferdig! ${total} steder lagret til ${outFile}`);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
