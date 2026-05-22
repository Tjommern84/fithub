#!/usr/bin/env tsx
/**
 * Finn potensielle duplikater i services-tabellen.
 *
 * Sammenligner navn innen samme by ved hjelp av Levenshtein-likhet.
 * Par med likhet >= THRESHOLD (standard 0.85) rapporteres.
 *
 * Usage:
 *   npx tsx scripts/find-duplicates.ts
 *   npx tsx scripts/find-duplicates.ts --threshold=0.9
 *   npx tsx scripts/find-duplicates.ts --city=oslo
 *   npx tsx scripts/find-duplicates.ts --dry-run   (ingen fil skrives)
 *
 * Output: data/duplicates.json  (liste av par med id, navn, by, likhet)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
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
const dryRun = args.includes('--dry-run');
const cityFilter = args.find(a => a.startsWith('--city='))?.split('=')[1]?.toLowerCase() ?? null;
const threshold = parseFloat(args.find(a => a.startsWith('--threshold='))?.split('=')[1] ?? '0.85');

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const row = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      row[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, row[j], row[j - 1]);
      prev = tmp;
    }
  }
  return row[n];
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

type ServiceRow = { id: string; name: string; city: string | null; type: string };
type DuplicatePair = {
  city: string | null;
  similarity: number;
  a: { id: string; name: string };
  b: { id: string; name: string };
};

async function fetchAll(): Promise<ServiceRow[]> {
  const all: ServiceRow[] = [];
  const BATCH = 1000;
  let from = 0;
  while (true) {
    let q = sb.from('services').select('id, name, city, type').eq('is_active', true);
    if (cityFilter) q = q.ilike('city', cityFilter);
    const { data, error } = await q.range(from, from + BATCH - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as ServiceRow[]));
    if (data.length < BATCH) break;
    from += BATCH;
  }
  return all;
}

async function main() {
  console.log(`Fetching services (threshold=${threshold}${cityFilter ? `, city=${cityFilter}` : ''})...`);
  const all = await fetchAll();
  console.log(`Loaded ${all.length} services`);

  const byCity = new Map<string, ServiceRow[]>();
  for (const svc of all) {
    const key = svc.city?.toLowerCase().trim() ?? '__unknown__';
    const bucket = byCity.get(key) ?? [];
    bucket.push(svc);
    byCity.set(key, bucket);
  }

  const pairs: DuplicatePair[] = [];
  let comparisons = 0;

  for (const [cityKey, services] of byCity) {
    if (services.length < 2) continue;
    const normalized = services.map(s => normalize(s.name));

    for (let i = 0; i < services.length; i++) {
      for (let j = i + 1; j < services.length; j++) {
        const na = normalized[i];
        const nb = normalized[j];
        comparisons++;

        // Skip early if length ratio is too far apart (can't exceed threshold)
        const ratio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length || 1);
        if (ratio < threshold) continue;

        const sim = similarity(na, nb);
        if (sim >= threshold) {
          pairs.push({
            city: cityKey === '__unknown__' ? null : cityKey,
            similarity: sim,
            a: { id: services[i].id, name: services[i].name },
            b: { id: services[j].id, name: services[j].name },
          });
        }
      }
    }
  }

  pairs.sort((a, b) => b.similarity - a.similarity);

  console.log(`\nDone. ${comparisons.toLocaleString()} comparisons, ${pairs.length} potential duplicate pairs found.`);

  if (pairs.length > 0) {
    console.log('\nTop 20 matches:');
    for (const p of pairs.slice(0, 20)) {
      console.log(`  [${p.similarity.toFixed(2)}] "${p.a.name}" ↔ "${p.b.name}" (${p.city ?? 'ingen by'})`);
    }
    if (pairs.length > 20) console.log(`  ... og ${pairs.length - 20} til`);
  }

  if (!dryRun) {
    mkdirSync(join(process.cwd(), 'data'), { recursive: true });
    const outPath = join(process.cwd(), 'data', 'duplicates.json');
    writeFileSync(outPath, JSON.stringify(pairs, null, 2));
    console.log(`\nRapport skrevet til ${outPath}`);
    console.log('Bruk delete-pt-duplicates.ts for å slette ID-er du ønsker å fjerne.');
  }
}

main().catch(console.error);
