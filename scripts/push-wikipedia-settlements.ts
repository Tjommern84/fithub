#!/usr/bin/env tsx
/**
 * Leser data/wikipedia/settlements.ndjson (output fra scripts/parse-wikipedia-settlements.ts)
 * og upserter rader til Supabase-tabellen `settlements` (sql/25_settlements.sql).
 *
 * Usage:
 *   npx tsx scripts/push-wikipedia-settlements.ts
 *   npx tsx scripts/push-wikipedia-settlements.ts --dry-run
 *   npx tsx scripts/push-wikipedia-settlements.ts --in=data/wikipedia/settlements.ndjson --batch=500
 */

import { createReadStream, readFileSync } from 'fs';
import { createInterface } from 'readline';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

// ── Load .env.local ───────────────────────────────────────────────────────
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

// ── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const inPath = args.find((a) => a.startsWith('--in='))?.split('=')[1]
  ?? join('data', 'wikipedia', 'settlements.ndjson');
const batchSize = Number(args.find((a) => a.startsWith('--batch='))?.split('=')[1] ?? '500');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!dryRun && (!SUPABASE_URL || !SUPABASE_KEY)) {
  console.error('Mangler NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY i .env.local');
  process.exit(1);
}

const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);

type SettlementRecord = {
  sourceLocalId: string;
  name: string;
  county: string;
  municipality: string | null;
  population: number | null;
  lon: number;
  lat: number;
};

async function main() {
  let total = 0;
  let batch: Record<string, unknown>[] = [];

  const flush = async () => {
    if (batch.length === 0) return;
    if (!dryRun && supabase) {
      const { error } = await supabase
        .from('settlements')
        .upsert(batch, { onConflict: 'source,source_local_id' });
      if (error) {
        console.error('Upsert-feil:', error.message);
        process.exitCode = 1;
      }
    }
    batch = [];
  };

  const rl = createInterface({ input: createReadStream(inPath, { encoding: 'utf8' }) });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const r: SettlementRecord = JSON.parse(line);

    batch.push({
      source: 'wikipedia',
      source_local_id: r.sourceLocalId,
      name: r.name,
      county: r.county,
      municipality: r.municipality,
      population: r.population,
      geom: `SRID=4326;POINT(${r.lon} ${r.lat})`,
    });
    total++;

    if (batch.length >= batchSize) {
      await flush();
      console.log(`...${total} tettsteder behandlet`);
    }
  }
  await flush();

  console.log(dryRun ? '\n[DRY RUN] Ingen data skrevet til Supabase.' : '\nFerdig.');
  console.log('Totalt:', total);
}

main();
