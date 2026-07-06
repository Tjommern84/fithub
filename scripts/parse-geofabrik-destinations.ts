#!/usr/bin/env tsx
/**
 * Parser Geofabrik Norway OSM-extract (PBF-format) og skriver destinasjoner til NDJSON.
 *
 * Forutsetning: last ned filen fra Geofabrik FØRST:
 *   curl -L -o data/geofabrik/norway-latest.osm.pbf \
 *     https://download.geofabrik.de/europe/norway-latest.osm.pbf
 *   (ca. 70 MB, tar 2–5 min å laste ned)
 *
 * Output er identisk med parse-osm-destinations.ts — push-osm-destinations.ts
 * kan brukes uendret med --in=data/geofabrik/destinations.ndjson
 *
 * Usage:
 *   npx tsx scripts/parse-geofabrik-destinations.ts
 *   npx tsx scripts/parse-geofabrik-destinations.ts --in=data/geofabrik/norway-latest.osm.pbf
 *   npx tsx scripts/parse-geofabrik-destinations.ts --dry-run
 */

import { createReadStream, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const OsmPbfParser = require('osm-pbf-parser');

const args     = process.argv.slice(2);
const dryRun   = args.includes('--dry-run');
const inPath   = args.find(a => a.startsWith('--in='))?.split('=')[1]
  ?? join('data', 'geofabrik', 'norway-latest.osm.pbf');
const outDir   = join(process.cwd(), 'data', 'geofabrik');
const outFile  = join(outDir, 'destinations.ndjson');

// ── Hvilke OSM-tags vi vil ha ──────────────────────────────────────────────
const WANTED: Record<string, Set<string>> = {
  natural:  new Set(['peak']),
  tourism:  new Set(['viewpoint', 'wilderness_hut', 'alpine_hut']),
  amenity:  new Set(['shelter', 'parking']),
};

function resolveType(tags: Record<string, string>): string | null {
  if (WANTED.natural?.has(tags.natural))  return 'peak';
  if (WANTED.tourism?.has(tags.tourism))  return tags.tourism === 'viewpoint' ? 'viewpoint' : 'hut';
  if (tags.amenity === 'shelter')         return 'shelter';
  if (tags.amenity === 'parking') {
    // Hopp over private/underjordiske og de uten navn
    if (tags.access === 'private' || tags.access === 'no') return null;
    if (tags.parking === 'underground' || tags.parking === 'multi-storey') return null;
    if (!tags.name) return null; // Kun navngitte parkeringsplasser
    return 'parking';
  }
  return null;
}

// ── Identisk output-type som parse-osm-destinations.ts ────────────────────
interface DestinationRecord {
  sourceId:        string;
  name:            string;
  destinationType: string;
  lat:             number;
  lon:             number;
  elevationM:      number | null;
  osmTags:         Record<string, string>;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('🏔  FitHub – parse Geofabrik Norway PBF');
  if (dryRun) console.log('   [DRY RUN]');
  console.log(`   Innfil: ${inPath}`);

  if (!existsSync(inPath)) {
    console.error(`\n❌ Finner ikke ${inPath}`);
    console.error('\nLast ned filen med:');
    console.error('  curl -L -o data/geofabrik/norway-latest.osm.pbf \\');
    console.error('    https://download.geofabrik.de/europe/norway-latest.osm.pbf');
    process.exit(1);
  }

  const records: DestinationRecord[] = [];
  let total = 0;
  let skippedNoName = 0;
  let skippedNoType = 0;

  const parser = new OsmPbfParser();

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(inPath);

    parser.on('data', (items: unknown[]) => {
      for (const item of items) {
        const node = item as { type: string; id: number; lat?: number; lon?: number; tags?: Record<string, string> };
        if (node.type !== 'node') continue;
        if (node.lat == null || node.lon == null) continue;

        total++;
        const tags = node.tags ?? {};
        const destType = resolveType(tags);
        if (!destType) { skippedNoType++; continue; }

        const name = tags.name || tags['name:no'] || tags['name:nb'];
        if (!name) { skippedNoName++; continue; }

        const eleRaw = tags.ele ? parseFloat(tags.ele) : NaN;
        const elevationM = isNaN(eleRaw) ? null : Math.round(eleRaw);

        records.push({
          sourceId:        `N${node.id}`,
          name:            name.trim(),
          destinationType: destType,
          lat:             node.lat,
          lon:             node.lon,
          elevationM,
          osmTags:         tags,
        });
      }

      if (records.length % 5000 === 0 && records.length > 0) {
        process.stdout.write(`\r  ${records.length} lagret (${total} noder behandlet)...`);
      }
    });

    parser.on('error', reject);
    parser.on('end', resolve);
    stream.on('error', reject);
    stream.pipe(parser);
  });

  console.log(`\n\n── Statistikk ──────────────────────────────────────`);
  console.log(`  OSM-noder totalt:        ${total}`);
  console.log(`  Destinasjoner funnet:    ${records.length}`);
  console.log(`  Med elevation (OSM ele): ${records.filter(r => r.elevationM != null).length}`);
  console.log(`  Uten elevation:          ${records.filter(r => r.elevationM == null).length}`);
  console.log(`  Hoppet over (uten navn): ${skippedNoName}`);
  console.log(`  Hoppet over (feil type): ${skippedNoType}`);

  if (dryRun) {
    console.log('\n[DRY RUN] Første 3 rader:');
    records.slice(0, 3).forEach(r => console.log(JSON.stringify(r)));
    return;
  }

  if (records.length === 0) {
    console.error('\n❌ Ingen destinasjoner funnet — skriver ikke til fil.');
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, records.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf-8');
  console.log(`\n✓ Skrevet ${records.length} rader til ${outFile}`);
  console.log('\nNeste steg:');
  console.log(`  npx tsx scripts/push-osm-destinations.ts --in=${outFile}`);
}

main().catch(err => { console.error(err); process.exit(1); });
