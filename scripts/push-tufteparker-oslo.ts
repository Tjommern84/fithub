#!/usr/bin/env tsx
/**
 * Importer Oslos tufteparker til Supabase.
 *
 * Usage:
 *   npx tsx scripts/push-tufteparker-oslo.ts --dry-run
 *   npx tsx scripts/push-tufteparker-oslo.ts
 */
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';

loadEnvConfig(process.cwd());

const DRY_RUN = process.argv.includes('--dry-run');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Oslo sentrum som fallback for parker uten nøyaktige koordinater
const OSLO = { lat: 59.9139, lon: 10.7522 };

function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50);
}

const PARKS: { name: string; address: string | null; note?: string }[] = [
  { name: 'Kollenparken',                         address: 'Kongeveien 5, Oslo' },
  { name: 'Kollparken',                           address: 'Oslo' },
  { name: 'Forskningsparken',                     address: 'Oslo' },
  { name: 'Voldsløkka idrettspark',               address: 'Stavangergata, Oslo' },
  { name: 'Frognerbadet',                         address: 'Oslo' },
  { name: 'Marienlystparken',                     address: 'Oslo' },
  { name: 'Sophus Bugges plass',                  address: 'Oslo' },
  { name: 'Tåsen idrettslag',                     address: 'Oslo' },
  { name: 'St. Hanshaugen tuftepark',             address: 'Geitmyrsveien, Oslo' },
  { name: 'Torshovdalen tuftepark',               address: 'Fagerheimgata 31, Oslo' },
  { name: 'Tufteparken Tinkern',                  address: 'Framnesveien, Oslo' },
  { name: 'Kristparken',                          address: 'Oslo' },
  { name: 'Sørengkaia Takterrasse',               address: 'Sørengkaia 8, Oslo', note: 'Kun for beboere på Sørenga' },
  { name: 'Fillipstad tuftepark',                 address: 'Fillipstadkaia 11, Oslo' },
  { name: 'Tufteparken Løren',                    address: 'Ullagerveien 15, Oslo' },
  { name: 'Lambertseter natur- og aktivitetspark',address: 'Lambertseterveien 35, Oslo' },
  { name: 'Skullerud park',                       address: 'Olaf Helsets vei 5, Oslo' },
  { name: 'Naboparken',                           address: 'Linderudveien 33, Oslo' },
];

async function main() {
  console.log('🌳 FitHub – importer Oslos tufteparker');
  if (DRY_RUN) console.log('   [DRY RUN – ingen endringer lagres]\n');

  let added = 0, errors = 0;

  for (const park of PARKS) {
    const id = `tp_oslo_${slugify(park.name)}`;
    const description = park.note
      ? `Utendørs tuftepark i Oslo. ${park.note}.`
      : 'Gratis utendørs treningsplass med fast utstyr i Oslo.';

    const serviceRow = {
      id,
      name: park.name,
      type: 'outdoor',
      main_category: 'aktivitet-sport',
      description,
      address: park.address,
      city: 'oslo',
      phone: null,
      website: null,
      rating_avg: 0,
      rating_count: 0,
      is_active: true,
      tags: ['tuftepark', 'utetrening', 'styrke', 'gratis'],
      goals: ['strength', 'weight_loss', 'start', 'endurance'],
      venues: ['outdoor'],
      price_level: 'low',
      owner_user_id: null,
    };

    console.log(`  ${DRY_RUN ? '[DRY]' : '→'} ${park.name}`);
    if (DRY_RUN) { added++; continue; }

    const { error } = await supabase
      .from('services')
      .upsert(serviceRow, { onConflict: 'id' });

    if (error) {
      console.error(`    ✗ ${error.message}`);
      errors++;
      continue;
    }

    await supabase
      .from('services')
      .update({ base_location: `SRID=4326;POINT(${OSLO.lon} ${OSLO.lat})` })
      .eq('id', id);

    await supabase
      .from('service_coverage')
      .upsert({ service_id: id, type: 'city', city: 'oslo' }, { onConflict: 'service_id,type,city' })
      .throwOnError();

    await supabase
      .from('service_types')
      .upsert({ service_id: id, type: 'outdoor' }, { onConflict: 'service_id,type' });

    added++;
  }

  console.log(`\n✅ Ferdig! Lagt til: ${added}  Feil: ${errors}`);
  if (DRY_RUN) console.log('   Kjør uten --dry-run for å lagre til Supabase');
}

main().catch(err => { console.error('\n❌ Feil:', err); process.exit(1); });
