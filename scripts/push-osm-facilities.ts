#!/usr/bin/env tsx
/**
 * Push OpenStreetMap-fasiliteter fra data/osm-facilities.jsonl til Supabase
 *
 * Leser output fra scripts/find-osm-facilities.ts og upserts:
 *   - services (name, address, type, phone, website, base_location, ...)
 *   - service_coverage (city-basert)
 *
 * ID-prefix: osm_
 *
 * Usage:
 *   npx tsx scripts/push-osm-facilities.ts
 *   npx tsx scripts/push-osm-facilities.ts --dry-run
 *   npx tsx scripts/push-osm-facilities.ts --limit=50
 *   npx tsx scripts/push-osm-facilities.ts --tag=yoga
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import type { OsmFacility } from './find-osm-facilities';

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
const dryRun   = args.includes('--dry-run');
const limitArg = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0') || null;
const tagFilter = args.find(a => a.startsWith('--tag='))?.split('=')[1] ?? null;

// ── Config ────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
                  ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
                  ?? '';

const inFile = join(process.cwd(), 'data', 'osm-facilities.jsonl');

// ── Helpers ───────────────────────────────────────────────────────────────
function makeId(osmType: string, osmId: number, osmValue: string): string {
  const base = `osm_${osmValue}_${osmType}_${osmId}`;
  return base
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 85);
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('🗺️  FitHub – push OSM-fasiliteter til Supabase');
  if (dryRun) console.log('   [DRY RUN – ingen endringer lagres]');
  console.log();

  if (!SUPABASE_URL) { console.error('❌ NEXT_PUBLIC_SUPABASE_URL mangler'); process.exit(1); }

  // Les JSONL
  let rawLines: string[];
  try {
    rawLines = readFileSync(inFile, 'utf-8').split('\n').filter(Boolean);
  } catch {
    console.error(`❌ Finner ikke ${inFile}`);
    console.error('   Kjør først: npm run osm:find');
    process.exit(1);
  }

  let facilities: OsmFacility[] = rawLines.map(l => JSON.parse(l) as OsmFacility);

  if (tagFilter) {
    facilities = facilities.filter(f => f.mapping.osmValue === tagFilter);
    console.log(`   Filter: tag=${tagFilter} → ${facilities.length} fasiliteter`);
  }

  if (limitArg) facilities = facilities.slice(0, limitArg);

  console.log(`📂 ${facilities.length} fasiliteter å prosessere\n`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  let added = 0, skipped = 0, coverageAdded = 0, errors = 0;

  for (let i = 0; i < facilities.length; i++) {
    const f = facilities[i];
    const id = makeId(f.osm_type, f.osm_id, f.mapping.osmValue);
    const m = f.mapping;

    const cityDisplay = f.city
      ? f.city.charAt(0).toUpperCase() + f.city.slice(1)
      : 'Norge';

    const serviceRow = {
      id,
      name: f.name,
      type: m.type,
      main_category: m.mainCategory,
      description: `${m.description} i ${cityDisplay}`,
      address: f.address ?? null,
      city: f.city ?? null,
      phone: f.phone ?? null,
      website: f.website ?? null,
      rating_avg: 0,
      rating_count: 0,
      is_active: true,
      tags: m.tags,
      goals: m.goals,
      venues: m.venues,
      coverage: [],
      price_level: m.priceLevel,
      owner_user_id: null,
    };

    if (i % 50 === 0) {
      process.stdout.write(`\r   [${i + 1}/${facilities.length}]  ✓ ${added}  ✗ ${errors}   `);
    }

    if (dryRun) {
      added++;
      continue;
    }

    const { error } = await supabase
      .from('services')
      .upsert(serviceRow, { onConflict: 'id', ignoreDuplicates: true });

    if (error) {
      errors++;
      continue;
    }

    added++;

    // base_location fra OSM-koordinater
    if (f.lat !== null && f.lon !== null) {
      await supabase
        .from('services')
        .update({ base_location: `SRID=4326;POINT(${f.lon} ${f.lat})` })
        .eq('id', id);
    }

    // service_coverage
    if (f.city) {
      try {
        await supabase
          .from('service_coverage')
          .insert({ service_id: id, type: 'city', city: f.city });
        coverageAdded++;
      } catch { /* ignore duplicate */ }
    } else {
      // Ingen by-info: sett landsdekkende som fallback
      try {
        await supabase
          .from('service_coverage')
          .insert({ service_id: id, type: 'region', region: 'norway' });
      } catch { /* ignore */ }
    }
  }

  process.stdout.write('\n');
  console.log('\n✅ Ferdig!');
  console.log(`   Lagt til : ${added}`);
  console.log(`   Feil     : ${errors}`);
  console.log(`   Coverage : ${coverageAdded} byer`);
  if (dryRun) console.log('\n   Kjør uten --dry-run for å lagre til Supabase');

  // Verifisering
  if (!dryRun) {
    const { count } = await supabase
      .from('services')
      .select('*', { count: 'exact', head: true })
      .like('id', 'osm_%');
    console.log(`\n📊 Totalt osm_*-tjenester i DB: ${count ?? '?'}`);
  }
}

main().catch(err => { console.error('\n❌ Uventet feil:', err); process.exit(1); });
