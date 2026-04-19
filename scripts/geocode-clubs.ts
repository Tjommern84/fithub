#!/usr/bin/env tsx
/**
 * Geocode klubber som mangler base_location via Nominatim (gratis, ingen API-nøkkel).
 *
 * Nominatim brukervilkår: maks 1 req/sekund, ingen bulk-bruk.
 * Skriptet overholder dette med --delay=1100 som standard.
 *
 * Usage:
 *   npx tsx scripts/geocode-clubs.ts
 *   npx tsx scripts/geocode-clubs.ts --dry-run --limit=10
 *   npx tsx scripts/geocode-clubs.ts --type=sport
 *   npx tsx scripts/geocode-clubs.ts --all-types
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

const args     = process.argv.slice(2);
const dryRun   = args.includes('--dry-run');
const allTypes = args.includes('--all-types');
const typeFilter = args.find(a => a.startsWith('--type='))?.split('=')[1] ?? (allTypes ? null : 'sport');
const limit    = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0') || 0;
const delayMs  = parseInt(args.find(a => a.startsWith('--delay='))?.split('=')[1] ?? '1100');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=no&limit=1`;
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'no',
        'User-Agent': 'SettDegEtMal/1.0 (tjommern@gmail.com)',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const results = await res.json() as NominatimResult[];
    if (!results.length) return null;
    return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
  } catch {
    return null;
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('📍  SettDegEtMål – geocode klubber via Nominatim (gratis)');
  if (dryRun) console.log('   [DRY RUN – ingen endringer lagres]');
  if (typeFilter) console.log(`   Filter: type=${typeFilter}`);
  console.log(`   Delay: ${delayMs}ms (Nominatim: maks 1 req/sek)`);
  console.log();

  if (!SUPABASE_URL) { console.error('❌ NEXT_PUBLIC_SUPABASE_URL mangler'); process.exit(1); }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Hent tjenester uten base_location men med adresse
  let query = supabase
    .from('services')
    .select('id, name, address, city')
    .eq('is_active', true)
    .is('base_location', null)
    .not('address', 'is', null)
    .order('id');

  if (typeFilter) query = query.eq('type', typeFilter);
  if (limit > 0) query = query.limit(limit);

  const { data: services, error } = await query;
  if (error) { console.error('❌ Supabase-feil:', error.message); process.exit(1); }
  if (!services?.length) { console.log('Alle tjenester har allerede koordinater.'); return; }

  console.log(`📋 ${services.length} tjenester mangler koordinater\n`);

  let geocoded = 0, failed = 0, errors = 0;

  for (let i = 0; i < services.length; i++) {
    const svc = services[i];
    const address = svc.address as string;
    process.stdout.write(`[${i + 1}/${services.length}] ${svc.name} … `);

    const coords = await geocodeAddress(address);
    if (!coords) {
      // Prøv med bare by hvis adresse ikke fant noe
      const cityOnly = svc.city as string | null;
      const coordsCity = cityOnly ? await geocodeAddress(`${cityOnly}, Norge`) : null;
      if (!coordsCity) {
        process.stdout.write('ikke funnet\n');
        failed++;
        await sleep(delayMs);
        continue;
      }
      // Sett city-koordinat (unøyaktig men bedre enn ingenting)
      if (!dryRun) {
        await supabase.from('services')
          .update({ base_location: `SRID=4326;POINT(${coordsCity.lon} ${coordsCity.lat})` })
          .eq('id', svc.id);
      }
      process.stdout.write(`~by (${coordsCity.lat.toFixed(4)}, ${coordsCity.lon.toFixed(4)}) ✓\n`);
      geocoded++;
      await sleep(delayMs);
      continue;
    }

    if (!dryRun) {
      const { error: upErr } = await supabase.from('services')
        .update({ base_location: `SRID=4326;POINT(${coords.lon} ${coords.lat})` })
        .eq('id', svc.id);
      if (upErr) {
        process.stdout.write(`FEIL: ${upErr.message}\n`);
        errors++;
        await sleep(delayMs);
        continue;
      }
    }

    process.stdout.write(`(${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}) ✓\n`);
    geocoded++;
    await sleep(delayMs);
  }

  console.log();
  console.log('✅ Ferdig!');
  console.log(`   Geocodet  : ${geocoded}`);
  console.log(`   Ikke funnet: ${failed}`);
  if (errors > 0) console.log(`   Feil      : ${errors}`);
  console.log(`\n   Estimert tid for alle uten coords: ${Math.ceil((geocoded + failed) * delayMs / 60000)} min`);
  if (dryRun) console.log('   Kjør uten --dry-run for å lagre');
}

main().catch(err => { console.error('\n❌ Uventet feil:', err); process.exit(1); });
