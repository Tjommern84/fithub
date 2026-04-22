#!/usr/bin/env tsx
/**
 * Berik idrettslag i databasen med idretter fra BRREG (gratis API).
 *
 * For hver klubb med orgnr: henter formålsbeskrivelse fra api.brreg.no,
 * parser norske idrettsnøkkelord, og oppdaterer tags i Supabase.
 * Null API-kostnad — BRREG er åpent og gratis.
 *
 * Usage:
 *   npx tsx scripts/enrich-clubs-brreg.ts
 *   npx tsx scripts/enrich-clubs-brreg.ts --dry-run
 *   npx tsx scripts/enrich-clubs-brreg.ts --limit=50
 *   npx tsx scripts/enrich-clubs-brreg.ts --delay=300
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

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
const args    = process.argv.slice(2);
const dryRun  = args.includes('--dry-run');
const limit   = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0') || 0;
const delayMs = parseInt(args.find(a => a.startsWith('--delay='))?.split('=')[1] ?? '300');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// ── Sport keyword map ─────────────────────────────────────────────────────
// Nøkkelord → tag som legges til services.tags
const SPORT_KEYWORDS: Record<string, string> = {
  fotball: 'fotball',
  håndball: 'handball',
  handball: 'handball',
  basket: 'basket',
  basketball: 'basket',
  volleyball: 'volleyball',
  svømming: 'svomming',
  svomming: 'svomming',
  tennis: 'tennis',
  badminton: 'badminton',
  golf: 'golf',
  langrenn: 'langrenn',
  ski: 'ski',
  alpint: 'alpint',
  skihopp: 'skihopp',
  skiskyting: 'skiskyting',
  friidrett: 'friidrett',
  atletikk: 'friidrett',
  sykling: 'sykling',
  sykkel: 'sykling',
  roing: 'roing',
  kajak: 'kajak',
  kano: 'kajak',
  fekting: 'fekting',
  boksing: 'boksing',
  bryting: 'bryting',
  judo: 'judo',
  karate: 'kampsport',
  taekwondo: 'kampsport',
  kampsport: 'kampsport',
  ishockey: 'ishockey',
  bandy: 'bandy',
  curling: 'curling',
  innebandy: 'innebandy',
  squash: 'squash',
  bordtennis: 'bordtennis',
  rugby: 'rugby',
  amerikansk: 'amerikansk-fotball',
  orientering: 'orientering',
  skyting: 'skyting',
  ridning: 'ridning',
  hest: 'ridning',
  turn: 'turn',
  gymnastikk: 'turn',
  dans: 'dans',
  seiling: 'seiling',
  klatring: 'klatring',
  triathlon: 'triathlon',
  triatan: 'triathlon',
  motorsport: 'motorsport',
  dartsklubb: 'dart',
  sjakk: 'sjakk',
  cricket: 'cricket',
  baseball: 'baseball',
  softball: 'baseball',
  floorball: 'innebandy',
  padel: 'padel',
  rulleskøyter: 'rulleskøyter',
  skøyter: 'skøyter',
  esport: 'esport',
  esports: 'esport',
};

// Søk gjennom tekst og finn alle matchende sport-tags
function extractSportTags(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const [keyword, tag] of Object.entries(SPORT_KEYWORDS)) {
    if (lower.includes(keyword)) found.add(tag);
  }
  return Array.from(found);
}

// ── BRREG API ─────────────────────────────────────────────────────────────
interface BrregUnit {
  navn?: string;
  organisasjonsform?: { beskrivelse?: string };
  vedtektsfestetFormaal?: string[];
  aktivitet?: string[];
  naeringskode1?: { beskrivelse?: string };
}

async function fetchBrregUnit(orgnr: string): Promise<BrregUnit | null> {
  try {
    const url = `https://data.brreg.no/enhetsregisteret/api/enheter/${orgnr}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return await res.json() as BrregUnit;
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('🏅  FitHub – berik idrettslag via BRREG');
  if (dryRun) console.log('   [DRY RUN – ingen endringer lagres]');
  console.log();

  if (!SUPABASE_URL) { console.error('❌ NEXT_PUBLIC_SUPABASE_URL mangler'); process.exit(1); }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Hent alle aktive sport-tjenester med orgnr
  const { data: clubs, error } = await supabase
    .from('services')
    .select('id, name, orgnr, tags, description')
    .eq('is_active', true)
    .eq('type', 'sport')
    .not('orgnr', 'is', null)
    .order('id');

  if (error) { console.error('❌ Supabase-feil:', error.message); process.exit(1); }
  if (!clubs || clubs.length === 0) { console.log('Ingen sport-tjenester med orgnr funnet.'); return; }

  const toProcess = limit > 0 ? clubs.slice(0, limit) : clubs;
  console.log(`📋 ${clubs.length} idrettslag med orgnr — behandler ${toProcess.length}`);
  console.log();

  let updated = 0, skipped = 0, noData = 0, errors = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const club = toProcess[i];
    process.stdout.write(`[${i + 1}/${toProcess.length}] ${club.name} (${club.orgnr}) … `);

    const unit = await fetchBrregUnit(club.orgnr);
    if (!unit) {
      process.stdout.write('ikke funnet\n');
      noData++;
      await sleep(delayMs);
      continue;
    }

    // Bygg søketekst fra alle tilgjengelige felter
    const searchText = [
      unit.navn ?? '',
      ...(unit.vedtektsfestetFormaal ?? []),
      ...(unit.aktivitet ?? []),
      unit.naeringskode1?.beskrivelse ?? '',
      club.name,
      club.description ?? '',
    ].join(' ');

    const newSportTags = extractSportTags(searchText);
    const existingTags: string[] = club.tags ?? [];

    // Slå sammen — behold eksisterende, legg til nye
    const mergedTags = Array.from(new Set([...existingTags, ...newSportTags]));
    const addedTags = newSportTags.filter(t => !existingTags.includes(t));

    if (addedTags.length === 0) {
      process.stdout.write(`ingen nye tags\n`);
      skipped++;
      await sleep(delayMs);
      continue;
    }

    process.stdout.write(`+[${addedTags.join(', ')}] `);

    if (!dryRun) {
      const { error: upErr } = await supabase
        .from('services')
        .update({ tags: mergedTags })
        .eq('id', club.id);
      if (upErr) {
        process.stdout.write(`FEIL: ${upErr.message}\n`);
        errors++;
        await sleep(delayMs);
        continue;
      }
    }

    process.stdout.write('✓\n');
    updated++;
    await sleep(delayMs);
  }

  console.log();
  console.log('✅ Ferdig!');
  console.log(`   Oppdatert   : ${updated}`);
  console.log(`   Ingen nye   : ${skipped}`);
  console.log(`   Ikke i BRREG: ${noData}`);
  if (errors > 0) console.log(`   Feil        : ${errors}`);
  if (dryRun) console.log('\n   (Ingen endringer lagret — kjør uten --dry-run)');
}

main().catch(err => { console.error('\n❌ Uventet feil:', err); process.exit(1); });
