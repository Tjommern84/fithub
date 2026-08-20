#!/usr/bin/env tsx
/**
 * Synkroniserer norske idrettsanlegg fra Anleggsregisterets API.
 *
 * Usage:
 *   npx tsx scripts/import-anleggsregisteret.ts --apply
 *   npx tsx scripts/import-anleggsregisteret.ts --plan
 *   npx tsx scripts/import-anleggsregisteret.ts --dry-run
 *   npx tsx scripts/import-anleggsregisteret.ts --limit=100
 *   npx tsx scripts/import-anleggsregisteret.ts --type=svømmehall
 */

import { appendFileSync, readFileSync } from 'fs';
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
const args = process.argv.slice(2);
const dryRun     = args.includes('--dry-run');
const planOnly   = args.includes('--plan');
const applyChanges = args.includes('--apply');
const limitArg   = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0') || null;
const typeFilter = args.find(a => a.startsWith('--type='))?.split('=')[1]?.toLowerCase() ?? null;

function readLimitArg(name: string): number | null {
  const raw = args.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
  if (raw === undefined) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`--${name} må være et ikke-negativt heltall`);
  }
  return value;
}

const maxCreates = readLimitArg('max-create');
const maxUpdates = readLimitArg('max-update');
const maxDeactivations = readLimitArg('max-deactivate');

