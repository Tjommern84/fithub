#!/usr/bin/env tsx
/**
 * Validerer hjemmesider for aktive tjenester i databasen.
 *
 * Gjør HEAD-request til hver website. Tjenester som returnerer 404
 * settes til is_active=false (etter bekreftelse / med --apply-flag).
 *
 * Usage:
 *   npx tsx scripts/validate-urls.ts              (rapport, ingen endringer)
 *   npx tsx scripts/validate-urls.ts --apply      (sett is_active=false på 404)
 *   npx tsx scripts/validate-urls.ts --city=oslo
 *   npx tsx scripts/validate-urls.ts --type=pt
 *   npx tsx scripts/validate-urls.ts --concurrency=20
 *
 * Merk: En del nettsteder blokkerer HEAD. Timeouts og 405-svar regnes ikke
 *       som døde URL-er — kun eksplisitt HTTP 404.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

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

const args = process.argv.slice(2);
const applyChanges = args.includes('--apply');
const cityFilter = args.find(a => a.startsWith('--city='))?.split('=')[1]?.toLowerCase() ?? null;
const typeFilter = args.find(a => a.startsWith('--type='))?.split('=')[1] ?? null;
const concurrency = parseInt(args.find(a => a.startsWith('--concurrency='))?.split('=')[1] ?? '10');
const TIMEOUT_MS = 10_000;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ServiceRow = { id: string; name: string; website: string };
type CheckResult = { status: number | null; ok: boolean; error?: string };

async function checkUrl(rawUrl: string): Promise<CheckResult> {
  const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'fithub/1.0 (+https://fithub.no)' },
    });
    clearTimeout(timer);
    return { status: res.status, ok: res.ok };
  } catch (e) {
    clearTimeout(timer);
    const msg = e instanceof Error ? e.message : String(e);
    return { status: null, ok: false, error: msg.slice(0, 80) };
  }
}

async function fetchAll(): Promise<ServiceRow[]> {
  const all: ServiceRow[] = [];
  const BATCH = 1000;
  let from = 0;
  while (true) {
    let q = sb.from('services')
      .select('id, name, website')
      .eq('is_active', true)
      .not('website', 'is', null);
    if (cityFilter) q = q.ilike('city', cityFilter);
    if (typeFilter) q = q.eq('type', typeFilter);
    const { data, error } = await q.range(from, from + BATCH - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of data as { id: string; name: string; website: string | null }[]) {
      if (row.website) all.push({ id: row.id, name: row.name, website: row.website });
    }
    if (data.length < BATCH) break;
    from += BATCH;
  }
  return all;
}

async function processChunk(chunk: ServiceRow[]): Promise<{ id: string; name: string; website: string; result: CheckResult }[]> {
  return Promise.all(
    chunk.map(async svc => ({ ...svc, result: await checkUrl(svc.website) }))
  );
}

async function main() {
  console.log(`URL-validering (concurrency=${concurrency}${applyChanges ? ', --apply' : ', kun rapport'})`);
  if (cityFilter) console.log(`  By-filter: ${cityFilter}`);
  if (typeFilter) console.log(`  Type-filter: ${typeFilter}`);

  const all = await fetchAll();
  console.log(`Fant ${all.length} aktive tjenester med nettside\n`);

  const dead404: ServiceRow[] = [];
  const errors: { svc: ServiceRow; result: CheckResult }[] = [];
  let checked = 0;

  for (let i = 0; i < all.length; i += concurrency) {
    const chunk = all.slice(i, i + concurrency);
    const results = await processChunk(chunk);

    for (const { id, name, website, result } of results) {
      checked++;
      if (result.status === 404) {
        dead404.push({ id, name, website });
        console.log(`  [404] ${name} — ${website}`);
      } else if (!result.ok && result.status === null) {
        errors.push({ svc: { id, name, website }, result });
      }
    }

    if (checked % 100 === 0 || checked === all.length) {
      process.stdout.write(`  Sjekket ${checked}/${all.length}  (${dead404.length} døde)\r`);
    }
  }

  console.log(`\n\nResultat:`);
  console.log(`  Sjekket:      ${checked}`);
  console.log(`  Døde (404):   ${dead404.length}`);
  console.log(`  Feil/timeout: ${errors.length}`);

  if (errors.length > 0 && errors.length <= 20) {
    console.log('\nFeil (timeout/DNS/SSL):');
    for (const { svc, result } of errors) {
      console.log(`  [ERR] ${svc.name} — ${svc.website} (${result.error})`);
    }
  }

  if (dead404.length === 0) {
    console.log('\nIngen 404-sider funnet — databasen er ren!');
    return;
  }

  if (!applyChanges) {
    console.log(`\nKjør med --apply for å sette is_active=false på ${dead404.length} tjenester.`);
    return;
  }

  console.log(`\nDeaktiverer ${dead404.length} tjenester med 404-nettside...`);
  const ids = dead404.map(s => s.id);
  const BATCH = 50;
  let updated = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const { error } = await sb.from('services').update({ is_active: false }).in('id', batch);
    if (error) console.error('  Feil:', error.message);
    else updated += batch.length;
  }
  console.log(`Deaktivert ${updated} tjenester.`);
}

main().catch(console.error);
