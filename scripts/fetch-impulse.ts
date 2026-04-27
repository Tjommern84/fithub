#!/usr/bin/env tsx
/**
 * Henter alle Impulse-senter fra WordPress REST API og inserter i DB.
 * Skraper enkeltside per senter for adresse (JSON-LD eller HTML-fallback).
 *
 * Usage:
 *   npx tsx scripts/fetch-impulse.ts --dry-run
 *   npx tsx scripts/fetch-impulse.ts
 */
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';

loadEnvConfig(process.cwd());

const DRY_RUN = process.argv.includes('--dry-run');
const API_URL = 'https://www.impulse.no/wp-json/wp/v2/center?per_page=100';
const USER_AGENT = 'FitHub/1.0 (tjommern@gmail.com)';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Fallback mapping when page scraping fails
const SLUG_TO_CITY: Record<string, string> = {
  'hommelvik': 'hommelvik',
  'melhus': 'melhus',
  'stjordal': 'stjørdal',
  'pirbadet': 'trondheim',
  'leangen': 'trondheim',
  'lade': 'trondheim',
  'lerkendal': 'trondheim',
  'solsiden': 'trondheim',
  'nardobakken': 'trondheim',
  'rosten': 'trondheim',
  'granasen': 'trondheim',
  'grilstad-marina': 'trondheim',
  'leuthenhave': 'trondheim',
  'leuthenhaven': 'trondheim',
};

interface WpCenter {
  id: number;
  slug: string;
  link: string;
  title: { rendered: string };
}

interface ScrapedDetails {
  address: string | null;
  city: string | null;
  lat: number | null;
  lon: number | null;
}

async function fetchCenterList(): Promise<WpCenter[]> {
  const res = await fetch(API_URL, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fra Impulse WP API`);
  return res.json() as Promise<WpCenter[]>;
}

async function scrapeCenter(url: string): Promise<ScrapedDetails> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { address: null, city: null, lat: null, lon: null };
    const html = await res.text();

    // Try JSON-LD first
    const ldMatches = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
    for (const m of ldMatches) {
      try {
        const ld = JSON.parse(m[1]) as Record<string, unknown>;
        const loc = (ld['location'] ?? ld) as Record<string, unknown>;
        const addrObj = loc['address'] as Record<string, string> | undefined;
        const geoObj = loc['geo'] as Record<string, number> | undefined;
        if (addrObj?.streetAddress) {
          const street = addrObj.streetAddress;
          const postal = addrObj.postalCode ?? '';
          const locality = addrObj.addressLocality ?? '';
          const fullAddress = [street, [postal, locality].filter(Boolean).join(' ')].filter(Boolean).join(', ');
          const city = locality.toLowerCase() || null;
          return {
            address: fullAddress || null,
            city,
            lat: geoObj?.latitude ?? null,
            lon: geoObj?.longitude ?? null,
          };
        }
      } catch { /* skip malformed */ }
    }

    // Fallback: look for address text patterns in HTML
    const addrMatch = html.match(/(?:adresse|address)[^"]*"[^"]*"[^>]*>([^<]{5,80})</i)
      ?? html.match(/<address[^>]*>[\s\S]{0,20}([A-ZÆØÅ][a-zæøå\s]+\d[\d\s\w,]*\d{4}\s+[A-ZÆØÅ][a-zæøå\s]+)/);
    if (addrMatch) {
      const raw = addrMatch[1].replace(/\s+/g, ' ').trim();
      const cityM = raw.match(/\d{4}\s+([^,\n]+)/);
      return { address: raw, city: cityM?.[1].trim().toLowerCase() ?? null, lat: null, lon: null };
    }

    return { address: null, city: null, lat: null, lon: null };
  } catch {
    return { address: null, city: null, lat: null, lon: null };
  }
}

async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=no&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'no' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const results = await res.json() as Array<{ lat: string; lon: string }>;
    return results.length ? { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) } : null;
  } catch {
    return null;
  }
}

async function main() {
  console.log(`\nfetch-impulse${DRY_RUN ? '  DRY RUN' : ''}\n`);

  console.log('Henter senterliste fra Impulse WP API...');
  const centers = await fetchCenterList();
  console.log(`Fant ${centers.length} Impulse-senter\n`);

  if (DRY_RUN) {
    for (const c of centers) {
      const fallbackCity = SLUG_TO_CITY[c.slug] ?? null;
      console.log(`  [dry] impulse_${c.slug.padEnd(30)} fallback-by: ${fallbackCity ?? '?'}`);
    }
    console.log('\n[dry-run] Ingen endringer skrevet.\n');
    return;
  }

  let ok = 0, failed = 0;
  let lastGeocode = 0;

  for (const center of centers) {
    const id = `impulse_${center.slug}`;
    const name = center.title.rendered.replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)));
    process.stdout.write(`  ${name.padEnd(40)} `);

    // Scrape page for address/coords
    const details = await scrapeCenter(center.link);

    const city = details.city ?? SLUG_TO_CITY[center.slug] ?? null;
    let coords: { lat: number; lon: number } | null =
      details.lat && details.lon ? { lat: details.lat, lon: details.lon } : null;

    // Geocode if no coords yet
    if (!coords) {
      const geocodeQuery = details.address ?? `Impulse ${name}, ${city ?? 'Trondheim'}, Norge`;
      const now = Date.now();
      const wait = 1100 - (now - lastGeocode);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      coords = await geocodeAddress(geocodeQuery);
      lastGeocode = Date.now();
    }

    const pointWkt = coords ? `SRID=4326;POINT(${coords.lon} ${coords.lat})` : null;

    const { error: svcErr } = await supabase.from('services').upsert({
      id,
      name,
      address: details.address,
      type: 'styrke',
      main_category: 'trene-selv',
      description: 'Impulse treningssenter',
      price_level: 'medium',
      venues: ['gym'],
      goals: ['strength', 'weight_loss', 'endurance', 'start'],
      tags: ['treningssenter', 'styrketrening', 'kondisjon', 'impulse', 'trondheim'],
      is_active: true,
      website: center.link,
      ...(pointWkt ? { base_location: pointWkt } : {}),
    }, { onConflict: 'id' });

    if (svcErr) {
      console.log(`❌ service: ${svcErr.message}`);
      failed++;
      continue;
    }

    if (city) {
      const { data: existingCov } = await supabase
        .from('service_coverage')
        .select('id')
        .eq('service_id', id)
        .eq('type', 'city')
        .eq('city', city)
        .maybeSingle();

      if (!existingCov) {
        const { error: covErr } = await supabase.from('service_coverage').insert({
          service_id: id,
          type: 'city',
          city,
        });
        if (covErr) console.log(`  ⚠️  coverage: ${covErr.message}`);
      }
    }

    await supabase.from('service_types').upsert(
      ['styrke', 'kondisjon', 'gruppe'].map((t) => ({ service_id: id, type: t })),
      { onConflict: 'service_id,type' }
    );

    console.log(`✅ ${id} ${coords ? '📍' : '  '} ${city ?? '?'}`);
    ok++;
  }

  console.log(`\nFerdig.  OK: ${ok}  Feilet: ${failed}\n`);
}

main().catch(console.error);