// ── Config ────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const ANLEGG_API_URL = process.env.ANLEGGSREGISTERET_API_URL
  ?? 'https://backoffice.anleggsregisteret.no/api/facilities';

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
    keywords: ['tuftepark', 'trimpark', 'utendørs treningsanlegg', 'utendørs treningsplass', 'utendørs treningspark'],
    mainCategory: 'aktivitet-sport', type: 'outdoor',
    tags: ['tuftepark', 'utetrening', 'styrke', 'gratis'], goals: ['strength', 'weight_loss', 'start', 'endurance'],
    venues: ['outdoor'], priceLevel: 'low',
  },
  {
    keywords: ['aktivitetspark', 'friluftsanlegg', 'friluftsplass', 'naturpark', 'friluftsområde'],
    mainCategory: 'aktivitet-sport', type: 'outdoor',
    tags: ['utetrening', 'friluft'], goals: ['endurance', 'start'],
    venues: ['outdoor'], priceLevel: 'low',
  },
  {
    keywords: ['hinderløype', 'hinderbane', 'parkouranlegg'],
    mainCategory: 'aktivitet-sport', type: 'outdoor',
    tags: ['utetrening', 'parkour'], goals: ['strength', 'endurance', 'start'],
    venues: ['outdoor'], priceLevel: 'low',
  },
  {
    keywords: ['pumptrack', 'sykkelpark', 'terrengsykkel'],
    mainCategory: 'aktivitet-sport', type: 'outdoor',
    tags: ['sykkel', 'utetrening'], goals: ['endurance', 'start'],
    venues: ['outdoor'], priceLevel: 'low',
  },
  {
    keywords: ['diskgolfanlegg', 'discgolf', 'frisbeegolf'],
    mainCategory: 'aktivitet-sport', type: 'outdoor',
    tags: ['diskgolf', 'utetrening'], goals: ['start'],
    venues: ['outdoor'], priceLevel: 'low',
  },
  {
    keywords: ['klatre/buldrevegg (ute)', 'klatrevegg (ute)', 'buldrevegg (ute)', 'klatrevegg utendørs'],
    mainCategory: 'aktivitet-sport', type: 'outdoor',
    tags: ['klatring', 'utetrening'], goals: ['strength', 'start'],
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

interface AnleggsregisterFacility {
  facilityId: number;
  name: string;
  categoryDescription?: string | null;
  typeDescription?: string | null;
  municipalityName?: string | null;
  countyName?: string | null;
  buildingYear?: number | null;
  lastRebuildingYear?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  ownerName?: string | null;
  ownerOrgno?: string | null;
  operatorName?: string | null;
  operatorOrgno?: string | null;
  totalGrants?: number | null;
  totalPayments?: number | null;
  status?: string | null;
  exportFacilityStatus?: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Planlagt',
  EXISTING: 'Eksisterende',
  CLOSED_DOWN: 'Nedlagt',
  UNREALIZED: 'Ble ikke realisert',
};

async function fetchApiRows(): Promise<Record<string, unknown>[]> {
  console.log(`🌐 Henter ${ANLEGG_API_URL} …`);
  const response = await fetch(ANLEGG_API_URL, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    throw new Error(`Anleggsregisteret svarte HTTP ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('Uventet API-respons: forventet en liste');
  }

  const facilities = payload.filter((item): item is AnleggsregisterFacility => {
    if (!item || typeof item !== 'object') return false;
    const candidate = item as Partial<AnleggsregisterFacility>;
    return Number.isInteger(candidate.facilityId) && typeof candidate.name === 'string';
  });

  if (facilities.length !== payload.length) {
    throw new Error(
      `API-responsen inneholder ${payload.length - facilities.length} ugyldige anleggsrader`,
    );
  }

  return facilities.map((facility) => ({
    Anleggsnummer: facility.facilityId,
    Navn: facility.name,
    Anleggsstatus:
      facility.exportFacilityStatus
      ?? (facility.status ? STATUS_LABELS[facility.status] : null)
      ?? '',
    Eier: facility.ownerName ?? '',
    'Eier organisasjonsnr': facility.ownerOrgno ?? '',
    Drifter: facility.operatorName ?? '',
    'Drifter organisasjonsnr': facility.operatorOrgno ?? '',
    Anleggskategori: facility.categoryDescription ?? '',
    Anleggstype: facility.typeDescription ?? '',
    Byggeår: facility.buildingYear ?? '',
    'Siste ombyggingsår': facility.lastRebuildingYear ?? '',
    Lengdegrad: facility.longitude ?? '',
    Breddegrad: facility.latitude ?? '',
    Kommune: facility.municipalityName ?? '',
    Fylke: facility.countyName ?? '',
    Tildelt: facility.totalGrants ?? 0,
    Utbetalt: facility.totalPayments ?? 0,
  }));
}

interface ExistingAnlegg {
  id: string;
  name: string | null;
  type: string | null;
  main_category: string | null;
  provider_type: string | null;
  description: string | null;
  city: string | null;
  is_active: boolean;
  tags: unknown;
  goals: unknown;
  venues: unknown;
  price_level: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
}

async function loadExistingAnlegg(
  supabase: ReturnType<typeof createClient>,
): Promise<Map<string, ExistingAnlegg>> {
  const result = new Map<string, ExistingAnlegg>();
  const pageSize = 1_000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('services')
      .select('id,name,type,main_category,provider_type,description,city,is_active,tags,goals,venues,price_level,address,lat,lon')
      .like('id', 'anl_%')
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Kunne ikke hente eksisterende anleggs-ID-er: ${error.message}`);

    for (const row of data ?? []) {
      const id = String(row.id);
      const match = id.match(/^anl_(\d+)(?:_|$)/);
      if (match) result.set(match[1], row as ExistingAnlegg);
    }

    if ((data?.length ?? 0) < pageSize) break;
  }

  return result;
}

async function loadExistingOutdoorTypes(
  supabase: ReturnType<typeof createClient>,
): Promise<Set<string>> {
  const result = new Set<string>();
  const pageSize = 1_000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('service_types')
      .select('service_id')
      .eq('type', 'outdoor')
      .like('service_id', 'anl_%')
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Kunne ikke hente eksisterende anleggstyper: ${error.message}`);
    for (const row of data ?? []) result.add(String(row.service_id));
    if ((data?.length ?? 0) < pageSize) break;
  }

  return result;
}

async function loadExistingCityCoverage(
  supabase: ReturnType<typeof createClient>,
): Promise<Set<string>> {
  const result = new Set<string>();
  const pageSize = 1_000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('service_coverage')
      .select('service_id,city')
      .eq('type', 'city')
      .like('service_id', 'anl_%')
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Kunne ikke hente eksisterende bydekning: ${error.message}`);
    for (const row of data ?? []) {
      if (row.city) result.add(`${row.service_id}\u0000${row.city}`);
    }
    if ((data?.length ?? 0) < pageSize) break;
  }

  return result;
}

function normalizedArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).sort() : [];
}

function sameArray(left: unknown, right: unknown): boolean {
  return JSON.stringify(normalizedArray(left)) === JSON.stringify(normalizedArray(right));
}

