#!/usr/bin/env tsx
/**
 * Henter og parser "Liste over norske byer" fra norsk Wikipedia — 108 byer i to
 * wikitabeller ("De grunnleggende byene" + "Byer som kalles by etter vedtak i
 * kommunestyret"). Ekstraksjon avgrenset til mellom "== Byer i Norge ==" og
 * "== Historie ==" — en uavgrenset ekstraksjon fanger også opp en senere
 * "Historiske folketall"-tabell på samme side og gir feilaktig 307 rader
 * i stedet for 108 (verifisert empirisk under planlegging, se handoff.md).
 *
 * Tabellen har INGEN koordinater. Koordinater løses i
 * scripts/push-wikipedia-cities.ts ved å matche mot allerede importerte
 * `settlements`-rader (961 tettsteder), med Nominatim-geokoding som fallback.
 *
 * Usage:
 *   npx tsx scripts/parse-wikipedia-cities.ts
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';

const args = process.argv.slice(2);
const outPath = args.find((a) => a.startsWith('--out='))?.split('=')[1]
  ?? join('data', 'wikipedia', 'cities.ndjson');

type City = {
  name: string;
  municipality: string | null;
  county: string | null;
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#160;|&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function stripWikiLinks(cell: string): string {
  return decodeEntities(
    cell
      .replace(/\{\{[^}]*\}\}/g, '') // maler, f.eks. {{sorter|0997}}
      .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/<ref[^>]*\/>/g, '')
      .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
      .replace(/\w+="[^"]*"\s*\|/g, '') // f.eks. align="center"|, valign="top"|
  ).trim().replace(/^\|\s*/, ''); // enkelte rader har et villedende ekstra | inni cellen
}

function parseRow(rowBlock: string): City | null {
  const dataLine = rowBlock.split('\n').map((l) => l.trim()).find((l) => l.startsWith('|') && !l.startsWith('|}'));
  if (!dataLine) return null;

  const cells = dataLine.slice(1).split('||').map((c) => c.trim());
  if (cells.length < 4) return null;

  const name = stripWikiLinks(cells[0]);
  if (!name) return null;

  // Kolonneantall varierer mellom de to tabellene (første har ekstra "Tildelt av"-kolonne),
  // men begge ender alltid med [..., Kommune, Kommunenr, Fylke] — verifisert empirisk.
  const municipality = cells.length >= 3 ? stripWikiLinks(cells[cells.length - 3] ?? '') || null : null;
  const county = stripWikiLinks(cells[cells.length - 1] ?? '') || null;

  return { name, municipality, county };
}

async function main() {
  console.log('Henter "Liste over norske byer" fra norsk Wikipedia...\n');

  const url = 'https://no.wikipedia.org/w/api.php?action=parse&page=Liste%20over%20norske%20byer&prop=wikitext&format=json&formatversion=2';
  const res = await fetch(url, { headers: { 'User-Agent': 'fithub-cities-import/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json() as { parse?: { wikitext?: string }; error?: { info?: string } };
  if (json.error) throw new Error(`Wikipedia API-feil: ${json.error.info}`);
  const wikitext = json.parse?.wikitext;
  if (!wikitext) throw new Error('Tomt svar fra Wikipedia');

  const start = wikitext.indexOf('== Byer i Norge ==');
  const end = wikitext.indexOf('== Historie ==');
  if (start === -1 || end === -1) throw new Error('Fant ikke forventede sideoverskrifter — sidestrukturen kan ha endret seg');
  const slice = wikitext.slice(start, end);

  const blocks = slice.split('\n|-');
  const cities: City[] = [];
  for (const block of blocks) {
    const city = parseRow(block);
    if (city) cities.push(city);
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, cities.map((c) => JSON.stringify(c)).join('\n') + '\n', 'utf-8');

  console.log(`Fant ${cities.length} byer (forventet: 108)`);
  if (cities.length !== 108) {
    console.warn('\n⚠️  ADVARSEL: Antall avviker fra forventet 108 — sidestrukturen kan ha endret seg. Inspiser output manuelt før push.');
  }
  console.log(`Output: ${outPath}`);
  console.log('\nEksempler:', cities.slice(0, 3));
}

main();
