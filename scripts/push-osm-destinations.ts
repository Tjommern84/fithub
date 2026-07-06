#!/usr/bin/env tsx
/**
 * Leser data/osm/destinations.ndjson (output fra parse-osm-destinations.ts)
 * og upserter til Supabase-tabellen `destinations` (sql/39_destinations.sql).
 *
 * Usage:
 *   npx tsx scripts/push-osm-destinations.ts
 *   npx tsx scripts/push-osm-destinations.ts --dry-run
 *   npx tsx scripts/push-osm-destinations.ts --batch=500
 *   npx tsx scripts/push-osm-destinations.ts --in=data/osm/destinations.ndjson
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import type { DestinationRecord } from './parse-osm-destinations';

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
const dryRun    = args.includes('--dry-run');
const batchSize = Number(args.find(a => a.startsWith('--batch='))?.split('=')[1] ?? '500');
const inPath    = args.find(a => a.startsWith('--in='))?.split('=')[1]
  ?? join('data', 'osm', 'destinations.ndjson');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!dryRun && (!SUPABASE_URL || !SUPABASE_KEY)) {
  console.error('Mangler NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY i .env.local');
  process.exit(1);
}

const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('📍 FitHub – push OSM-destinasjoner til Supabase');
  if (dryRun) console.log('   [DRY RUN – ingen endringer lagres]');

  let rawLines: string[];
  try {
    rawLines = readFileSync(inPath, 'utf-8').split('\n').filter(Boolean);
  } catch {
    console.error(`Finner ikke ${inPath}`);
    console.error('Kjør først: npx tsx scripts/parse-osm-destinations.ts');
    process.exit(1);
  }

  const records = rawLines.map(l => JSON.parse(l) as DestinationRecord);
  console.log(`Leste ${records.length} destinasjoner fra ${inPath}`);

  let inserted = 0;
  let errors   = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    const rows = batch.map(r => ({
      source:           'osm',
      source_id:        r.sourceId,
      name:             r.name,
      destination_type: r.destinationType,
      lat:              r.lat,
      lon:              r.lon,
      elevation_m:      r.elevationM,
      geom:             `SRID=4326;POINT(${r.lon} ${r.lat})`,
      osm_tags:         r.osmTags,
    }));

    if (dryRun) {
      console.log(`[DRY RUN] Batch ${Math.floor(i / batchSize) + 1}: ${rows.length} rader`);
      if (i === 0) console.log('  Eksempel:', JSON.stringify(rows[0], null, 2));
      inserted += rows.length;
      continue;
    }

    const { error } = await supabase!
      .from('destinations')
      .upsert(rows, { onConflict: 'source,source_id' });

    if (error) {
      console.error(`Feil i batch ${Math.floor(i / batchSize) + 1}:`, error.message);
      errors++;
    } else {
      inserted += rows.length;
    }

    if ((i / batchSize + 1) % 10 === 0) {
      console.log(`  ${inserted}/${records.length} behandlet...`);
    }
  }

  console.log('\n── Ferdig ──────────────────────────────────────────');
  console.log(`  Upsert: ${inserted} rader`);
  if (errors > 0) console.log(`  Feil: ${errors} batches`);
}

main().catch(err => { console.error(err); process.exit(1); });