function hasServiceChanges(
  existing: ExistingAnlegg,
  serviceRow: Record<string, unknown>,
  lat: number | null,
  lon: number | null,
): boolean {
  const stringColumns = [
    'name',
    'type',
    'main_category',
    'provider_type',
    'description',
    'city',
    'price_level',
    'address',
  ] as const;

  for (const column of stringColumns) {
    if (!(column in serviceRow)) continue;
    const expected = serviceRow[column] == null ? null : String(serviceRow[column]);
    if (existing[column] !== expected) return true;
  }

  if (existing.is_active !== true) return true;
  if (!sameArray(existing.tags, serviceRow.tags)) return true;
  if (!sameArray(existing.goals, serviceRow.goals)) return true;
  if (!sameArray(existing.venues, serviceRow.venues)) return true;

  if (lat !== null && lon !== null && Number.isFinite(lat) && Number.isFinite(lon)) {
    if (existing.lat === null || existing.lon === null) return true;
    if (Math.abs(Number(existing.lat) - lat) > 0.000001) return true;
    if (Math.abs(Number(existing.lon) - lon) > 0.000001) return true;
  }

  return false;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('🏟️  FitHub – synkroniserer Anleggsregisteret API');
  if (dryRun) console.log('   [DRY RUN – ingen endringer lagres]');
  if (planOnly) console.log('   [PLAN – leser produksjonsdata, men lagrer ingen endringer]');
  if (applyChanges) console.log('   [APPLY – godkjente endringer lagres]');
  console.log();

  if ([dryRun, planOnly, applyChanges].filter(Boolean).length !== 1) {
    console.error('❌ Velg nøyaktig én modus: --dry-run, --plan eller --apply');
    process.exit(1);
  }

  if (!dryRun && (!SUPABASE_URL || !SUPABASE_KEY)) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY må være satt');
    process.exit(1);
  }

  const rows = await fetchApiRows();
  console.log(`   Totalt: ${rows.length} rader\n`);

  if (rows.length === 0) { console.error('❌ Ingen rader'); process.exit(1); }
  console.log(`   Kolonner: ${Object.keys(rows[0]).join(' | ')}`);
  console.log();

  const colMap = (row: Record<string, unknown>) => {
    const k = Object.keys(row);
    const find = (...candidates: string[]) =>
      k.find(c => candidates.some(n => c.toLowerCase().includes(n.toLowerCase()))) ?? null;

    return {
      anleggsnr:   find('anleggsnummer', 'anleggsnr', 'id', 'nr'),
      navn:        find('anleggsnavn', 'navn', 'name'),
      anleggstype: find('anleggstype'),
      status:      find('anleggsstatus', 'status'),
      adresse:     find('adresse', 'gate', 'vei'),
      postnr:      find('postnr', 'postkode', 'postnum'),
      poststed:    find('poststed'),
      kommune:     find('kommune'),
      lat:         find('breddegrad', 'lat', 'y_koord', 'nord'),
      lon:         find('lengdegrad', 'lon', 'lng', 'x_koord', 'øst'),
      orgnr:       k.find(c => c.toLowerCase().includes('eier') && c.toLowerCase().includes('organisasjonsnr')) ?? null,
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

  const shouldWrite = applyChanges;
  const supabase = !dryRun && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
  const existingAnlegg = supabase
    ? await loadExistingAnlegg(supabase)
    : new Map<string, ExistingAnlegg>();
  const existingOutdoorTypes = supabase
    ? await loadExistingOutdoorTypes(supabase)
    : new Set<string>();
  const existingCityCoverage = supabase
    ? await loadExistingCityCoverage(supabase)
    : new Set<string>();

  let processed = 0;
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let deactivated = 0;
  let skippedType = 0;
  let serviceTypesAdded = 0;
  let coverageAdded = 0;
  let errors = 0;
  const plannedCreates: string[] = [];
  const plannedUpdates: string[] = [];
  const plannedDeactivations: string[] = [];

  for (const row of toProcess) {
    const get = (key: string | null) => (key ? String(row[key] ?? '').trim() : '');

    const anleggsnr   = get(colKeys.anleggsnr);
    const navn        = get(colKeys.navn);
    const anleggstype = get(colKeys.anleggstype);
    const status      = get(colKeys.status);
    const adresse     = get(colKeys.adresse);
    const postnr      = get(colKeys.postnr);
    const poststed    = get(colKeys.poststed);
    const kommune     = get(colKeys.kommune);
    const latRaw      = get(colKeys.lat);
    const lonRaw      = get(colKeys.lon);
    const orgnr       = get(colKeys.orgnr);

    if (!navn) continue;
    const mapping = findMapping(anleggstype);
    if (!mapping) { skippedType++; continue; }

    const existing = anleggsnr ? existingAnlegg.get(anleggsnr) : undefined;
    const existingId = existing?.id;
    if (status && status.toLowerCase() !== 'eksisterende') {
      if (existingId && existing.is_active && shouldWrite && supabase) {
        const { error } = await supabase
          .from('services')
          .update({ is_active: false })
          .eq('id', existingId);
        if (error) errors++;
        else deactivated++;
      } else if (existingId && existing.is_active && planOnly) {
        deactivated++;
        plannedDeactivations.push(`${existingId} — ${existing.name ?? navn} (${status})`);
      }
      skippedType++;
      continue;
    }

    const city = normalizeCity(poststed || kommune);
    const addressStr = [adresse, postnr && poststed ? `${postnr} ${poststed}` : poststed]
      .filter(Boolean).join(', ') || null;

    const lat = latRaw ? parseFloat(latRaw.replace(',', '.')) : null;
    const lon = lonRaw ? parseFloat(lonRaw.replace(',', '.')) : null;

    const id = existingId ?? makeId(anleggsnr || processed, navn);
    const cityDisplay = city ? city.charAt(0).toUpperCase() + city.slice(1) : 'Norge';

    const serviceRow: Record<string, unknown> = {
      id,
      name: navn,
      type: mapping.type,
      main_category: mapping.mainCategory,
      provider_type: 'facility',
      description: `${anleggstype || 'Idrettsanlegg'} i ${cityDisplay}`,
      city: city || null,
      is_active: true,
      tags: mapping.tags,
      goals: mapping.goals,
      venues: mapping.venues,
      price_level: mapping.priceLevel,
      // orgnr lagres IKKE her selv om den er tilgjengelig i `orgnr`-variabelen:
      // services.orgnr har en UNIQUE-constraint (services_orgnr_key), og mange
      // anlegg deler samme "Eier organisasjonsnr" (f.eks. samme kommune eier
      // titalls anlegg) — å sette orgnr her ga bulk-upsert-feil på tvers av
      // rader med samme eier. Se handoff.md for konflikten mot design.md sin
      // ønskede "lagre orgnr som metadata"-instruks; krever en DB-avgjørelse
      // (egen kolonne, eller fjern UNIQUE) før det kan gjøres trygt.
    };
    if (addressStr) serviceRow.address = addressStr;

    processed++;
    if (processed % 100 === 0) {
      process.stdout.write(`\r   [${processed}/${toProcess.length}]  +${created}  ~${updated}  =${unchanged}  skip ${skippedType}  ✗ ${errors}   `);
    }

    if (dryRun) {
      created++;
      continue;
    }
    if (!supabase) throw new Error('Supabase er ikke konfigurert');

    const serviceChanged = existing
      ? hasServiceChanges(existing, serviceRow, lat, lon)
      : true;

    if (planOnly) {
      if (!existing) {
        created++;
        plannedCreates.push(`${id} — ${navn}`);
      } else if (serviceChanged) {
        updated++;
        plannedUpdates.push(`${id} — ${navn}`);
      }
      else unchanged++;
      if (!existingOutdoorTypes.has(id)) serviceTypesAdded++;
      if (city && !existingCityCoverage.has(`${id}\u0000${city}`)) coverageAdded++;
      continue;
    }

    if (!serviceChanged) {
      unchanged++;
    } else {
      const { error } = await supabase
        .from('services')
        .upsert(serviceRow, { onConflict: 'id' });

      if (error) { errors++; continue; }
      if (existing) updated++;
      else created++;
    }

    const locationChanged = lat !== null
      && lon !== null
      && Number.isFinite(lat)
      && Number.isFinite(lon)
      && (
        !existing
        || existing.lat === null
        || existing.lon === null
        || Math.abs(Number(existing.lat) - lat) > 0.000001
        || Math.abs(Number(existing.lon) - lon) > 0.000001
      );

    if (locationChanged) {
      await supabase
        .from('services')
        .update({ base_location: `SRID=4326;POINT(${lon} ${lat})` })
        .eq('id', id);
    }

    // Hardkodet 'outdoor' (ikke mapping.type) for å være konsistent med
    // engangs-datakorreksjonen i sql/28_provider_type.sql, som per design.md
    // eksplisitt setter type='outdoor' på ALLE anl_%-rader uavhengig av
    // undertype (gym/ishall/golfbane inkludert) — samme regel her for
    // fremtidige importer, ikke en egen tolkning.
    if (!existingOutdoorTypes.has(id)) {
      const { error: typeError } = await supabase
        .from('service_types')
        .upsert(
          { service_id: id, type: 'outdoor' },
          { onConflict: 'service_id,type', ignoreDuplicates: true },
        );
      if (typeError) errors++;
      else {
        existingOutdoorTypes.add(id);
        serviceTypesAdded++;
      }
    }

    const coverageKey = `${id}\u0000${city}`;
    if (city && !existingCityCoverage.has(coverageKey)) {
      const { error: coverageError } = await supabase
        .from('service_coverage')
        .upsert(
          { service_id: id, type: 'city', city },
          { onConflict: 'service_id,type,city', ignoreDuplicates: true },
        );
      if (coverageError) errors++;
      else {
        existingCityCoverage.add(coverageKey);
        coverageAdded++;
      }
    }
  }

  process.stdout.write('\n');
  console.log('\n✅ Ferdig!');
  console.log(`   Prosessert  : ${processed}`);
  console.log(`   Opprettes   : ${created}`);
  console.log(`   Oppdateres  : ${updated}`);
  console.log(`   Uendret     : ${unchanged}`);
  console.log(`   Deaktivert  : ${deactivated}`);
  console.log(`   Filtrert ut : ${skippedType} (ikke-relevante anleggstyper)`);
  console.log(`   Feil        : ${errors}`);
  console.log(`   Nye typer   : ${serviceTypesAdded}`);
  console.log(`   Ny coverage : ${coverageAdded} byer`);

  const githubSummary = process.env.GITHUB_STEP_SUMMARY;
  if (githubSummary) {
    appendFileSync(githubSummary, [
      '## Anleggsregisteret',
      '',
      `- Modus: ${planOnly ? 'plan' : dryRun ? 'dry-run' : 'apply'}`,
      `- Prosessert: ${processed}`,
      `- Opprettes: ${created}`,
      `- Oppdateres: ${updated}`,
      `- Uendret: ${unchanged}`,
      `- Deaktiveres: ${deactivated}`,
      `- Nye typekoblinger: ${serviceTypesAdded}`,
      `- Nye bykoblinger: ${coverageAdded}`,
      `- Feil: ${errors}`,
      '',
    ].join('\n'));
  }

  if (dryRun) console.log('\n   Kjør med --plan for å sammenligne skrivebeskyttet mot Supabase');
  if (planOnly) {
    const printPlan = (label: string, entries: string[]) => {
      console.log(`\n   ${label} (${entries.length}):`);
      for (const entry of entries.slice(0, 50)) console.log(`   - ${entry}`);
      if (entries.length > 50) console.log(`   - … og ${entries.length - 50} til`);
    };

    printPlan('Opprettes', plannedCreates);
    printPlan('Oppdateres', plannedUpdates);
    printPlan('Deaktiveres', plannedDeactivations);
    console.log('\n   Planen er skrivebeskyttet. Kjør npm run anlegg:sync for å lagre til Supabase');

    const guardViolations = [
      maxCreates !== null && created > maxCreates
        ? `opprettelser ${created} > ${maxCreates}`
        : null,
      maxUpdates !== null && updated > maxUpdates
        ? `oppdateringer ${updated} > ${maxUpdates}`
        : null,
      maxDeactivations !== null && deactivated > maxDeactivations
        ? `deaktiveringer ${deactivated} > ${maxDeactivations}`
        : null,
    ].filter((violation): violation is string => violation !== null);

    if (guardViolations.length > 0) {
      console.error(`\n❌ Endringsgrensen ble overskredet: ${guardViolations.join(', ')}`);
      process.exitCode = 2;
    }
  }

  if (shouldWrite && supabase) {
    const { count } = await supabase
      .from('services')
      .select('*', { count: 'exact', head: true })
      .like('id', 'anl_%');
    console.log(`\n📊 Totalt anl_*-tjenester i DB: ${count ?? '?'}`);
  }
}

main().catch(err => { console.error('\n❌ Uventet feil:', err); process.exit(1); });
