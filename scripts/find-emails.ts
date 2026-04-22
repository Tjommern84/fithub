#!/usr/bin/env tsx
/**
 * Finn epostadresser for tjenester som mangler email.
 *
 * Strategi (nullkostnad):
 *   1. BRREG API (orgnr) — mange org har epost i registeret
 *   2. Hjemmeside-scraping — parse mailto: fra eksisterende website
 *
 * Usage:
 *   npx tsx scripts/find-emails.ts --dry-run --limit=20
 *   npx tsx scripts/find-emails.ts --type=sport
 *   npx tsx scripts/find-emails.ts --skip-brreg     (kun scraping)
 *   npx tsx scripts/find-emails.ts --skip-scrape    (kun BRREG)
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

const args       = process.argv.slice(2);
const dryRun     = args.includes('--dry-run');
const skipBrreg  = args.includes('--skip-brreg');
const skipScrape = args.includes('--skip-scrape');
const typeFilter = args.find(a => a.startsWith('--type='))?.split('=')[1] ?? null;
const limit      = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0') || 0;
const delayMs    = parseInt(args.find(a => a.startsWith('--delay='))?.split('=')[1] ?? '500');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// ── Epost-validering ──────────────────────────────────────────────────────
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const EMAIL_BLOCKLIST = [
  'example.com', 'example.no', 'test.no', 'noreply', 'no-reply',
  'placeholder', 'din@', 'your@', 'email@email', 'mail@mail',
  'info@domain', 'post@domain', 'kontakt@domain',
  'sentry.io', 'wixpress.com', 'squarespace.com', 'wordpress.com',
];

function isValidEmail(email: string): boolean {
  if (!email || email.length > 100) return false;
  if (EMAIL_BLOCKLIST.some(b => email.toLowerCase().includes(b))) return false;
  if (email.includes('..')) return false;
  return true;
}

// Trekk ut beste epost fra tekst — prioriter info@, post@, kontakt@
function extractBestEmail(text: string): string | null {
  const matches = [...new Set(text.match(EMAIL_RE) ?? [])].filter(isValidEmail);
  if (!matches.length) return null;
  const priority = matches.find(e => /^(info|post|kontakt|hei|hello|support)@/i.test(e));
  return priority ?? matches[0];
}

// ── BRREG ─────────────────────────────────────────────────────────────────
interface BrregUnit {
  epostadresse?: string;
  hjemmeside?: string;
}

async function fetchBrregEmail(orgnr: string): Promise<{ email: string | null; website: string | null }> {
  try {
    const res = await fetch(`https://data.brreg.no/enhetsregisteret/api/enheter/${orgnr}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { email: null, website: null };
    const d = await res.json() as BrregUnit;
    const email = d.epostadresse && isValidEmail(d.epostadresse) ? d.epostadresse : null;
    const website = d.hjemmeside ?? null;
    return { email, website };
  } catch {
    return { email: null, website: null };
  }
}

// ── Website-scraping ──────────────────────────────────────────────────────
async function scrapeEmailFromWebsite(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FitHub/1.0)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const html = await res.text();

    // 1. Prioriter mailto:-lenker
    const mailtoMatches = [...html.matchAll(/mailto:([^"'\s?#>]+)/gi)]
      .map(m => m[1].split('?')[0].trim())
      .filter(isValidEmail);

    if (mailtoMatches.length > 0) {
      const priority = mailtoMatches.find(e => /^(info|post|kontakt|hei|hello|support)@/i.test(e));
      return priority ?? mailtoMatches[0];
    }

    // 2. Fallback: søk i rå HTML-tekst
    return extractBestEmail(html);
  } catch {
    return null;
  }
}

// Prøv også /kontakt og /contact sider
async function scrapeEmailWithContactPage(baseUrl: string): Promise<string | null> {
  const email = await scrapeEmailFromWebsite(baseUrl);
  if (email) return email;

  const base = baseUrl.replace(/\/$/, '');
  for (const path of ['/kontakt', '/contact', '/om-oss', '/about', '/kontaktoss']) {
    const email2 = await scrapeEmailFromWebsite(`${base}${path}`);
    if (email2) return email2;
    await sleep(300);
  }
  return null;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('📧  FitHub – finn epostadresser (nullkostnad)');
  if (dryRun)     console.log('   [DRY RUN – ingen endringer lagres]');
  if (skipBrreg)  console.log('   Hopper over BRREG-oppslag');
  if (skipScrape) console.log('   Hopper over website-scraping');
  if (typeFilter) console.log(`   Filter: type=${typeFilter}`);
  console.log();

  if (!SUPABASE_URL) { console.error('❌ NEXT_PUBLIC_SUPABASE_URL mangler'); process.exit(1); }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Hent tjenester uten epost
  let query = supabase
    .from('services')
    .select('id, name, orgnr, website, city, type')
    .eq('is_active', true)
    .or('email.is.null,email.eq.')
    .order('rating_avg', { ascending: false, nullsFirst: false });

  if (typeFilter) query = query.eq('type', typeFilter);
  if (limit > 0) query = query.limit(limit);
  else query = query.limit(2000);

  const { data: services, error } = await query;
  if (error) { console.error('❌ Supabase-feil:', error.message); process.exit(1); }
  if (!services?.length) { console.log('Alle tjenester har allerede epost.'); return; }

  console.log(`📋 ${services.length} tjenester uten epost\n`);

  let fromBrreg = 0, fromScrape = 0, notFound = 0, errors = 0;

  for (let i = 0; i < services.length; i++) {
    const svc = services[i];
    process.stdout.write(`[${i + 1}/${services.length}] ${svc.name.slice(0, 40).padEnd(40)} `);

    let email: string | null = null;
    let websiteToSave: string | null = null;
    let source = '';

    // ── 1. BRREG ────────────────────────────────────────────────────────
    if (!skipBrreg && svc.orgnr) {
      const brreg = await fetchBrregEmail(svc.orgnr);
      if (brreg.email) {
        email = brreg.email;
        source = 'BRREG';
        fromBrreg++;
      }
      // Bonus: BRREG har ofte hjemmeside også
      if (!svc.website && brreg.website) {
        websiteToSave = brreg.website;
      }
      await sleep(delayMs);
    }

    // ── 2. Website-scraping ───────────────────────────────────────────
    if (!email && !skipScrape && svc.website) {
      try {
        email = await scrapeEmailWithContactPage(svc.website);
        if (email) { source = 'scrape'; fromScrape++; }
      } catch {
        errors++;
      }
      await sleep(300);
    }

    if (!email) {
      process.stdout.write('–\n');
      notFound++;
      continue;
    }

    process.stdout.write(`${source}: ${email}\n`);

    if (!dryRun) {
      const update: Record<string, string> = { email };
      if (websiteToSave) update.website = websiteToSave;

      const { error: upErr } = await supabase
        .from('services')
        .update(update)
        .eq('id', svc.id);

      if (upErr) {
        console.error(`  ✗ ${upErr.message}`);
        errors++;
      }
    }
  }

  console.log();
  console.log('✅ Ferdig!');
  console.log(`   Fra BRREG   : ${fromBrreg}`);
  console.log(`   Fra scraping: ${fromScrape}`);
  console.log(`   Ikke funnet : ${notFound}`);
  if (errors > 0) console.log(`   Feil        : ${errors}`);
  if (dryRun) console.log('\n   Kjør uten --dry-run for å lagre');
}

main().catch(err => { console.error('\n❌ Uventet feil:', err); process.exit(1); });
