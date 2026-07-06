#!/usr/bin/env tsx
/**
 * Kjør hele destinasjons-importen i én operasjon:
 *   1. Hent fra Overpass API → data/osm/destinations.ndjson
 *   2. Push til Supabase
 *
 * Usage:
 *   npx tsx scripts/import-osm-destinations.ts
 */

import { execSync } from 'child_process';
import { existsSync, statSync } from 'fs';
import { join } from 'path';

const ndjsonPath = join(process.cwd(), 'data', 'osm', 'destinations.ndjson');

console.log('═══════════════════════════════════════════════════');
console.log('  FitHub – Full destinasjons-import fra OSM');
console.log('═══════════════════════════════════════════════════');
console.log();

// ── Steg 1: Parse (hopp over hvis filen allerede finnes med innhold) ──────
const existingSize = existsSync(ndjsonPath) ? statSync(ndjsonPath).size : 0;

if (existingSize > 10_000) {
  const sizeMb = (existingSize / 1024 / 1024).toFixed(1);
  console.log(`▶ Steg 1/2 — Hopper over parse (eksisterende fil: ${sizeMb} MB).`);
  console.log(`   Slett ${ndjsonPath} og kjør på nytt for å re-hente fra Overpass.`);
  console.log();
} else {
  console.log('▶ Steg 1/2 — Henter fra Overpass API (kan ta 5–15 min)...');
  console.log();

  try {
    execSync('npx tsx scripts/parse-osm-destinations.ts --skip-elevation', {
      stdio: 'inherit',
      timeout: 30 * 60 * 1000, // 30 min maks
    });
  } catch (e) {
    console.error('\n❌ Parse-steg feilet:', (e as Error).message);
    process.exit(1);
  }

  if (!existsSync(ndjsonPath) || statSync(ndjsonPath).size < 10_000) {
    console.error(`\n❌ NDJSON er tom eller mangler etter parse-steg.`);
    process.exit(1);
  }
}

const sizeMb = (statSync(ndjsonPath).size / 1024 / 1024).toFixed(1);
console.log(`\n✓ NDJSON klar: ${ndjsonPath} (${sizeMb} MB)`);
console.log();

// ── Steg 2: Push ──────────────────────────────────────────────────────────
console.log('▶ Steg 2/2 — Pusher til Supabase...');
console.log();

try {
  execSync('npx tsx scripts/push-osm-destinations.ts --batch=500', {
    stdio: 'inherit',
    timeout: 60 * 60 * 1000, // 60 min maks
  });
} catch (e) {
  console.error('\n❌ Push-steg feilet:', (e as Error).message);
  process.exit(1);
}

console.log();
console.log('═══════════════════════════════════════════════════');
console.log('  ✓ Import fullført!');
console.log('═══════════════════════════════════════════════════');
