#!/usr/bin/env tsx
/**
 * Parser og inserter para-idrettsklubb-data fra Vestfold og Telemark idrettskrets.
 * Kilde: ressurser/paraidret norge.txt
 *
 * Usage:
 *   npx tsx scripts/push-paraidrett.ts --dry-run
 *   npx tsx scripts/push-paraidrett.ts
 */
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

loadEnvConfig(process.cwd());

const DRY_RUN = process.argv.includes('--dry-run');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Municipality → city key (must match cityCoordinates in lib/matching.ts)
const MUNI_TO_CITY: Record<string, string> = {
  bamble: 'porsgrunn',
  drangedal: 'skien',
  fyresdal: 'skien',
  'færder': 'tønsberg',
  hjartdal: 'skien',
  holmestrand: 'horten',
  horten: 'horten',
  'kragerø': 'porsgrunn',
  kviteseid: 'skien',
  larvik: 'larvik',
  'midt-telemark': 'skien',
  nissedal: 'porsgrunn',
  nome: 'skien',
  notodden: 'notodden',
  porsgrunn: 'porsgrunn',
  sandefjord: 'sandefjord',
  seljord: 'skien',
  siljan: 'skien',
  skien: 'skien',
  tinn: 'skien',
  tokke: 'skien',
  'tønsberg': 'tønsberg',
  vinje: 'skien',
};

// City center coordinates (superset of lib/matching.ts — notodden not in main list)
const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  horten: { lat: 59.4167, lon: 10.4833 },
  'tønsberg': { lat: 59.2669, lon: 10.4076 },
  sandefjord: { lat: 59.1310, lon: 10.2167 },
  larvik: { lat: 59.0561, lon: 10.0289 },
  porsgrunn: { lat: 59.1404, lon: 9.6558 },
  skien: { lat: 59.2086, lon: 9.5528 },
  notodden: { lat: 59.5617, lon: 9.2701 },
};

const KNOWN_MUNIS = new Set(Object.keys(MUNI_TO_CITY));

