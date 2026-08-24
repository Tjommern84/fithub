#!/usr/bin/env tsx
/**
 * Hent trenings- og idrettsanlegg fra OpenStreetMap via Overpass API
 *
 * Spørrer etter hele Norge (bbox) for relevante leisure/sport-tags.
 * Lagrer rådata til data/osm-facilities.jsonl
 *
 * Gratis, ingen API-nøkkel nødvendig.
 *
 * Usage:
 *   npx tsx scripts/find-osm-facilities.ts
 *   npx tsx scripts/find-osm-facilities.ts --tag=yoga
 *   npx tsx scripts/find-osm-facilities.ts --limit=100
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// ── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const tagFilter = args.find(a => a.startsWith('--tag='))?.split('=')[1] ?? null;
const limitArg  = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0') || null;

// ── Config ────────────────────────────────────────────────────────────────
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const NORWAY_AREA = 'area["ISO3166-1"="NO"][admin_level=2]->.norway;';

const outDir  = join(process.cwd(), 'data');
const outFile = join(outDir, 'osm-facilities.jsonl');
mkdirSync(outDir, { recursive: true });

// ── OSM tag → kategori-mapping ────────────────────────────────────────────
export interface OsmMapping {
  osmKey: string;
  osmValue: string;
  mainCategory: string;
  type: string;
  tags: string[];
  goals: string[];
  venues: string[];
  priceLevel: string;
  description: string;
}

const TAG_MAPPINGS: OsmMapping[] = [
  {
    osmKey: 'leisure', osmValue: 'fitness_centre',
    mainCategory: 'trene-selv', type: 'styrke',
    tags: ['styrke', 'treningssenter'],
    goals: ['strength', 'weight_loss', 'start'],
    venues: ['gym'], priceLevel: 'medium',
    description: 'Treningssenter',
  },
  {
    osmKey: 'amenity', osmValue: 'gym',
    mainCategory: 'trene-selv', type: 'styrke',
    tags: ['styrke', 'treningssenter'],
    goals: ['strength', 'weight_loss', 'start'],
    venues: ['gym'], priceLevel: 'medium',
    description: 'Treningssenter',
  },
  {
    osmKey: 'leisure', osmValue: 'sports_centre',
    mainCategory: 'aktivitet-sport', type: 'sport',
    tags: ['idrettshall', 'sportsanlegg'],
    goals: ['endurance', 'start'],
    venues: ['gym'], priceLevel: 'low',
    description: 'Idrettshall / sportsanlegg',
  },
  {
    osmKey: 'leisure', osmValue: 'swimming_pool',
    mainCategory: 'trene-selv', type: 'kondisjon',
    tags: ['svømming', 'svømmehall'],
    goals: ['endurance', 'weight_loss'],
    venues: ['gym'], priceLevel: 'low',
    description: 'Svømmehall',
  },
  {
    osmKey: 'leisure', osmValue: 'ice_rink',
    mainCategory: 'aktivitet-sport', type: 'sport',
    tags: ['ishockey', 'skating', 'ishall'],
    goals: ['endurance', 'start'],
    venues: ['gym'], priceLevel: 'low',
    description: 'Ishall / skøytebane',
  },
  {
    osmKey: 'sport', osmValue: 'yoga',
    mainCategory: 'oppfolging', type: 'yoga',
    tags: ['yoga', 'mindfulness'],
    goals: ['mobility', 'start', 'weight_loss'],
    venues: ['gym'], priceLevel: 'medium',
    description: 'Yoga-studio',
  },
  {
    osmKey: 'sport', osmValue: 'climbing',
    mainCategory: 'trene-selv', type: 'styrke',
    tags: ['klatring', 'klatresenter'],
    goals: ['strength', 'start'],
    venues: ['gym'], priceLevel: 'medium',
    description: 'Klatresenter',
  },
  {
    osmKey: 'sport', osmValue: 'martial_arts',
    mainCategory: 'trene-selv', type: 'sport',
    tags: ['kampsport'],
    goals: ['strength', 'start'],
    venues: ['gym'], priceLevel: 'medium',
    description: 'Kampsport',
  },
  {
    osmKey: 'sport', osmValue: 'dance',
    mainCategory: 'trene-selv', type: 'gruppe',
    tags: ['dans', 'dansskole'],
    goals: ['weight_loss', 'start'],
    venues: ['gym'], priceLevel: 'medium',
    description: 'Dansstudio',
  },
  {
    osmKey: 'sport', osmValue: 'padel',
    mainCategory: 'aktivitet-sport', type: 'sport',
    tags: ['padel'],
    goals: ['endurance', 'start'],
    venues: ['outdoor', 'gym'], priceLevel: 'medium',
    description: 'Padelbane',
  },
  {
    osmKey: 'sport', osmValue: 'swimming',
    mainCategory: 'trene-selv', type: 'kondisjon',
    tags: ['svømming'],
    goals: ['endurance', 'weight_loss'],
    venues: ['gym'], priceLevel: 'low',
    description: 'Svømmeklubb',
  },
  {
    osmKey: 'sport', osmValue: 'crossfit',
    mainCategory: 'trene-selv', type: 'styrke',
    tags: ['crossfit', 'styrke'],
    goals: ['strength', 'weight_loss', 'start'],
    venues: ['gym'], priceLevel: 'medium',
    description: 'CrossFit-boks',
  },
];

// ── Overpass-spørring ─────────────────────────────────────────────────────
function buildQuery(mapping: OsmMapping): string {
  const lines = ['node', 'way', 'relation'].map(
    t => `  ${t}["${mapping.osmKey}"="${mapping.osmValue}"](area.norway);`
  );
  return `[out:json][timeout:90];\n${NORWAY_AREA}\n(\n${lines.join('\n')}\n);\nout body center qt;`;
}

async function fetchOverpass(query: string): Promise<Record<string, unknown>[]> {
  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': '*/*',
          'User-Agent': 'fithub.no/1.0 (data import)',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(120_000),
      });
      if (res.ok) {
        const data = await res.json() as { elements: Record<string, unknown>[] };
        return data.elements ?? [];
      }
    } catch { /* try next */ }
  }
  return [];
}

