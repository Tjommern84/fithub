#!/usr/bin/env tsx
/**
 * Leser data/geonorge/trails.ndjson (output fra scripts/parse-geonorge-trails.ts)
 * og upserter rader til Supabase-tabellen `trails` (sql/22_trails.sql).
 *
 * Usage:
 *   npx tsx scripts/push-geonorge-trails.ts
 *   npx tsx scripts/push-geonorge-trails.ts --dry-run
 *   npx tsx scripts/push-geonorge-trails.ts --in=data/geonorge/trails.ndjson --batch=500
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
  ?? join('data', 'geonorge', 'trails.ndjson');
const batchSize = Number(args.find((a) => a.startsWith('--batch='))?.split('=')[1] ?? '500');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!dryRun && (!SUPABASE_URL || !SUPABASE_KEY)) {
  console.error('Mangler NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY i .env.local');
  process.exit(1);
}

const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);

type TrailRecord = {
  type: string;
  sourceLocalId: string | null;
  name: string | null;
  maintainer: string | null;
  difficulty: string | null;
  marked: boolean | null;
  coords: [number, number][];
};

const EARTH_RADIUS_KM = 6371;
function haversineKm(a: [number, number], b: [number, number]): number {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function lineLengthKm(coords: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversineKm(coords[i - 1], coords[i]);
  return total;
}

function toWkt(coords: [number, number][]): string {
  return `LINESTRING(${coords.map(([lon, lat]) => `${lon} ${lat}`).join(', ')})`;
}

async function main() {
  const counts: Record<string, number> = {};
  let total = 0;
  let batch: Record<string, unknown>[] = [];

  const flush = async () => {
    if (batch.length === 0) return;
    if (!dryRun && supabase) {
      const { error } = await supabase
        .from('trails')
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
    const r: TrailRecord = JSON.parse(line);
    counts[r.type] = (counts[r.type] ?? 0) + 1;
    total++;

    batch.push({
      source: 'geonorge',
      source_local_id: r.sourceLocalId,
      name: r.name,
      trail_type: r.type,
      maintainer: r.maintainer,
      marked: r.marked,
      difficulty: r.difficulty,
      length_km: Number(lineLengthKm(r.coords).toFixed(3)),
      geom: `SRID=4326;${toWkt(r.coords)}`,
    });

    if (batch.length >= batchSize) {
      await flush();
      if (total % 5000 === 0) console.log(`...${total} ruter behandlet`);
    }
  }
  await flush();

  console.log(dryRun ? '\n[DRY RUN] Ingen data skrevet til Supabase.' : '\nFerdig.');
  console.log('Antall pr. type:', counts);
  console.log('Totalt:', total);
}

main();
