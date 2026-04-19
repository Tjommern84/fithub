#!/usr/bin/env tsx
/**
 * Berik idrettslag med idretter basert på klubbnavn — null API-kostnad.
 *
 * Parser navn og beskrivelse lokalt med et norsk idrettsnøkkelord-kart.
 * Oppdaterer tags + service_types i Supabase.
 *
 * Eksempler:
 *   "Konnerud Idrettslag"      → ['langrenn','ski','fotball','handball','idrettslag']
 *   "Drammen Skiklub"          → ['langrenn','ski','idrettslag']
 *   "Viking FK"                → ['fotball','idrettslag']
 *   "Bækkelaget Sportsklub"    → ['fotball','handball','idrettslag']
 *
 * Usage:
 *   npx tsx scripts/enrich-clubs-names.ts
 *   npx tsx scripts/enrich-clubs-names.ts --dry-run
 *   npx tsx scripts/enrich-clubs-names.ts --type=sport      (bare sport-type)
 *   npx tsx scripts/enrich-clubs-names.ts --all-types       (alle tjenestetyper)
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// ─── Nøkkelordkart ────────────────────────────────────────────────────────
// Substring-matching (lavcase) → tag.
// Rekkefølge: spesifikke termer før generelle for å unngå feil.
const KEYWORDS: Array<{ terms: string[]; tag: string }> = [
  // Ski / vinter — spesifikke først
  { terms: ['langrenn', 'skiclub', 'skiklubb', 'skiforening', 'langrenn'], tag: 'langrenn' },
  { terms: ['skiskyting', 'biathlon'], tag: 'skiskyting' },
  { terms: ['skihopp', 'hoppbakke'], tag: 'skihopp' },
  { terms: ['alpint', 'slalåm', 'slalom', 'alpinklubb'], tag: 'alpint' },
  { terms: ['telemark'], tag: 'telemark' },
  { terms: ['skøyteklubb', 'skøytere', 'skøyter', 'skøyte'], tag: 'skøyter' },
  { terms: ['ishockey', 'ice hockey', 'hockeyklubb'], tag: 'ishockey' },
  { terms: ['bandy'], tag: 'bandy' },
  { terms: ['curling'], tag: 'curling' },
  { terms: ['skilag', 'skil ', ' ski ', 'skiklub'], tag: 'ski' },

  // Ball-idretter
  { terms: ['fotball', 'fotballklubb', 'football', 'soccer'], tag: 'fotball' },
  { terms: ['håndball', 'handball', 'håndballklubb'], tag: 'handball' },
  { terms: ['basketball', 'basketballklubb', 'basketklubb'], tag: 'basket' },
  { terms: ['volleyball', 'volleyballklubb'], tag: 'volleyball' },
  { terms: ['rugby'], tag: 'rugby' },
  { terms: ['amerikansk fotball', 'american football'], tag: 'amerikansk-fotball' },
  { terms: ['cricket'], tag: 'cricket' },
  { terms: ['baseball', 'softball'], tag: 'baseball' },
  { terms: ['rundballe'], tag: 'rundballe' },

  // Vann
  { terms: ['svømming', 'svømmeklubb', 'svømmeklub', 'svømmere'], tag: 'svomming' },
  { terms: ['roklubb', 'rorklub', ' roing'], tag: 'roing' },
  { terms: ['kajak', 'kajakklubb', 'kano', 'padleklubb'], tag: 'kajak' },
  { terms: ['seilforening', 'seilklubb', 'seiling', 'båtforening'], tag: 'seiling' },
  { terms: ['vannpolo', 'vannsport'], tag: 'vannsport' },
  { terms: ['dykkerklubb', 'dykking'], tag: 'dykking' },
  { terms: ['surfeklubb', 'surfe', 'surfing'], tag: 'surf' },

  // Friidrett / løp / sykkel
  { terms: ['friidrett', 'atletikk', 'athletics'], tag: 'friidrett' },
  { terms: ['triathlon', 'triatlon'], tag: 'triathlon' },
  { terms: ['maraton', 'marathon', 'løpeklubb', 'løpegruppe'], tag: 'løping' },
  { terms: ['sykkelklubb', 'sykelklubb', 'sykling', 'cycling'], tag: 'sykling' },

  // Kampsport
  { terms: ['judoklubb', 'judoklub', 'judo'], tag: 'judo' },
  { terms: ['karateklubb', 'karateклуб', 'karate'], tag: 'karate' },
  { terms: ['taekwondo', 'taekwondoklubb'], tag: 'taekwondo' },
  { terms: ['bokseklubb', 'boksing', 'boxing'], tag: 'boksing' },
  { terms: ['bryte', 'bryting', 'wrestling'], tag: 'bryting' },
  { terms: ['fekting', 'fencing'], tag: 'fekting' },
  { terms: ['jiu-jitsu', 'jiujitsu', 'bjj'], tag: 'jiu-jitsu' },
  { terms: ['aikido', 'kampsport', 'martial arts'], tag: 'kampsport' },

  // Racket
  { terms: ['tennisklubb', 'tennisklub', 'tennis'], tag: 'tennis' },
  { terms: ['badminton'], tag: 'badminton' },
  { terms: ['bordtennis', 'ping pong', 'pingpong'], tag: 'bordtennis' },
  { terms: ['squash'], tag: 'squash' },
  { terms: ['padel'], tag: 'padel' },
  { terms: ['pickleball'], tag: 'pickleball' },

  // Hest / natur
  { terms: ['rideklubb', 'rideforbund', 'ridning', 'hestesport', 'rytterklubb'], tag: 'ridning' },
  { terms: ['orienteringsklubb', 'orientering'], tag: 'orientering' },
  { terms: ['klatreklubb', 'klatring', 'klatrering'], tag: 'klatring' },
  { terms: ['skytterklubb', 'skytterlag', 'skyting', 'pistolklubb'], tag: 'skyting' },
  { terms: ['bueskytting', 'bueskyting', 'bueskytte'], tag: 'bueskyting' },
  { terms: ['friluftsliv'], tag: 'friluftsliv' },
  { terms: ['motorsport', 'motorsykkel', 'autosport', 'raceklubb'], tag: 'motorsport' },

  // Gym / dans / turn
  { terms: ['turnforening', 'turnlag', 'turnklubb', 'turnere', 'turnklub', 'gymnastikk', 'turn '], tag: 'turn' },
  { terms: ['dansklubb', 'danseklubb', 'danselag', 'danse', 'dans '], tag: 'dans' },
  { terms: ['innebandy', 'floorball'], tag: 'innebandy' },
  { terms: ['golfklubb', 'golfklub', 'golf'], tag: 'golf' },
  { terms: ['esport', 'e-sport'], tag: 'esport' },
  { terms: ['sjakk', 'chess'], tag: 'sjakk' },
  { terms: ['bowling'], tag: 'bowling' },
  { terms: ['dart'], tag: 'dart' },

  // Idrettslag-markør (alltid sist)
  { terms: ['idrettslag', 'idrettsklubb', 'sportsklub', 'sportsklubb', 'sportsforening', 'idrettsforening'], tag: 'idrettslag' },
];

function inferTags(text: string): string[] {
  const lower = ` ${text.toLowerCase()} `;
  const found = new Set<string>();
  for (const { terms, tag } of KEYWORDS) {
    if (terms.some(t => lower.includes(t))) found.add(tag);
  }
  return Array.from(found);
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('🏅  SettDegEtMål – namnbasert idrettsenrichment (nullkostnad)');
  if (dryRun) console.log('   [DRY RUN – ingen endringer lagres]');
  if (typeFilter) console.log(`   Filter: type=${typeFilter}`);
  console.log();

  if (!SUPABASE_URL) { console.error('❌ NEXT_PUBLIC_SUPABASE_URL mangler'); process.exit(1); }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Hent aktuelle tjenester
  let query = supabase
    .from('services')
    .select('id, name, description, tags, type')
    .eq('is_active', true)
    .order('id');

  if (typeFilter) query = query.eq('type', typeFilter);

  const { data: services, error } = await query;
  if (error) { console.error('❌ Supabase-feil:', error.message); process.exit(1); }
  if (!services?.length) { console.log('Ingen tjenester funnet.'); return; }

  console.log(`📋 ${services.length} tjenester å analysere\n`);

  let updated = 0, skipped = 0, errors = 0;

  for (let i = 0; i < services.length; i++) {
    const svc = services[i];
    const searchText = `${svc.name} ${svc.description ?? ''}`;
    const inferred = inferTags(searchText);
    const existing: string[] = svc.tags ?? [];
    const toAdd = inferred.filter(t => !existing.includes(t));

    if (toAdd.length === 0) { skipped++; continue; }

    process.stdout.write(`[${i + 1}/${services.length}] ${svc.name} +[${toAdd.join(', ')}] `);

    const merged = Array.from(new Set([...existing, ...inferred]));

    if (!dryRun) {
      const { error: upErr } = await supabase
        .from('services')
        .update({ tags: merged })
        .eq('id', svc.id);

      if (upErr) {
        process.stdout.write(`FEIL: ${upErr.message}\n`);
        errors++;
        continue;
      }

      // Oppdater service_types for sport-tags
      for (const tag of toAdd) {
        if (tag === 'idrettslag') continue;
        await supabase.from('service_types')
          .upsert({ service_id: svc.id, type: tag, is_primary: false },
            { onConflict: 'service_id,type', ignoreDuplicates: true });
      }
    }

    process.stdout.write('✓\n');
    updated++;
  }

  console.log();
  console.log('✅ Ferdig!');
  console.log(`   Oppdatert  : ${updated}`);
  console.log(`   Ingen nye  : ${skipped}`);
  if (errors > 0) console.log(`   Feil       : ${errors}`);
  if (dryRun) console.log('\n   Kjør uten --dry-run for å lagre');
}

main().catch(err => { console.error('\n❌ Uventet feil:', err); process.exit(1); });
