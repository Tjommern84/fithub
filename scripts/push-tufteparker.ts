#!/usr/bin/env tsx
/**
 * Push tufteparker fra data/tufteparker.jsonl til Supabase.
 *
 * Usage:
 *   npx tsx scripts/push-tufteparker.ts --dry-run
 *   npx tsx scripts/push-tufteparker.ts
 *   npx tsx scripts/push-tufteparker.ts --city=bergen
 */

import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

loadEnvConfig(process.cwd());

const args = process.argv.slice(2);
const DRY_RUN    = args.includes('--dry-run');
const cityFilter = args.find(a => a.startsWith('--city='))?.split('=')[1]?.toLowerCase() ?? null;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const inFile = join(process.cwd(), 'data', 'tufteparker.jsonl');

function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 50);
}

async function main() {
  console.log('🌳 FitHub – push tufteparker til Supabase');
  if (DRY_RUN) console.log('   [DRY RUN]\n');

  if (!existsSync(inFile)) {
    console.error(`❌ ${inFile} finnes ikke — kjør find-tufteparker.ts først`);
    process.exit(1);
  }

  const lines = readFileSync(inFile, 'utf-8').split('\n').filter(Boolean);
  const records = lines.map(l => JSON.parse(l) as {
    name: string; address: string; city: string;
    lat: number; lon: number; phone: string | null; website: string | null;
    rating: number; ratingCount: number; tags: string[];
  });

  const filtered = cityFilter ? records.filter(r => r.city === cityFilter) : records;

  // Dedupliser på navn+by
  const seen = new Set<string>();
  const unique = filtered.filter(r => {
    const key = `${r.name.toLowerCase()}_${r.city}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`   ${unique.length} unike tufteparker (av ${filtered.length} totalt)\n`);

  let added = 0, errors = 0;

  for (const r of unique) {
    const id = `tu_${r.city}_${slugify(r.name)}`.slice(0, 85);

    const serviceRow = {
      id,
      name: r.name,
      type: 'outdoor',
      main_category: 'aktivitet-sport',
      description: `Gratis utendørs treningsplass i ${r.city.charAt(0).toUpperCase() + r.city.slice(1)}.`,
      address: r.address || null,
      city: r.city,
      phone: r.phone,
      website: r.website,
      rating_avg: r.rating ?? 0,
      rating_count: r.ratingCount ?? 0,
      is_active: true,
      tags: r.tags,
      goals: ['strength', 'weight_loss', 'start', 'endurance'],
      venues: ['outdoor'],
      price_level: 'low',
      owner_user_id: null,
    };

    if (DRY_RUN) {
      console.log(`  [DRY] ${r.name} (${r.city})`);
      added++;
      continue;
    }

    const { error } = await supabase
      .from('services')
      .upsert(serviceRow, { onConflict: 'id' });

    if (error) { console.error(`  ✗ ${r.name}: ${error.message}`); errors++; continue; }

    if (r.lat && r.lon) {
      await supabase.from('services')
        .update({ base_location: `SRID=4326;POINT(${r.lon} ${r.lat})` })
        .eq('id', id);
    }

    await supabase.from('service_coverage')
      .upsert({ service_id: id, type: 'city', city: r.city }, { onConflict: 'service_id,type,city' });

    await supabase.from('service_types')
      .upsert({ service_id: id, type: 'outdoor' }, { onConflict: 'service_id,type' });

    added++;
  }

  console.log(`\n✅ Ferdig! Lagt til: ${added}  Feil: ${errors}`);
  if (DRY_RUN) console.log('   Kjør uten --dry-run for å lagre');
}

main().catch(err => { console.error('❌', err); process.exit(1); });