// ── OSM element → vår struktur ────────────────────────────────────────────
export interface OsmFacility {
  osm_id: number;
  osm_type: 'node' | 'way' | 'relation';
  lat: number | null;
  lon: number | null;
  name: string;
  address: string | null;
  city: string | null;
  postcode: string | null;
  phone: string | null;
  website: string | null;
  opening_hours: string | null;
  leisure: string | null;
  amenity: string | null;
  sport: string | null;
  mapping: OsmMapping;
}

function getCoords(el: Record<string, unknown>): { lat: number | null; lon: number | null } {
  if (el.type === 'node') {
    return { lat: el.lat as number, lon: el.lon as number };
  }
  const center = el.center as Record<string, number> | undefined;
  if (center) return { lat: center.lat, lon: center.lon };
  return { lat: null, lon: null };
}

function mapElement(el: Record<string, unknown>, mappings: OsmMapping[]): OsmFacility | null {
  const tags = (el.tags ?? {}) as Record<string, string>;
  const name = tags['name'] ?? tags['name:no'] ?? tags['name:en'] ?? '';
  if (!name.trim()) return null;

  const mapping = mappings.find(m => tags[m.osmKey] === m.osmValue);
  if (!mapping) return null;

  const street   = tags['addr:street'] ?? null;
  const housenr  = tags['addr:housenumber'] ?? null;
  const postcode = tags['addr:postcode'] ?? null;
  const city     = tags['addr:city'] ?? tags['addr:municipality'] ?? null;

  let address: string | null = null;
  if (street) {
    address = housenr ? `${street} ${housenr}` : street;
    if (postcode && city) address += `, ${postcode} ${city}`;
    else if (city) address += `, ${city}`;
  } else if (postcode && city) {
    address = `${postcode} ${city}`;
  }

  const { lat, lon } = getCoords(el);

  return {
    osm_id: el.id as number,
    osm_type: el.type as 'node' | 'way' | 'relation',
    lat,
    lon,
    name: name.trim(),
    address,
    city: city?.toLowerCase() ?? null,
    postcode: postcode ?? null,
    phone: tags['phone'] ?? tags['contact:phone'] ?? null,
    website: tags['website'] ?? tags['contact:website'] ?? tags['url'] ?? null,
    opening_hours: tags['opening_hours'] ?? null,
    leisure: tags['leisure'] ?? null,
    amenity: tags['amenity'] ?? null,
    sport: tags['sport'] ?? null,
    mapping,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('🗺️  FitHub – hent treningsanlegg fra OpenStreetMap (Overpass API)');

  const activeMappings = tagFilter
    ? TAG_MAPPINGS.filter(m => m.osmValue === tagFilter)
    : TAG_MAPPINGS;

  if (tagFilter) console.log(`   Filter: tag=${tagFilter} (${activeMappings.length} mapping(er))`);
  console.log(`   Spørringer: ${activeMappings.length * 3} (node/way/relation × ${activeMappings.length} tags)`);
  console.log('   Område: Norge (administrativ landegrense, ISO3166-1=NO)');
  console.log();

  console.log('⏳ Sender Overpass-spørringer (én per tag)…\n');

  const facilities: OsmFacility[] = [];
  const seenIds = new Set<string>();
  let totalElements = 0;

  for (const mapping of activeMappings) {
    const tag = `${mapping.osmKey}=${mapping.osmValue}`;
    process.stdout.write(`   ${tag.padEnd(30)} `);
    const query = buildQuery(mapping);
    const elements = await fetchOverpass(query);
    totalElements += elements.length;
    let tagCount = 0;
    for (const el of elements) {
      const facility = mapElement(el, [mapping]);
      if (!facility) continue;
      const dedupeKey = `${facility.osm_type}_${facility.osm_id}`;
      if (seenIds.has(dedupeKey)) continue;
      seenIds.add(dedupeKey);
      facilities.push(facility);
      tagCount++;
    }
    console.log(`${elements.length} elementer → ${tagCount} med navn`);
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`\n✅ ${totalElements} OSM-elementer mottatt totalt`)

  let output = facilities as unknown as OsmFacility[];
  if (limitArg) output = output.slice(0, limitArg);

  console.log(`📊 ${facilities.length} fasiliteter med navn (${totalElements - facilities.length} uten navn filtrert bort)`);

  // Statistikk per tag
  const byTag = new Map<string, number>();
  for (const f of output) {
    const key = `${f.mapping.osmKey}=${f.mapping.osmValue}`;
    byTag.set(key, (byTag.get(key) ?? 0) + 1);
  }
  console.log('\n   Fordeling:');
  for (const [tag, count] of [...byTag.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(count).padStart(4)}  ${tag}`);
  }

  // Lagre
  const jsonl = output.map(f => JSON.stringify(f)).join('\n');
  writeFileSync(outFile, jsonl + '\n', 'utf-8');
  console.log(`\n💾 Lagret ${output.length} fasiliteter til ${outFile}`);
}

main().catch(err => { console.error('\n❌ Uventet feil:', err); process.exit(1); });
