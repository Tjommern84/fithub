#!/usr/bin/env tsx
/**
 * NIF (Norges Idrettsforbund) klubbimport
 *
 * Henter klubber og idretter fra NIF sitt API og beriker databasen.
 * Krever NIF Integration Partner-credentials (gratis å søke om):
 *   https://www.idrettsforbundet.no/digital/samarbeidspartner/api-medlem/
 *
 * Legg til i .env.local:
 *   NIF_CLIENT_ID=<din client id>
 *   NIF_CLIENT_SECRET=<din client secret>
 *   NIF_TOKEN_URL=<token endpoint fra NIF>
 *   NIF_API_BASE=https://data.nif.no
 *
 * Usage:
 *   npx tsx scripts/nif-import.ts --dry-run
 *   npx tsx scripts/nif-import.ts --org-id=123456
 *   npx tsx scripts/nif-import.ts --limit=100
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
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
const orgIdFilter = args.find(a => a.startsWith('--org-id='))?.split('=')[1] ?? null;

// ── Config ────────────────────────────────────────────────────────────────
const NIF_CLIENT_ID     = process.env.NIF_CLIENT_ID ?? '';
const NIF_CLIENT_SECRET = process.env.NIF_CLIENT_SECRET ?? '';
const NIF_TOKEN_URL     = process.env.NIF_TOKEN_URL ?? 'https://auth.nif.no/connect/token';
const NIF_API_BASE      = process.env.NIF_API_BASE ?? 'https://data.nif.no';
const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// ── NIF sport-kode → tag-mapping ──────────────────────────────────────────
// Basert på NIF sin offisielle idrettsliste (55 særforbund)
const NIF_SPORT_MAP: Record<string, string> = {
  'fotball':            'fotball',
  'handball':           'handball',
  'håndball':           'handball',
  'basketball':         'basket',
  'volleyball':         'volleyball',
  'tennis':             'tennis',
  'badminton':          'badminton',
  'golf':               'golf',
  'langrenn':           'langrenn',
  'alpint':             'alpint',
  'ski':                'ski',
  'skiskyting':         'skiskyting',
  'skihopp':            'skihopp',
  'friidrett':          'friidrett',
  'sykling':            'sykling',
  'svømming':           'svomming',
  'roing':              'roing',
  'kano':               'kajak',
  'kajak':              'kajak',
  'ishockey':           'ishockey',
  'bandy':              'bandy',
  'curling':            'curling',
  'innebandy':          'innebandy',
  'squash':             'squash',
  'bordtennis':         'bordtennis',
  'rugby':              'rugby',
  'orientering':        'orientering',
  'skyting':            'skyting',
  'ridning':            'ridning',
  'turn':               'turn',
  'gymnastikk':         'turn',
  'dans':               'dans',
  'seiling':            'seiling',
  'klatring':           'klatring',
  'triathlon':          'triathlon',
  'boksing':            'boksing',
  'bryting':            'bryting',
  'judo':               'judo',
  'karate':             'kampsport',
  'taekwondo':          'kampsport',
  'fekting':            'fekting',
  'padel':              'padel',
  'cricket':            'cricket',
  'baseball':           'baseball',
  'softball':           'baseball',
  'amerikansk fotball': 'amerikansk-fotball',
  'motorsport':         'motorsport',
  'skøyter':            'skøyter',
  'rulleskøyter':       'rulleskøyter',
  'esport':             'esport',
};

function mapSportTag(sportName: string): string {
  const lower = sportName.toLowerCase().trim();
  for (const [key, tag] of Object.entries(NIF_SPORT_MAP)) {
    if (lower.includes(key)) return tag;
  }
  return lower.replace(/\s+/g, '-');
}

// ── OAuth 2.0 token ───────────────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'tjeneste_read',
  });

  const res = await fetch(NIF_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${NIF_CLIENT_ID}:${NIF_CLIENT_SECRET}`).toString('base64'),
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token-feil ${res.status}: ${text}`);
  }

  const json = await res.json() as { access_token: string; expires_in: number };
  cachedToken = json.access_token;
  tokenExpiry = Date.now() + (json.expires_in - 60) * 1000;
  return cachedToken;
}

// ── NIF API helpers ───────────────────────────────────────────────────────
async function nifGet<T>(path: string): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${NIF_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`NIF API ${res.status}: ${path}`);
  return await res.json() as T;
}

// ── NIF data types ────────────────────────────────────────────────────────
interface NifOrganisation {
  id: number;
  name: string;
  organisationNumber?: string;  // orgnr
  address?: {
    postalCode?: string;
    city?: string;
    street?: string;
  };
  sports?: Array<{ id: number; name: string }>;
  location?: { lat: number; lon: number };
}

interface NifOrganisationsResponse {
  organisations: NifOrganisation[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function makeId(orgnr: string): string {
  return `nif_${orgnr}`;
}

function buildAddress(org: NifOrganisation): string | null {
  const a = org.address;
  if (!a) return null;
  const parts = [a.street, a.postalCode && a.city ? `${a.postalCode} ${a.city}` : a.city].filter(Boolean);
  return parts.join(', ') || null;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('🏅  SettDegEtMål – NIF klubbimport');
  if (dryRun) console.log('   [DRY RUN – ingen endringer lagres]');
  console.log();

  // Sjekk credentials
  if (!NIF_CLIENT_ID || !NIF_CLIENT_SECRET) {
    console.error('❌ NIF_CLIENT_ID og NIF_CLIENT_SECRET mangler i .env.local');
    console.error();
    console.error('Søk om tilgang: https://www.idrettsforbundet.no/digital/samarbeidspartner/api-medlem/');
    console.error('Når du har credentials, legg til i .env.local:');
    console.error('  NIF_CLIENT_ID=<din id>');
    console.error('  NIF_CLIENT_SECRET=<din secret>');
    process.exit(1);
  }

  if (!SUPABASE_URL) { console.error('❌ NEXT_PUBLIC_SUPABASE_URL mangler'); process.exit(1); }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Test token-henting
  console.log('🔑 Henter NIF-token…');
  try {
    await getToken();
    console.log('   ✓ Autentisert\n');
  } catch (err) {
    console.error('❌ Autentisering feilet:', (err as Error).message);
    process.exit(1);
  }

  // Hent organisasjoner
  let allOrgs: NifOrganisation[] = [];

  if (orgIdFilter) {
    console.log(`🔍 Henter enkelt org: ${orgIdFilter}`);
    const org = await nifGet<NifOrganisation>(`/api/organisations/${orgIdFilter}`);
    allOrgs = [org];
  } else {
    console.log('📥 Henter alle idrettslag fra NIF…');
    let page = 1;
    const pageSize = 100;
    while (true) {
      const data = await nifGet<NifOrganisationsResponse>(
        `/api/organisations?page=${page}&pageSize=${pageSize}&type=club`
      );
      allOrgs.push(...data.organisations);
      console.log(`   Side ${page}: ${data.organisations.length} klubber (totalt ${allOrgs.length}/${data.totalCount})`);
      if (allOrgs.length >= data.totalCount || data.organisations.length < pageSize) break;
      if (limit > 0 && allOrgs.length >= limit) { allOrgs = allOrgs.slice(0, limit); break; }
      page++;
      await sleep(200);
    }
  }

  console.log(`\n📋 ${allOrgs.length} klubber å prosessere\n`);

  let upserted = 0, errors = 0;

  for (let i = 0; i < allOrgs.length; i++) {
    const org = allOrgs[i];
    const orgnr = org.organisationNumber ?? null;
    const id = orgnr ? makeId(orgnr) : `nif_id_${org.id}`;
    const address = buildAddress(org);
    const city = org.address?.city?.toLowerCase() ?? null;
    const sportTags = (org.sports ?? []).map(s => mapSportTag(s.name));

    process.stdout.write(`[${i + 1}/${allOrgs.length}] ${org.name} → [${sportTags.join(', ')}] `);

    const serviceRow = {
      id,
      name: org.name,
      type: 'sport',
      description: sportTags.length > 0
        ? `Idrettslag med ${sportTags.slice(0, 3).join(', ')} i ${org.address?.city ?? 'Norge'}`
        : `Idrettslag i ${org.address?.city ?? 'Norge'}`,
      address,
      orgnr,
      is_active: true,
      tags: [...sportTags, 'idrettslag'],
      goals: ['endurance', 'strength', 'start', 'fun'],
      venues: ['outdoor', 'gym'],
      coverage: [],
      price_level: 'low',
      owner_user_id: null,
    };

    if (!dryRun) {
      const { error } = await supabase
        .from('services')
        .upsert(serviceRow, { onConflict: 'id', ignoreDuplicates: false });
      if (error) {
        process.stdout.write(`FEIL: ${error.message}\n`);
        errors++;
        continue;
      }

      // base_location
      if (org.location?.lat && org.location?.lon) {
        await supabase.from('services')
          .update({ base_location: `SRID=4326;POINT(${org.location.lon} ${org.location.lat})` })
          .eq('id', id);
      }

      // coverage
      if (city) {
        await supabase.from('service_coverage').delete().eq('service_id', id);
        await supabase.from('service_coverage').insert({ service_id: id, type: 'city', city });
      }

      // service_types
      for (const tag of sportTags) {
        await supabase.from('service_types')
          .upsert({ service_id: id, type: tag, is_primary: false }, { onConflict: 'service_id,type', ignoreDuplicates: true });
      }
    }

    process.stdout.write('✓\n');
    upserted++;
    await sleep(100);
  }

  // Lagre rådata lokalt for ettersyn
  if (!dryRun && allOrgs.length > 0) {
    const outDir = join(process.cwd(), 'data');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'nif-clubs-last-run.json'), JSON.stringify({
      fetchedAt: new Date().toISOString(),
      count: allOrgs.length,
    }, null, 2));
  }

  console.log();
  console.log('✅ Ferdig!');
  console.log(`   Upsert  : ${upserted}`);
  if (errors > 0) console.log(`   Feil    : ${errors}`);
  if (dryRun) console.log('\n   (Ingen endringer lagret — kjør uten --dry-run)');
}

main().catch(err => { console.error('\n❌ Uventet feil:', err); process.exit(1); });
