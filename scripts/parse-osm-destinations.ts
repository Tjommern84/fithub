#!/usr/bin/env tsx
/**
 * Hent turmål (fjelltoppar, tjern, hytter, utsiktspunkt) fra OpenStreetMap via Overpass API
 *
 * Dekker hele Norge med norsk bounding box.
 * Henter elevation fra OSM-tag "ele", eller fra Kartverket høyde-API om ele mangler.
 * Lagrer NDJSON til data/osm/destinations.ndjson
 *
 * Usage:
 *   npx tsx scripts/parse-osm-destinations.ts
 *   npx tsx scripts/parse-osm-destinations.ts --dry-run   (ingen fil skrives)
 *   npx tsx scripts/parse-osm-destinations.ts --limit=100
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const args = process.argv.slice(2);
const dryRun       = args.includes('--dry-run');
const skipElevation = args.includes('--skip-elevation') || dryRun; // dry-run hopper alltid over Kartverket
const limitArg = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0') || null;

// ── Config ────────────────────────────────────────────────────────────────
const OVERPASS_URLS = [
  'https://overpass.private.coffee/api/interpreter', // Ingen rate-limit (anbefalt for scripts)
  'https://overpass-api.de/api/interpreter',         // Tysk hoved-server
  'https://overpass.kumi.systems/api/interpreter',   // Sveitsisk community-mirror
];
const NORWAY_BBOX = '57.0,4.0,71.5,31.5';  // min_lat,min_lon,max_lat,max_lon

const KARTVERKET_ELEVATION_URL = 'https://ws.geonorge.no/hoydedata/v1/punkt';

const outDir  = join(process.cwd(), 'data', 'osm');
const outFile = join(outDir, 'destinations.ndjson');

// ── OSM-tag → destination_type mapping ───────────────────────────────────
const TYPE_MAP: Record<string, string> = {
  'natural:peak':          'peak',
  'natural:water':         'lake',
  'tourism:viewpoint':     'viewpoint',
  'amenity:shelter':       'shelter',
  'tourism:wilderness_hut': 'hut',
  'tourism:alpine_hut':    'hut',
};

interface OsmElement {
  type: string;
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

export interface DestinationRecord {
  sourceId: string;          // "N123456789"
  name: string;
  destinationType: string;
  lat: number;
  lon: number;
  elevationM: number | null;
  osmTags: Record<string, string>;
}

// ── Overpass-spørring ─────────────────────────────────────────────────────
function buildQuery(): string {
  // Samme format som opprinnelig TypeMap-versjon — bevisst identisk syntax
  // for å unngå at servere tolker ny syntaks ulikt.
  // Navne-filtrering skjer i prosesserings-loopen (if (!name) continue).
  const lines = [
    `node["natural"="peak"](${NORWAY_BBOX});`,
    `node["tourism"="viewpoint"](${NORWAY_BBOX});`,
    `node["amenity"="shelter"](${NORWAY_BBOX});`,
    `node["tourism"="wilderness_hut"](${NORWAY_BBOX});`,
    `node["tourism"="alpine_hut"](${NORWAY_BBOX});`,
  ].join('\n  ');
  return `[out:json][timeout:120];\n(\n  ${lines}\n);\nout body;`;
}

async function fetchOverpass(query: string): Promise<OsmElement[]> {
  for (const url of OVERPASS_URLS) {
    try {
      console.log(`  Prøver ${url}...`);
      const res = await fetch(url, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'FitHub/1.0 (fithub.no; import-script)',
          'Referer': 'https://fithub.no',
        },
        signal: AbortSignal.timeout(180_000),
      });
      if (!res.ok) {
        console.warn(`  HTTP ${res.status} — venter 5s og prøver neste`);
        await sleep(5000);
        continue;
      }
      const json = await res.json() as { elements: OsmElement[] };
      const count = json.elements?.length ?? 0;
      if (count === 0) {
        const remark = (json as Record<string, unknown>).remark ?? '(ingen remark)';
        console.warn(`  Fikk 0 elementer. Remark: ${remark} — prøver neste`);
        continue;
      }
      console.log(`  ✓ Fikk ${count} elementer`);
      return json.elements;
    } catch (e) {
      console.warn(`  Feil: ${(e as Error).message} — prøver neste`);
    }
  }
  throw new Error('Alle Overpass-servere feilet eller returnerte tomme resultater');
}

// ── Kartverket høyde-API ───────────────────────────────────────────────────
async function fetchElevation(lat: number, lon: number): Promise<number | null> {
  try {
    const url = `${KARTVERKET_ELEVATION_URL}?koordsys=4258&ost=${lon.toFixed(6)}&nord=${lat.toFixed(6)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;
    const json = await res.json() as { moh?: number };
    return typeof json.moh === 'number' ? Math.round(json.moh) : null;
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Finn destination_type fra OSM-tags ────────────────────────────────────
function resolveType(tags: Record<string, string>): string | null {
  for (const [combo, type] of Object.entries(TYPE_MAP)) {
    const [key, val] = combo.split(':');
    if (tags[key] === val) return type;
  }
  return null;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('🏔  FitHub – parse OSM-destinasjoner');
  if (dryRun) console.log('   [DRY RUN]');

  const query = buildQuery();
  console.log('\nHenter fra Overpass API...');
  const elements = await fetchOverpass(query);

  let records: DestinationRecord[] = [];
  let skippedNoName = 0;
  let skippedNoType = 0;
  let elevFromOsm   = 0;
  let elevFromKart  = 0;
  let elevMissing   = 0;

  const toProcess = limitArg ? elements.slice(0, limitArg) : elements;
  console.log(`\nBehandler ${toProcess.length} elementer...`);

  for (let i = 0; i < toProcess.length; i++) {
    const el = toProcess[i];
    const tags = el.tags ?? {};

    const name = tags.name || tags['name:no'] || tags['name:nb'];
    if (!name) { skippedNoName++; continue; }

    const destType = resolveType(tags);
    if (!destType) { skippedNoType++; continue; }

    // Elevation: OSM-tag "ele" tar prioritet, deretter Kartverket (kun hvis --skip-elevation ikke er satt)
    let elevationM: number | null = null;
    const eleTag = tags.ele ? parseFloat(tags.ele) : NaN;
    if (!isNaN(eleTag)) {
      elevationM = Math.round(eleTag);
      elevFromOsm++;
    } else if (!skipElevation) {
      // Rate-limit: 1 req/sek mot Kartverket for å unngå 429
      await sleep(1000);
      elevationM = await fetchElevation(el.lat, el.lon);
      if (elevationM !== null) elevFromKart++;
      else elevMissing++;
    } else {
      elevMissing++;
    }

    records.push({
      sourceId: `N${el.id}`,
      name: name.trim(),
      destinationType: destType,
      lat: el.lat,
      lon: el.lon,
      elevationM,
      osmTags: tags,
    });

    if ((i + 1) % 100 === 0) {
      console.log(`  ${i + 1}/${toProcess.length} behandlet (${records.length} lagret)...`);
    }
  }

  console.log('\n── Statistikk ──────────────────────────────────────');
  console.log(`  Destinasjoner: ${records.length}`);
  console.log(`  Elevation fra OSM: ${elevFromOsm}`);
  console.log(`  Elevation fra Kartverket: ${elevFromKart}`);
  console.log(`  Uten elevation: ${elevMissing}`);
  console.log(`  Hoppet over (mangler navn): ${skippedNoName}`);
  console.log(`  Hoppet over (ukjent type): ${skippedNoType}`);

  if (dryRun) {
    console.log('\n[DRY RUN] Første 3 rader:');
    records.slice(0, 3).forEach(r => console.log(JSON.stringify(r)));
    return;
  }

  if (records.length === 0) {
    console.error('\n❌ 0 destinasjoner hentet — skriver IKKE til fil (beholder evt. eksisterende data).');
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, records.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf-8');
  console.log(`\n✓ Skrevet ${records.length} rader til ${outFile}`);
}

main().catch(err => { console.error(err); process.exit(1); });
