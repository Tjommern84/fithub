#!/usr/bin/env tsx
/**
 * Setter website='https://www.freshfitness.no' på alle Fresh Fitness-oppføringer i DB.
 *
 * Usage:
 *   npx tsx scripts/set-fresh-website.ts --dry-run
 *   npx tsx scripts/set-fresh-website.ts
 */
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';

loadEnvConfig(process.cwd());

const DRY_RUN = process.argv.includes('--dry-run');
const WEBSITE = 'https://www.freshfitness.no';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function main() {
  console.log(`\nset-fresh-website${DRY_RUN ? '  DRY RUN' : ''}\n`);

  const { data, error } = await supabase
    .from('services')
    .select('id, name, website')
    .ilike('name', '%fresh%');

  if (error) { console.error('DB-feil:', error); process.exit(1); }

  const entries = data ?? [];
  console.log(`Fant ${entries.length} Fresh-oppføringer i DB:\n`);

  const needsUpdate = entries.filter((s) => s.website !== WEBSITE);
  const alreadySet  = entries.filter((s) => s.website === WEBSITE);

  for (const s of entries) {
    const status = s.website === WEBSITE ? '✅ allerede satt' : '🔧 oppdateres';
    console.log(`  ${status}  ${s.id}  ${s.name}`);
  }

  if (needsUpdate.length === 0) {
    console.log('\nAlle har allerede riktig website. Ingenting å gjøre.\n');
    return;
  }

  console.log(`\nOppdaterer ${needsUpdate.length} oppføringer (${alreadySet.length} allerede korrekte)...\n`);

  if (DRY_RUN) {
    console.log('[dry-run] Ingen endringer skrevet.\n');
    return;
  }

  const { error: updErr, count } = await supabase
    .from('services')
    .update({ website: WEBSITE })
    .ilike('name', '%fresh%')
    .neq('website', WEBSITE);

  if (updErr) {
    console.error('Feil ved oppdatering:', updErr.message);
    process.exit(1);
  }

  console.log(`✅ Oppdaterte ${count ?? needsUpdate.length} oppføringer med website=${WEBSITE}\n`);
}

main().catch(console.error);
