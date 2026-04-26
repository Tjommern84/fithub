#!/usr/bin/env tsx
/**
 * Copy coordinates from brreg_entities → services.base_location.
 * For services that already have brreg_entities.location: copy directly.
 * For services without: geocode from address, update brreg_entities first, then services.
 *
 * Usage:
 *   npm run brreg:geocode-services              (all, limit 500)
 *   npm run brreg:geocode-services -- --limit=50
 *   npm run brreg:geocode-services -- --dry-run
 */

import { loadEnvConfig } from '@next/env';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { NominatimGeocoder } from '../lib/brreg/geocoder';

loadEnvConfig(process.cwd());

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const ALL = args.includes('--all');
const LIMIT = ALL ? Infinity : (parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? '500') || 500);
const BATCH = 500; // Supabase max per request

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type ServiceRow = {
  id: string;
  orgnr: string;
  address: string | null;
};

async function fetchBatch(offset: number): Promise<ServiceRow[]> {
  const { data, error } = await supabase
    .from('services')
    .select('id, orgnr, address')
    .not('orgnr', 'is', null)
    .is('base_location', null)
    .not('address', 'is', null)
    .range(offset, offset + BATCH - 1);
  if (error) { console.error('Failed to fetch services:', error); process.exit(1); }
  return (data ?? []) as ServiceRow[];
}

async function main() {
  console.log(`geocode-brreg-services${ALL ? '  --all' : `  limit=${LIMIT}`}${DRY_RUN ? '  DRY RUN' : ''}\n`);

  const geocoder = new NominatimGeocoder();
  let geocoded = 0;
  let failed = 0;
  let total = 0;
  const failures: Array<{ id: string; orgnr: string; address: string; reason: string }> = [];

  let offset = 0;
  let remaining = LIMIT;

  while (remaining > 0) {
    const rows = await fetchBatch(offset);
    if (rows.length === 0) break;

    total += rows.length;
    const batchEnd = Math.min(rows.length, remaining);

    for (let i = 0; i < batchEnd; i++) {
      const svc = rows[i];
      process.stdout.write(`\r  batch offset=${offset}  ${i + 1}/${rows.length}  total geocoded=${geocoded}  failed=${failed}`);

      if (DRY_RUN) {
        console.log(`\n  [dry] ${svc.id}  "${svc.address}"`);
        continue;
      }

      const cleanAddress = svc.address!.replace(/^(c\/o|v\/)\s*[^,]+,\s*/i, '');
      const result = await geocoder.geocode(cleanAddress);
      if (!result) {
        failed++;
        failures.push({ id: svc.id, orgnr: svc.orgnr, address: svc.address!, reason: 'nominatim_no_result' });
        continue;
      }

      const { error } = await supabase
        .from('services')
        .update({ base_location: `SRID=4326;POINT(${result.lon} ${result.lat})` })
        .eq('id', svc.id);

      if (error) {
        failed++;
        failures.push({ id: svc.id, orgnr: svc.orgnr, address: svc.address!, reason: error.message });
      } else {
        geocoded++;
      }
    }

    offset += rows.length;
    remaining -= rows.length;
    if (rows.length < BATCH) break; // last page
  }

  process.stdout.write('\n');
  console.log(`\nFerdig.  Geocodet: ${geocoded}  Feilet: ${failed}  Totalt sett: ${total}`);

  if (failures.length > 0) {
    const outPath = path.join(process.cwd(), 'data', 'geocode-failures.jsonl');
    const lines = failures.map((f) => JSON.stringify(f)).join('\n') + '\n';
    fs.appendFileSync(outPath, lines, 'utf-8');
    console.log(`Feilliste lagret: ${outPath}`);
  }
}

main().catch(console.error);
