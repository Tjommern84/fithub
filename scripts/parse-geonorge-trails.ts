#!/usr/bin/env tsx
/**
 * Streamer Geonorge "Turrutebasen" GML (landsdekkende, ~477 MB) og skriver
 * en NDJSON-fil med én rute per linje, klar for scripts/push-geonorge-trails.ts.
 *
 * Bruker en SAX-strømparser (ikke DOM) — fila er for stor til å lastes i minnet.
 *
 * GOTCHA: GML-koordinatene er i EPSG:3035 (ETRS89-LAEA Europe). EPSG sin offisielle
 * akserekkefølge for 3035 er (Northing, Easting) — IKKE (Easting, Northing) som man
 * skulle tro. Verifisert empirisk: et testpunkt fra en rute tagget "Sør-Varanger"
 * traff Kirkenes-området (69.76°N, 30.19°E) først når parene ble byttet om før
 * reprojisering. Uten swap landet punktet feil sted (~67.5°N, 33.1°E).
 *
 * Usage:
 *   npx tsx scripts/parse-geonorge-trails.ts
 *   npx tsx scripts/parse-geonorge-trails.ts --in=filer/Friluftsliv_0000_Norge_3035_TurOgFriluftsruter_GML.gml --out=data/geonorge/trails.ndjson
 *   npx tsx scripts/parse-geonorge-trails.ts --limit=1000   (for testing)
 */

import { createReadStream, createWriteStream, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import sax from 'sax';
import proj4 from 'proj4';

proj4.defs(
  'EPSG:3035',
  '+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'
);

// ── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const inPath = args.find((a) => a.startsWith('--in='))?.split('=')[1]
  ?? 'filer/Friluftsliv_0000_Norge_3035_TurOgFriluftsruter_GML.gml';
const outPath = args.find((a) => a.startsWith('--out='))?.split('=')[1]
  ?? join('data', 'geonorge', 'trails.ndjson');
const limit = Number(args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? '0') || null;

const FEATURE_TYPE_MAP: Record<string, string> = {
  Fotrute: 'fotrute',
  Sykkelrute: 'sykkelrute',
  Skiløype: 'skiloype',
  AnnenRute: 'annet',
};
const FEATURE_TAGS = Object.keys(FEATURE_TYPE_MAP);
const INFO_TAGS = ['FotruteInfo', 'SkiløypeInfo', 'SykkelruteInfo', 'AnnenRuteInfo'];

type InfoBlock = { rutenavn?: string; maintainer?: string; difficulty?: string };
type FeatureAcc = {
  type: string;
  sourceLocalId: string | null;
  merking: string | null;
  coords: [number, number][] | null;
  infoBlocks: InfoBlock[];
  sawLokalId: boolean;
};

function pickField(blocks: InfoBlock[], field: keyof InfoBlock): string | null {
  for (const b of blocks) if (b[field] && b[field] !== 'Ukjent') return b[field] as string;
  for (const b of blocks) if (b[field]) return b[field] as string;
  return null;
}

function reproject(northing: number, easting: number): [number, number] {
  // proj4 forward expects [x, y] = [easting, northing]; see EPSG:3035 axis-order note above.
  const [lon, lat] = proj4('EPSG:3035', 'WGS84', [easting, northing]);
  return [lon, lat];
}

function parsePosList(text: string): [number, number][] {
  const nums = text.trim().split(/\s+/).map(Number);
  const coords: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const n = nums[i];
    const e = nums[i + 1];
    if (!Number.isFinite(n) || !Number.isFinite(e)) continue;
    coords.push(reproject(n, e));
  }
  return coords;
}

mkdirSync(dirname(outPath), { recursive: true });
const out = createWriteStream(outPath, { encoding: 'utf8' });

const parser = sax.createStream(true, { trim: true });
const inStream = createReadStream(inPath);

function finish() {
  out.end(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Ferdig: ${written} ruter skrevet til ${outPath} (${elapsed}s), ${skippedDegenerate} hoppet over (< 2 punkter)`);
    process.exit(0);
  });
}

let currentFeature: FeatureAcc | null = null;
let currentInfo: InfoBlock | null = null;
let textBuf = '';
let written = 0;
let skippedDegenerate = 0;
let stopping = false;
const startTime = Date.now();

parser.on('opentag', (node) => {
  textBuf = '';
  const local = node.name.split(':').pop()!;
  if (!currentFeature && FEATURE_TAGS.includes(local)) {
    currentFeature = {
      type: FEATURE_TYPE_MAP[local],
      sourceLocalId: null,
      merking: null,
      coords: null,
      infoBlocks: [],
      sawLokalId: false,
    };
  } else if (currentFeature && INFO_TAGS.includes(local)) {
    currentInfo = {};
  }
});

parser.on('text', (t) => {
  textBuf += t;
});

parser.on('closetag', (name) => {
  try {
    handleCloseTag(name);
  } catch (err) {
    console.error('Hopper over rute pga. feil:', (err as Error).message);
    currentFeature = null;
    currentInfo = null;
  }
});

function handleCloseTag(name: string) {
  const local = name.split(':').pop()!;
  const value = textBuf.trim();
  textBuf = '';

  if (currentFeature) {
    if (local === 'lokalId' && !currentFeature.sawLokalId) {
      currentFeature.sourceLocalId = value;
      currentFeature.sawLokalId = true;
    } else if (local === 'merking' && !currentInfo) {
      currentFeature.merking = value;
    } else if (local === 'posList' && !currentFeature.coords) {
      currentFeature.coords = parsePosList(value);
    } else if (currentInfo) {
      if (local === 'rutenavn') currentInfo.rutenavn = value;
      else if (local === 'vedlikeholdsansvarlig') currentInfo.maintainer = value;
      else if (local === 'gradering') currentInfo.difficulty = value;
    }
  }

  if (INFO_TAGS.includes(local) && currentInfo) {
    currentFeature?.infoBlocks.push(currentInfo);
    currentInfo = null;
  }

  if (FEATURE_TAGS.includes(local) && currentFeature) {
    const f = currentFeature;
    currentFeature = null;
    if (!f.coords || f.coords.length < 2) {
      skippedDegenerate++;
      return;
    }
    const record = {
      type: f.type,
      sourceLocalId: f.sourceLocalId,
      name: pickField(f.infoBlocks, 'rutenavn'),
      maintainer: pickField(f.infoBlocks, 'maintainer'),
      difficulty: pickField(f.infoBlocks, 'difficulty'),
      marked: f.merking === 'JA' ? true : f.merking === 'NEI' ? false : null,
      coords: f.coords,
    };
    out.write(JSON.stringify(record) + '\n');
    written++;
    if (written % 10000 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`...${written} ruter skrevet (${elapsed}s)`);
    }
    if (limit && written >= limit && !stopping) {
      stopping = true;
      console.log(`Nådde --limit=${limit}, stopper.`);
      inStream.destroy();
      finish();
    }
  }
}

parser.on('error', function (this: { _parser: { error: unknown; resume: () => void } }, err) {
  console.error('SAX-feil (fortsetter):', err.message);
  this._parser.error = null;
  this._parser.resume();
});

parser.on('end', finish);

console.log(`Leser ${inPath} ...`);
inStream.pipe(parser);