function normalizeMuni(line: string): string | null {
  const s = line.trim().toLowerCase();
  if (KNOWN_MUNIS.has(s)) return s;
  const hyphen = s.replace(/\s+/g, '-');
  if (KNOWN_MUNIS.has(hyphen)) return hyphen;
  return null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function makeId(name: string, city: string): string {
  return ('para_' + slugify(name + '_' + city)).slice(0, 60);
}

interface Club {
  name: string;
  sport: string;
  municipality: string;
  city: string;
}

function parseFile(filePath: string): Club[] {
  const lines = fs.readFileSync(filePath, 'utf-8')
    .split('\n')
    .map((l) => l.replace(/\r$/, '').trim());

  // Build a per-line municipality tracker (last seen muni going top-to-bottom)
  const muniAtLine: string[] = new Array(lines.length).fill('');
  let curMuni = '';
  for (let i = 0; i < lines.length; i++) {
    const m = normalizeMuni(lines[i]);
    if (m) curMuni = m;
    muniAtLine[i] = curMuni;
  }

  const clubs: Club[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i] !== 'E-post') continue;

    const municipality = muniAtLine[i];
    if (!municipality) continue; // Skip pre-municipality entries (staff member)

    const city = MUNI_TO_CITY[municipality];
    if (!city) { console.warn(`Unknown municipality: ${municipality}`); continue; }

    // Collect preceding non-empty, non-municipality lines (up to 6)
    const prev: string[] = [];
    for (let j = i - 1; j >= 0 && prev.length < 6; j--) {
      const l = lines[j];
      if (!l) continue;
      if (normalizeMuni(l)) break; // Stop at municipality boundary
      prev.unshift(l);
    }

    // Find club name: first repeated pair (exact or same after normalising spaces/case)
    let name = '';
    let nameEndK = -1;
    for (let k = 0; k < prev.length - 1; k++) {
      const a = prev[k].toLowerCase().replace(/\s+/g, ' ');
      const b = prev[k + 1].toLowerCase().replace(/\s+/g, ' ');
      if (a === b) {
        name = prev[k];
        nameEndK = k + 1;
        break;
      }
    }
    // Fallback: no exact repeat — take first line
    if (!name && prev.length > 0) {
      name = prev[0];
      nameEndK = 0;
    }
    if (!name) continue;

    // Sports = everything between name-pair and E-post
    const sports: string[] = [];
    for (let k = nameEndK + 1; k < prev.length; k++) {
      sports.push(prev[k]);
    }
    // Deduplicate sport lines (some entries repeat the sport, e.g. "Hundekjøring" twice)
    const seen = new Set<string>();
    const uniqueSports = sports.filter((s) => {
      const key = s.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const sport = uniqueSports.join(', ') || '';

    clubs.push({ name, sport, municipality, city });
  }

  return clubs;
}

async function main() {
  const filePath = path.join(process.cwd(), 'ressurser', 'paraidret norge.txt');
  const clubs = parseFile(filePath);

  console.log(`\npush-paraidrett${DRY_RUN ? '  DRY RUN' : ''}  (${clubs.length} klubber)\n`);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const club of clubs) {
    const coords = CITY_COORDS[club.city];
    if (!coords) {
      console.warn(`  ⚠️  Ingen koordinater for by: ${club.city}  (${club.name})`);
      skipped++;
      continue;
    }

    const id = makeId(club.name, club.city);
    const pointWkt = `SRID=4326;POINT(${coords.lon} ${coords.lat})`;

    // Derive tags: ['paraidrett'] + sport slugs (deduplicated)
    const sportSlugs = club.sport
      ? [...new Set(club.sport.split(/[,/]/).map((s) => slugify(s.trim())).filter(Boolean))]
      : [];
    const tags = ['paraidrett', ...sportSlugs.slice(0, 4)];

    if (DRY_RUN) {
      console.log(`  [dry]  ${id.padEnd(55)}  ${club.city.padEnd(12)}  ${club.sport.slice(0, 40)}`);
      continue;
    }

    process.stdout.write(`  ${club.name.slice(0, 40).padEnd(40)} `);

    const { error: svcErr } = await supabase.from('services').upsert({
      id,
      name: club.name,
      type: 'sport',
      main_category: 'aktivitet-sport',
      description: `Para-idrettsklubb – ${club.sport || 'idrett for alle'}`,
      price_level: 'low',
      venues: ['outdoor', 'gym'],
      goals: ['mobility', 'nybegynner'],
      tags,
      is_active: true,
      base_location: pointWkt,
    }, { onConflict: 'id' });

    if (svcErr) {
      console.log(`❌  service: ${svcErr.message}`);
      failed++;
      continue;
    }

    // City coverage — upsert-safe via onConflict check
    const { data: existingCov } = await supabase
      .from('service_coverage')
      .select('id')
      .eq('service_id', id)
      .eq('type', 'city')
      .eq('city', club.city)
      .maybeSingle();

    if (!existingCov) {
      const { error: covErr } = await supabase.from('service_coverage').insert({
        service_id: id,
        type: 'city',
        city: club.city,
      });
      if (covErr) console.warn(`  ⚠️  coverage: ${covErr.message}`);
    }

    // service_types
    await supabase.from('service_types').upsert(
      [{ service_id: id, type: 'sport' }],
      { onConflict: 'service_id,type' }
    );

    console.log(`✅  ${id}`);
    inserted++;
  }

  if (!DRY_RUN) {
    console.log(`\nFerdig.  Lagt til: ${inserted}  Hoppet over: ${skipped}  Feilet: ${failed}\n`);
  } else {
    console.log(`\nDRY RUN ferdig.  Totalt: ${clubs.length} klubber funnet.\n`);
  }
}

main().catch(console.error);
