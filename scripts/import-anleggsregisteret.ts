#!/usr/bin/env tsx
/**
 * Importer norske idrettsanlegg fra Anleggsregisteret (XLSX)
 *
 * Kilde: https://www.anleggsregisteret.no/ → Last ned register (XLSX)
 * Lagre filen som: data/anleggsregisteret.xlsx
 *
 * Krever: npm install xlsx
 *
 * Usage:
 *   npx tsx scripts/import-anleggsregisteret.ts
 *   npx tsx scripts/import-anleggsregisteret.ts --dry-run
 *   npx tsx scripts/import-anleggsregisteret.ts --limit=100
 *   npx tsx scripts/import-anleggsregisteret.ts --type=svømmehall
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
// @ts-expect-error — xlsx types may not be installed
import * as XLSX from 'xlsx';

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
const args = process.argv.slice(2);
const dryRun     = args.includes('--dry-run');
const limitArg   = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0') || null;
const typeFilter = args.find(a => a.startsWith('--type='))?.split('=')[1]?.toLowerCase() ?? null;

// ── Config ────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
                  ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
                  ?? '';

const xlsxFile = join(process.cwd(), 'data', 'anleggsregisteret.xlsx');

// ── Anleggstype → kategori-mapping ────────────────────────────────────────
// Basert på typiske Anleggsregisteret-kategorier
interface AnleggMapping {
  keywords: string[];
  mainCategory: string;
  type: string;
  tags: string[];
  goals: string[];
  venues: string[];
  priceLevel: string;
}

const ANLEGG_MAPPINGS: AnleggMapping[] = [
  {
    keywords: ['treningssenter', 'helsestudio', 'kondisjonssenter', 'fitnesssenter', 'gym'],
    mainCategory: 'trene-selv', type: 'styrke',
    tags: ['styrke', 'treningssenter'], goals: ['strength', 'weight_loss', 'start'],
    venues: ['gym'], priceLevel: 'medium',
  },
  {
    keywords: ['svømmehall', 'svømmebasseng', 'badeland', 'vannpark'],
    mainCategory: 'trene-selv', type: 'kondisjon',
    tags: ['svømming', 'svømmehall'], goals: ['endurance', 'weight_loss'],
    venues: ['gym'], priceLevel: 'low',
  },
  {
    keywords: ['idrettshall', 'idrettssenter', 'sportsanlegg', 'flerbrukshall', 'gymsalen', 'gymnastikksal'],
    mainCategory: 'aktivitet-sport', type: 'sport',
    tags: ['idrettshall', 'sportsanlegg'], goals: ['endurance', 'start'],
    venues: ['gym'], priceLevel: 'low',
  },
  {
    keywords: ['ishall', 'isstadion', 'skøytehall', 'ishockey'],
    mainCategory: 'aktivitet-sport', type: 'sport',
    tags: ['ishockey', 'skating', 'ishall'], goals: ['endurance', 'start'],
    venues: ['gym'], priceLevel: 'low',
  },
  {
    keywords: ['klatrevegg', 'klatresenter', 'klatreanlegg'],
    mainCategory: 'trene-selv', type: 'styrke',
    tags: ['klatring', 'klatresenter'], goals: ['strength', 'start'],
    venues: ['gym'], priceLevel: 'medium',
  },
  {
    keywords: ['tennishall', 'tennisbane', 'padelhall', 'padelbane'],
    mainCategory: 'aktivitet-sport', type: 'sport',
    tags: ['tennis', 'padel'], goals: ['endurance', 'start'],
    venues: ['gym', 'outdoor'], priceLevel: 'medium',
  },
  {
    keywords: ['ridehall', 'rideanlegg', 'ridesentert', 'hestesportanlegg'],
    mainCategory: 'aktivitet-sport', type: 'sport',
    tags: ['riding', 'hest'], goals: ['start'],
    venues: ['outdoor'], priceLevel: 'medium',
  },
  {
    keywords: ['skianlegg', 'skisentert', 'alpinsentert', 'alpint', 'alpinanlegg'],
    mainCategory: 'aktivitet-sport', type: 'outdoor',
    tags: ['ski', 'alpint', 'vinter'], goals: ['endurance', 'start'],
    venues: ['outdoor'], priceLevel: 'medium',
  },
  {
    keywords: ['golfbane', 'golfsentert', 'golfsenter'],
    mainCategory: 'aktivitet-sport', type: 'sport',
    tags: ['golf'], goals: ['start'],
    venues: ['outdoor'], priceLevel: 'high',
  },
  {
    keywords: ['bowlinghall', 'bowling'],
    mainCategory: 'aktivitet-sport', type: 'sport',
    tags: ['bowling'], goals: ['start'],
    venues: ['gym'], priceLevel: 'low',
  },
  {
    keywords: ['tuftepark', 'trimpark', 'utendørs treningsplass', 'utendørs treningspark'],
    mainCategory: 'aktivitet-sport', type: 'outdoor',
    tags: ['tuftepark', 'utetrening', 'styrke', 'gratis'], goals: ['strength', 'weight_loss', 'start', 'endurance'],
    venues: ['outdoor'], priceLevel: 'low',
  },
  {
    keywords: ['friluftsanlegg', 'friluftsplass', 'aktivitetspark', 'naturpark'],
    mainCategory: 'aktivitet-sport', type: 'outdoor',
    tags: ['utetrening', 'friluft'], goals: ['endurance', 'start'],
    venues: ['outdoor'], priceLevel: 'low',
  },
];

// ── Filtrer relevante anlegg ──────────────────────────────────────────────
const SKIP_KEYWORDS = [
  'tursti', 'turvei', 'løypetrase', 'skiløype', 'lysløype',
  'lekeplass', 'sandkasse', 'barnehage',
  'fotballbane', 'kunstgressbane', 'friidrettsbane', 'friidrettsanlegg',
  'stadion', 'tennisbane utend', 'basketballbane', 'volleyballbane',
  'skatepark', 'hundepark', 'båthavn', 'marina', 'kai',
  'sykkelsentert', 'motocross',
];

function findMapping(anleggstype: string): AnleggMapping | null {
  const lower = anleggstype.toLowerCase();
  for (const skip of SKIP_KEYWORDS) {
    if (lower.includes(skip)) return null;
  }
  for (const m of ANLEGG_MAPPINGS) {
    if (m.keywords.some(k => lower.includes(k))) return m;
  }
  return null;
}

// ── ID-generering ─────────────────────────────────────────────────────────
function makeId(anleggsnr: string | number, name: string): string {
  const slug = String(name)
    .toLowerCase()
    .replace(/[^a-zæøå0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50);
  return `anl_${anleggsnr}_${slug}`.slice(0, 85);
}

// ── Hjelp: normaliser by-navn ─────────────────────────────────────────────
function normalizeCity(raw: string): string {
  return raw.trim().toLowerCase()
    .replace(/\s+kommune$/i, '')
    .replace(/\s+/g, ' ');
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('🏟️  FitHub – importer Anleggsregisteret (XLSX)');
  if (dryRun) console.log('   [DRY RUN – ingen endringer lagres]');
  console.log();

  if (!existsSync(xlsxFile)) {
    console.error(`❌ Finner ikke ${xlsxFile}`);
    console.error('');
    console.error('   Last ned registerdata fra:');
    console.error('   https://www.anleggsregisteret.no/');
    console.error('   → Søk → Last ned → Lagre som data/anleggsregisteret.xlsx');
    process.exit(1);
  }

  if (!SUPABASE_URL) { console.error('❌ NEXT_PUBLIC_SUPABASE_URL mangler'); process.exit(1); }

  // Les XLSX
  console.log(`📖 Leser ${xlsxFile}…`);
  const workbook = XLSX.readFile(xlsxFile);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[];
  console.log(`   ${rows.length} rader funnet i ark: "${sheetName}"`);

  // Vis kolonnenavn fra første rad for debugging
  if (rows.length > 0) {
    console.log(`   Kolonner: ${Object.keys(rows[0]).join(' | ')}`);
  }
  console.log();

  // Kartlegg kolonnenavn (Anleggsregisteret kan ha norske kolonnenavn)
  // Vanlige felt: Anleggsnr, Anleggsnavn, Anleggstype, Adresse, Postnr, Poststed, Kommune, Breddegrad, Lengdegrad
  const colMap = (row: Record<string, unknown>) => {
    const k = Object.keys(row);
    const find = (...candidates: string[]) =>
      k.find(c => candidates.some(n => c.toLowerCase().includes(n.toLowerCase()))) ?? null;

    return {
      anleggsnr:   find('anleggsnr', 'id', 'nr'),
      navn:        find('anleggsnavn', 'navn', 'name'),
      anleggstype: find('anleggstype', 'type', 'kategori'),
      adresse:     find('adresse', 'gate', 'vei'),
      postnr:      find('postnr', 'postkode', 'postnum'),
      poststed:    find('poststed', 'sted', 'by', 'city'),
      kommune:     find('kommune'),
      lat:         find('breddegrad', 'lat', 'y_koord', 'nord'),
      lon:         find('lengdegrad', 'lon', 'lng', 'x_koord', 'øst'),
    };
  };

  const colKeys = rows.length > 0 ? colMap(rows[0]) : null;
  if (!colKeys) { console.error('❌ Tom fil'); process.exit(1); }

  // Filter og map rader
  let toProcess = rows;
  if (typeFilter) {
    const anleggsTypeKey = colKeys.anleggstype;
    if (anleggsTypeKey) {
      toProcess = rows.filter(r =>
        String(r[anleggsTypeKey] ?? '').toLowerCase().includes(typeFilter)
      );
    }
  }
  if (limitArg) toProcess = toProcess.slice(0, limitArg);

  console.log(`📋 Prosesserer ${toProcess.length} rader\n`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  let processed = 0, added = 0, skippedType = 0, coverageAdded = 0, errors = 0;

  for (const row of toProcess) {
    const get = (key: string | null) => (key ? String(row[key] ?? '').trim() : '');

    const anleggsnr   = get(colKeys.anleggsnr);
    const navn        = get(colKeys.navn);
    const anleggstype = get(colKeys.anleggstype);
    const adresse     = get(colKeys.adresse);
    const postnr      = get(colKeys.postnr);
    const poststed    = get(colKeys.poststed);
    const kommune     = get(colKeys.kommune);
    const latRaw      = get(colKeys.lat);
    const lonRaw      = get(colKeys.lon);

    if (!navn) continue;

    const mapping = findMapping(anleggstype);
    if (!mapping) { skippedType++; continue; }

    const city = normalizeCity(poststed || kommune);
    const addressStr = [adresse, postnr && poststed ? `${postnr} ${poststed}` : poststed]
      .filter(Boolean).join(', ') || null;

    const lat = latRaw ? parseFloat(latRaw.replace(',', '.')) : null;
    const lon = lonRaw ? parseFloat(lonRaw.replace(',', '.')) : null;

    const id = makeId(anleggsnr || processed, navn);
    const cityDisplay = city ? city.charAt(0).toUpperCase() + city.slice(1) : 'Norge';

    const serviceRow = {
      id,
      name: navn,
      type: mapping.type,
      main_category: mapping.mainCategory,
      description: `${anleggstype || 'Idrettsanlegg'} i ${cityDisplay}`,
      address: addressStr,
      city: city || null,
      phone: null,
      website: null,
      rating_avg: 0,
      rating_count: 0,
      is_active: true,
      tags: mapping.tags,
      goals: mapping.goals,
      venues: mapping.venues,
      coverage: [],
      price_level: mapping.priceLevel,
      owner_user_id: null,
    };

    processed++;
    if (processed % 100 === 0) {
      process.stdout.write(`\r   [${processed}/${toProcess.length}]  ✓ ${added}  skip ${skippedType}  ✗ ${errors}   `);
    }

    if (dryRun) { added++; continue; }

    const { error } = await supabase
      .from('services')
      .upsert(serviceRow, { onConflict: 'id', ignoreDuplicates: true });

    if (error) { errors++; continue; }
    added++;

    if (lat && lon && !isNaN(lat) && !isNaN(lon)) {
      await supabase
        .from('services')
        .update({ base_location: `SRID=4326;POINT(${lon} ${lat})` })
        .eq('id', id);
    }

    if (city) {
      try {
        await supabase
          .from('service_coverage')
          .insert({ service_id: id, type: 'city', city });
        coverageAdded++;
      } catch { /* ignore duplicate */ }
    }
  }

  process.stdout.write('\n');
  console.log('\n✅ Ferdig!');
  console.log(`   Prosessert  : ${processed}`);
  console.log(`   Lagt til    : ${added}`);
  console.log(`   Filtrert ut : ${skippedType} (ikke-relevante anleggstyper)`);
  console.log(`   Feil        : ${errors}`);
  console.log(`   Coverage    : ${coverageAdded} byer`);
  if (dryRun) console.log('\n   Kjør uten --dry-run for å lagre til Supabase');

  if (!dryRun) {
    const { count } = await supabase
      .from('services')
      .select('*', { count: 'exact', head: true })
      .like('id', 'anl_%');
    console.log(`\n📊 Totalt anl_*-tjenester i DB: ${count ?? '?'}`);
  }
}

main().catch(err => { console.error('\n❌ Uventet feil:', err); process.exit(1); });
