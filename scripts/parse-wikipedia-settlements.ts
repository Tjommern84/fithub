#!/usr/bin/env tsx
/**
 * Henter og parser de 15 "Tettsteder i [fylke]"-sidene fra norsk Wikipedia
 * (rendret HTML via action=parse&prop=text — befolkning/areal/tetthet finnes
 * KUN i rendret HTML, ikke i rå wikitext, se handoff.md "Backend steg 1: verifisering").
 *
 * Sidelisten er verifisert mot Wikipedias kategori-API (Kategori:Lister over
 * tettsteder i Norge), IKKE hardkodet fra hukommelse — Norge har 15 fylker i
 * dagens struktur, ikke de historiske ~19. Utdaterte/supplanterte sider
 * (Buskerud 2017, Hedmark, Hordaland, Oppland, Sogn og Fjordane, Troms og
 * Finnmark, Vestfold og Telemark, Viken, samt gamle Sør-/Nord-Trøndelag og
 * Vestland nord/sør) er bevisst utelatt.
 *
 * Radklassifisering (CSS-klasse på <tr>, bekreftet empirisk):
 *   - class innholder "kommsplit"      -> per-kommune-underrad, ALLTID skippes
 *                                          (8-sifret nummer = 4-sifret foreldre + 4-sifret kommunenr,
 *                                           mangler alltid befolkning/koordinat i rendret HTML)
 *   - 3. kolonne tekst = "Tilsammen"   -> aggregatrad for multi-kommune-tettsted, BRUKES
 *                                          (municipality settes til null - spenner flere kommuner)
 *   - ellers                            -> enkel rad, ett tettsted i én kommune, BRUKES
 *
 * Rader uten parseable koordinat i siste kolonne hoppes over (kan ikke plottes).
 * Dedup på tettstedsnummer (source_local_id) tvers av sider: befolkning og koordinat
 * er identiske uansett hvilken fylkeside et grensetettsted vises på (bekreftet for 0801
 * Oslo på både Oslo- og Buskerud-siden) - første forekomst vinner, resten telles som duplikat.
 *
 * Usage:
 *   npx tsx scripts/parse-wikipedia-settlements.ts
 *   npx tsx scripts/parse-wikipedia-settlements.ts --out=data/wikipedia/settlements.ndjson
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';

const args = process.argv.slice(2);
const outPath = args.find((a) => a.startsWith('--out='))?.split('=')[1]
  ?? join('data', 'wikipedia', 'settlements.ndjson');

// Verifisert via Wikipedias kategori-API mot Kategori:Lister over tettsteder i Norge — se handoff.md.
const COUNTY_PAGES = [
  'Østfold', 'Akershus', 'Oslo', 'Innlandet', 'Buskerud', 'Vestfold', 'Telemark',
  'Agder', 'Rogaland', 'Vestland', 'Møre og Romsdal', 'Trøndelag', 'Nordland',
  'Troms', 'Finnmark',
];

type Settlement = {
  sourceLocalId: string;
  name: string;
  county: string;
  municipality: string | null;
  population: number | null;
  lon: number;
  lat: number;
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#160;|&nbsp;/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, '')).trim();
}

function parsePopulation(cellHtml: string): number | null {
  const text = stripTags(cellHtml).replace(/\s+/g, '');
  if (!text) return null;
  const n = parseInt(text, 10);
  return Number.isFinite(n) ? n : null;
}

function dmsToDecimal(deg: number, min: number, hemisphere: string): number {
  const value = deg + min / 60;
  return hemisphere === 'S' || hemisphere === 'V' ? -value : value;
}

function parseCoordCell(cellHtml: string): { lat: number; lon: number } | null {
  const latMatch = cellHtml.match(/class="latitude">(\d+)°(\d+)(?:′|&#8242;)([NS])/);
  const lonMatch = cellHtml.match(/class="longitude">(\d+)°(\d+)(?:′|&#8242;)([ØEV])/);
  if (!latMatch || !lonMatch) return null;
  const lat = dmsToDecimal(Number(latMatch[1]), Number(latMatch[2]), latMatch[3]);
  const lon = dmsToDecimal(Number(lonMatch[1]), Number(lonMatch[2]), lonMatch[3] === 'Ø' ? 'E' : lonMatch[3]);
  return { lat, lon };
}

function extractCells(rowHtml: string): string[] {
  const cells: string[] = [];
  const re = /<td[^>]*>([\s\S]*?)<\/td>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rowHtml)) !== null) cells.push(m[1]);
  return cells;
}

function parsePage(html: string, county: string): { rows: Settlement[]; skippedSplit: number; skippedNoCoord: number } {
  const rows: Settlement[] = [];
  let skippedSplit = 0;
  let skippedNoCoord = 0;

  const rowRe = /<tr([^>]*)>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const attrs = m[1];
    const inner = m[2];

    if (/class="[^"]*kommsplit[^"]*"/.test(attrs)) {
      skippedSplit++;
      continue;
    }

    const cells = extractCells(inner);
    if (cells.length < 7) continue; // header row or malformed, not a data row

    const sourceLocalId = stripTags(cells[0]);
    if (!/^\d{4}$/.test(sourceLocalId)) continue; // defensive: only accept 4-digit numbers

    const name = stripTags(cells[1]);
    const kommuneText = stripTags(cells[2]);
    const isAggregate = kommuneText === 'Tilsammen';
    const municipality = isAggregate ? null : (kommuneText || null);
    const population = parsePopulation(cells[3]);

    const coords = parseCoordCell(cells[6]);
    if (!coords) {
      skippedNoCoord++;
      continue;
    }

    rows.push({
      sourceLocalId,
      name,
      county,
      municipality,
      population,
      lon: coords.lon,
      lat: coords.lat,
    });
  }

  return { rows, skippedSplit, skippedNoCoord };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(title: string, retries = 3): Promise<string> {
  const url = `https://no.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(`Tettsteder i ${title}`)}&prop=text&format=json&formatversion=2`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'fithub-settlements-import/1.0' } });
    if (res.status === 429) {
      const waitMs = 5000 * attempt;
      console.log(`  (429 for ${title}, venter ${waitMs}ms før forsøk ${attempt + 1}/${retries})`);
      await sleep(waitMs);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${title}`);
    const json = await res.json() as { parse?: { text?: string }; error?: { info?: string } };
    if (json.error) throw new Error(`Wikipedia API-feil for ${title}: ${json.error.info}`);
    if (!json.parse?.text) throw new Error(`Tomt svar for ${title}`);
    return json.parse.text;
  }
  throw new Error(`Ga opp etter ${retries} forsøk (429) for ${title}`);
}

async function main() {
  console.log(`Henter ${COUNTY_PAGES.length} fylkesider fra norsk Wikipedia...\n`);

  const seen = new Map<string, Settlement>();
  let duplicates = 0;
  let totalSkippedSplit = 0;
  let totalSkippedNoCoord = 0;

  for (const county of COUNTY_PAGES) {
    try {
      const html = await fetchPage(county);
      const { rows, skippedSplit, skippedNoCoord } = parsePage(html, county);
      totalSkippedSplit += skippedSplit;
      totalSkippedNoCoord += skippedNoCoord;

      let newCount = 0;
      for (const r of rows) {
        if (seen.has(r.sourceLocalId)) {
          duplicates++;
        } else {
          seen.set(r.sourceLocalId, r);
          newCount++;
        }
      }
      console.log(`${county.padEnd(20)} ${rows.length.toString().padStart(4)} rader  (${newCount} nye, ${rows.length - newCount} duplikat, ${skippedSplit} underrad-skip, ${skippedNoCoord} uten koordinat)`);
    } catch (err) {
      console.error(`FEIL ved ${county}:`, err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
    await sleep(1500);
  }

  const settlements = Array.from(seen.values());
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, settlements.map((s) => JSON.stringify(s)).join('\n') + '\n', 'utf-8');

  console.log(`\nFerdig.`);
  console.log(`Unike tettsteder: ${settlements.length}`);
  console.log(`Duplikater (samme tettstedsnummer på flere fylkesider, hoppet over): ${duplicates}`);
  console.log(`Underrad-skip totalt (kommsplit): ${totalSkippedSplit}`);
  console.log(`Uten koordinat totalt (skippet): ${totalSkippedNoCoord}`);
  console.log(`Output: ${outPath}`);
}

main();
