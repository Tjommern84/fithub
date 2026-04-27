#!/usr/bin/env tsx
/**
 * Henter alle 3T-senter fra sitemap.xml og inserter i DB.
 * Skraper enkeltside per senter for adresse + koordinater (JSON-LD / Maps embed).
 *
 * Usage:
 *   npx tsx scripts/fetch-3t.ts --dry-run
 *   npx tsx scripts/fetch-3t.ts
 */
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';

loadEnvConfig(process.cwd());

const DRY_RUN = process.argv.includes('--dry-run');
const LISTING_URL = 'https://www.3t.no/treningssenter';
const BASE_URL = 'https://www.3t.no';
const USER_AGENT = 'FitHub/1.0 (tjommern@gmail.com)';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

interface GymEntry {
  slug: string;
  url: string;
}

interface ScrapedDetails {
  name: string | null;
  address: string | null;
  city: string | null;
  lat: number | null;
  lon: number | null;
}

async function fetchGymList(): Promise<GymEntry[]> {
  const res = await fetch(LISTING_URL, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fra 3T listeside`);
  const html = await res.text();

  const seen = new Set<string>();
  const entries: GymEntry[] = [];
  for (const m of html.matchAll(/href="\/treningssenter\/([^"\/]+)"/g)) {
    const slug = m[1];
    if (slug === 'treningssenter') continue;
    if (!seen.has(slug)) {
      seen.add(slug);
      entries.push({ slug, url: `${BASE_URL}/treningssenter/${slug}` });
    }
  }
  return entries;
}

async function scrapePage(url: string): Promise<ScrapedDetails> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { name: null, address: null, city: null, lat: null, lon: null };
    const html = await res.text();

    let name: string | null = null;
    let address: string | null = null;
    let city: string | null = null;
    let lat: number | null = null;
    let lon: number | null = null;

    // JSON-LD
    const ldMatches = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
    for (const m of ldMatches) {
      try {
        const ld = JSON.parse(m[1]) as Record<string, unknown>;
        const items = Array.isArray(ld['@graph'])
          ? (ld['@graph'] as Record<string, unknown>[])
          : [ld];
        for (const item of items) {
          const addrObj = item['address'] as Record<string, string> | undefined;
          const geoObj = item['geo'] as Record<string, number> | undefined;
          if (addrObj?.streetAddress) {
            name = (item['name'] as string) ?? null;
            const street = addrObj.streetAddress;
            const postal = addrObj.postalCode ?? '';
            const locality = addrObj.addressLocality ?? '';
            address = [street, [postal, locality].filter(Boolean).join(' ')].filter(Boolean).join(', ');
            city = locality.toLowerCase() || null;
            lat = geoObj?.latitude ?? null;
            lon = geoObj?.longitude ?? null;
            break;
          }
        }
        if (address) break;
      } catch { /* skip */ }
    }

    // Google Maps embed — look for both ?q=lat,lon and ?q=address forms
    if (lat === null) {
      const embedMatches = [
        ...html.matchAll(/(?:maps\.google\.com|google\.com\/maps)[^"']*[?&]q=([^"'&\s]+)/g),
        ...html.matchAll(/maps\/embed\?[^"']*pb=([^"']+)/g),
      ];
      for (const em of embedMatches) {
        const q = decodeURIComponent(em[1]);
        const coordMatch = q.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (coordMatch) {
          lat = parseFloat(coordMatch[1]);
          lon = parseFloat(coordMatch[2]);
          break;
        }
      }
    }

    // <title> for name fallback
    if (!name) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)</);
      if (titleMatch) name = titleMatch[1].split(/[|\-–]/)[0].trim();
    }

    if (!city && address) {
      const cityM = address.match(/\d{4}\s+([^,\n]+)/);
      city = cityM?.[1].trim().toLowerCase() ?? null;
    }

    return { name, address, city, lat, lon };
  } catch {
    return { name: null, address: null, city: null, lat: null, lon: null };
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

function makeId(slug: string): string {
  return '3t_' + slug
    .toLowerCase()
    .replace(/[æ]/g, 'ae').replace(/[ø]/g, 'o').replace(/[å]/g, 'a')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 57);
}

async function main() {
  console.log(`\nfetch-3t${DRY_RUN ? '  DRY RUN' : ''}\n`);

  console.log('Henter senterliste fra 3T...');
  const gyms = await fetchGymList();
  console.log(`Fant ${gyms.length} 3T-lokasjoner\n`);

  if (DRY_RUN) {
    for (const g of gyms) {
      console.log(`  [dry] ${makeId(g.slug).padEnd(35)} ${g.url}`);
    }
    console.log('\n[dry-run] Ingen endringer skrevet.\n');
    return;
  }

  let ok = 0, failed = 0;
  let lastGeocode = 0;

  for (const gym of gyms) {
    const id = makeId(gym.slug);
    process.stdout.write(`  ${gym.slug.padEnd(40)} `);

    const details = await scrapePage(gym.url);
    const displayName = details.name
      ?? ('3T ' + gym.slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));

    let coords: { lat: number; lon: number } | null =
      details.lat && details.lon ? { lat: details.lat, lon: details.lon } : null;

    if (!coords) {
      const geocodeQuery = details.address ?? `3T ${displayName}, Norge`;
      const now = Date.now();
      const wait = 1100 - (now - lastGeocode);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      coords = await geocodeAddress(geocodeQuery);
      lastGeocode = Date.now();
    }

    const pointWkt = coords ? `SRID=4326;POINT(${coords.lon} ${coords.lat})` : null;
    const city = details.city;

    const { error: svcErr } = await supabase.from('services').upsert({
      id,
      name: displayName,
      address: details.address,
      type: 'styrke',
      main_category: 'trene-selv',
      description: '3T treningssenter',
      price_level: 'medium',
      venues: ['gym'],
      goals: ['strength', 'weight_loss', 'endurance', 'start'],
      tags: ['treningssenter', 'styrketrening', 'kondisjon', '3t', 'trondheim'],
      is_active: true,
      website: gym.url,
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
      ['styrke', 'kondisjon', 'gruppe', 'pt'].map((t) => ({ service_id: id, type: t })),
      { onConflict: 'service_id,type' }
    );

    console.log(`✅ ${id} ${coords ? '📍' : '  '} ${city ?? '?'}`);
    ok++;
  }

  console.log(`\nFerdig.  OK: ${ok}  Feilet: ${failed}\n`);
}

main().catch(console.error);
