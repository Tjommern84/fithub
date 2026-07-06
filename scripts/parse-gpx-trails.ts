#!/usr/bin/env tsx
/**
 * Proof-of-concept: importer enkeltstående GPX-filer fra UT.no til `trails`.
 *
 * IKKE en produksjonsklar pipeline — bruker laster ned filer manuelt til
 * turer/ og kjører dette scriptet for å teste om GPX-import fungerer, før
 * noe automatisert bygges. Bevisst enkel: regex-parsing, ikke sax/DOM —
 * filene er små (<100KB) og strukturen er triviell (ett <trk>/<trkseg> per
 * fil, allerede WGS84, allerede én sammenhengende linje, ikke fragmentert
 * som Geonorge-dataen).
 *
 * Usage:
 *   npx tsx scripts/parse-gpx-trails.ts
 *   npx tsx scripts/parse-gpx-trails.ts --dry-run
 */

import { readFileSync, readdirSync } from 'fs';
import { join, basename, extname } from 'path';
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';

loadEnvConfig(process.cwd());

const DRY_RUN = process.argv.includes('--dry-run');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const GPX_DIR = join(process.cwd(), 'turer');

// Samme prinsipp som scripts/push-geonorge-trails.ts — ingen ny avhengighet.
const EARTH_RADIUS_KM = 6371;
function haversineKm(a: [number, number], b: [number, number]): number {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
function lineLengthKm(coords: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversineKm(coords[i - 1], coords[i]);
  return total;
}
function toWkt(coords: [number, number][]): string {
  return `LINESTRING(${coords.map(([lon, lat]) => `${lon} ${lat}`).join(', ')})`;
}

function inferTrailType(name: string): 'fotrute' | 'skiloype' | 'sykkelrute' | 'annet' {
  const lower = name.toLowerCase();
  if (lower.includes('fottur')) return 'fotrute';
  if (lower.includes('skiløype') || lower.includes('skitur')) return 'skiloype';
  if (lower.includes('sykkeltur') || lower.includes('sykkelrute')) return 'sykkelrute';
  return 'annet'; // f.eks. kajakktur — ingen bedre passende verdi i dagens CHECK-constraint
}

function parseGpx(xml: string): { name: string; coords: [number, number][] } {
  const nameMatch = xml.match(/<metadata>[\s\S]*?<name>([^<]+)<\/name>/);
  const name = nameMatch ? nameMatch[1].trim() : 'Ukjent';

  const coords: [number, number][] = [];
  const trkptRe = /<trkpt\s+lat="(-?[\d.]+)"\s+lon="(-?[\d.]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = trkptRe.exec(xml)) !== null) {
    coords.push([Number(m[2]), Number(m[1])]); // [lon, lat]
  }
  return { name, coords };
}

async function main() {
  console.log('🥾 FitHub – GPX-import proof of concept (UT.no)');
  if (DRY_RUN) console.log('   [DRY RUN]\n');

  const files = readdirSync(GPX_DIR).filter((f) => f.endsWith('.gpx'));
  if (files.length === 0) {
    console.error(`❌ Ingen .gpx-filer funnet i ${GPX_DIR}`);
    process.exit(1);
  }
  console.log(`Fant ${files.length} GPX-fil(er) i ${GPX_DIR}\n`);

  for (const file of files) {
    const filePath = join(GPX_DIR, file);
    const xml = readFileSync(filePath, 'utf-8');
    const { name, coords } = parseGpx(xml);
    const lengthKm = lineLengthKm(coords);
    const trailType = inferTrailType(name);
    const sourceLocalId = basename(file, extname(file));

    console.log(`📄 ${file}`);
    console.log(`   Navn       : ${name}`);
    console.log(`   Punkter    : ${coords.length}`);
    console.log(`   Lengde     : ${lengthKm.toFixed(2)} km`);
    console.log(`   trail_type : ${trailType}`);
    console.log(`   source_id  : ${sourceLocalId}`);

    if (coords.length < 2) {
      console.log('   ✗ Hoppet over — under 2 punkter, ikke en gyldig linje\n');
      continue;
    }

    if (DRY_RUN) {
      console.log('   [DRY] Ville upsertet til trails\n');
      continue;
    }

    const { error } = await supabase.from('trails').upsert(
      {
        source: 'ut.no',
        source_local_id: sourceLocalId,
        name,
        trail_type: trailType,
        maintainer: 'UT.no',
        marked: null,
        difficulty: null,
        length_km: Number(lengthKm.toFixed(3)),
        geom: `SRID=4326;${toWkt(coords)}`,
      },
      { onConflict: 'source,source_local_id' }
    );

    if (error) {
      console.error(`   ✗ Feil: ${error.message}\n`);
    } else {
      console.log('   ✓ Lagret\n');
    }
  }

  console.log(DRY_RUN ? 'Ferdig [DRY RUN].' : 'Ferdig.');
}

main();
