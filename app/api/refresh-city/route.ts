/**
 * POST /api/refresh-city
 *
 * Background city data refresh triggered by user searches.
 * Runs Serper.dev searches for PT-er, ernæringsrådgivere and idrettslag
 * for the given city and pushes new results to Supabase.
 *
 * Enforces a 24-hour per-city cooldown to limit API usage.
 *
 * Body: { city: string }
 * Returns: { status: 'fresh' | 'refreshed' | 'error', added?: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';
import { getClientIp, isRateLimited } from '../../../lib/rateLimit';

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const SERPER_API_KEY = process.env.SERPER_API_KEY ?? '';
const REFRESH_SECRET = process.env.CITY_REFRESH_SECRET ?? '';

const COOLDOWN_HOURS = 24;

function hasValidRefreshSecret(req: NextRequest): boolean {
  const supplied = req.headers.get('x-refresh-secret') ?? '';
  if (!REFRESH_SECRET || supplied.length !== REFRESH_SECRET.length) return false;
  const encoder = new TextEncoder();
  return timingSafeEqual(encoder.encode(supplied), encoder.encode(REFRESH_SECRET));
}

// ── Search queries to run per city ────────────────────────────────────────────

interface SearchSpec {
  term: string;
  query: string;
  type: string;
  mainCategory: string;
  tags: string[];
  goals: string[];
  venues: string[];
  idPrefix: string;
}

const SEARCH_SPECS: SearchSpec[] = [
  // PT-er
  { term: 'personlig-trener',   query: 'personlig trener',  type: 'pt',      mainCategory: 'oppfolging',      tags: ['pt'],                        goals: ['strength','weight_loss','start'], venues: ['home','gym'],    idPrefix: 'bg_pt' },
  { term: 'personal-trainer',   query: 'personal trainer',  type: 'pt',      mainCategory: 'oppfolging',      tags: ['pt'],                        goals: ['strength','weight_loss','start'], venues: ['home','gym'],    idPrefix: 'bg_pt' },
  // Ernæring
  { term: 'ernæringsfysiolog',  query: 'ernæringsfysiolog', type: 'livsstil', mainCategory: 'oppfolging',     tags: ['ernæring'],                  goals: ['weight_loss','start'],            venues: ['home','gym'],    idPrefix: 'bg_ern' },
  { term: 'kostholdsrådgiver',  query: 'kostholdsrådgiver', type: 'livsstil', mainCategory: 'oppfolging',     tags: ['ernæring','kosthold'],        goals: ['weight_loss'],                    venues: ['home','gym'],    idPrefix: 'bg_ern' },
  // Treningssenter (trene-selv)
  { term: 'treningssenter',     query: 'treningssenter',    type: 'styrke',  mainCategory: 'trene-selv',      tags: ['treningssenter','styrke'],    goals: ['strength','weight_loss','start'], venues: ['gym'],          idPrefix: 'bg_gym' },
  { term: 'yogastudio',         query: 'yogastudio',        type: 'yoga',    mainCategory: 'trene-sammen',    tags: ['yoga','bevegelighet'],        goals: ['mobility','start'],               venues: ['gym'],          idPrefix: 'bg_yoga' },
  // Gruppe og løping (trene-sammen)
  { term: 'gruppetimer',        query: 'gruppetimer fitness', type: 'gruppe', mainCategory: 'trene-sammen',   tags: ['gruppetimer','fitness'],      goals: ['weight_loss','start','endurance'],venues: ['gym'],          idPrefix: 'bg_grp' },
  { term: 'løpegruppe',         query: 'løpegruppe',        type: 'outdoor', mainCategory: 'trene-sammen',    tags: ['løping','outdoor'],           goals: ['endurance','start'],              venues: ['outdoor'],      idPrefix: 'bg_run' },
  // Idrettslag
  { term: 'fotball',            query: 'fotballklubb',      type: 'sport',   mainCategory: 'aktivitet-sport', tags: ['fotball','idrettslag'],       goals: ['kondisjon','start'],              venues: ['outdoor','gym'], idPrefix: 'bg_sc' },
  { term: 'håndball',           query: 'håndballklubb',     type: 'sport',   mainCategory: 'aktivitet-sport', tags: ['håndball','idrettslag'],      goals: ['kondisjon','start'],              venues: ['gym'],           idPrefix: 'bg_sc' },
  { term: 'svømmeklubb',        query: 'svømmeklubb',       type: 'sport',   mainCategory: 'aktivitet-sport', tags: ['svømming','idrettslag'],      goals: ['kondisjon'],                      venues: ['gym'],           idPrefix: 'bg_sc' },
  { term: 'idrettslag',         query: 'idrettslag',        type: 'sport',   mainCategory: 'aktivitet-sport', tags: ['idrettslag'],                 goals: ['kondisjon','start'],              venues: ['outdoor','gym'], idPrefix: 'bg_sc' },
  // Helse
  { term: 'fysioterapeut',      query: 'fysioterapeut',     type: 'spesialisert', mainCategory: 'helse',      tags: ['fysioterapi','rehab'],         goals: ['rehab','mobility'],               venues: ['gym'],           idPrefix: 'bg_helse' },
  { term: 'kiropraktor',        query: 'kiropraktor',       type: 'spesialisert', mainCategory: 'helse',      tags: ['kiropraktikk','rehab'],        goals: ['rehab','mobility'],               venues: ['gym'],           idPrefix: 'bg_helse' },
  { term: 'naprapat',           query: 'naprapat',          type: 'spesialisert', mainCategory: 'helse',      tags: ['rehab','muskel'],              goals: ['rehab','mobility'],               venues: ['gym'],           idPrefix: 'bg_helse' },
  { term: 'helsestudio',        query: 'helsestudio velvære', type: 'helse',  mainCategory: 'helse',          tags: ['velvære','helse'],             goals: ['mobility','start'],               venues: ['gym'],           idPrefix: 'bg_helse' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

interface SerperPlace {
  title: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
  rating?: number;
  category?: string;
}

async function serperSearch(query: string): Promise<SerperPlace[]> {
  const res = await fetch('https://google.serper.dev/places', {
    method: 'POST',
    headers: { 'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, gl: 'no', hl: 'no', num: 5 }),
  });
  if (!res.ok) return [];
  const data = await res.json() as { places?: SerperPlace[] };
  return data.places ?? [];
}

function makeId(prefix: string, term: string, address: string): string {
  return prefix + '_' + `${term}_${address}`
    .toLowerCase()
    .replace(/[^a-zæøå0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 75);
}

function isNorwegianAddress(address?: string): boolean {
  if (!address || address.trim().length < 5) return false;
  if (!/\b\d{4}\b/.test(address)) return false;
  if (/india|new delhi|stockholm|sweden|denmark|finland|berlin|london|paris/i.test(address)) return false;
  return true;
}

function extractCity(address: string): string | null {
  const parts = address.split(',');
  const last = parts[parts.length - 1].trim();
  const match = last.match(/^\d{4}\s+(.+)$/);
  if (match) return match[1].trim().toLowerCase();
  if (last.length > 2 && last.length < 40) return last.toLowerCase();
  return null;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!REFRESH_SECRET) {
    return NextResponse.json({ status: 'error', reason: 'not configured' }, { status: 503 });
  }
  if (!hasValidRefreshSecret(req)) {
    return NextResponse.json({ status: 'error', reason: 'unauthorized' }, { status: 401 });
  }

  const ip = getClientIp(req);
  if (isRateLimited(`refresh-city:${ip}`, 5, 60_000)) {
    return NextResponse.json({ status: 'error', reason: 'rate limited' }, { status: 429 });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY || !SERPER_API_KEY) {
    return NextResponse.json({ status: 'error', reason: 'not configured' }, { status: 500 });
  }

  let city: string;
  try {
    const body = await req.json() as { city?: unknown };
    if (
      typeof body.city !== 'string' ||
      !/^[a-zæøå -]{2,60}$/i.test(body.city.trim())
    ) {
      return NextResponse.json({ status: 'error', reason: 'city required' }, { status: 400 });
    }
    city = body.city.trim().toLowerCase();
  } catch {
    return NextResponse.json({ status: 'error', reason: 'invalid json' }, { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // ── Check cooldown ─────────────────────────────────────────────────────────
  const { data: logRow } = await supabase
    .from('city_refresh_log')
    .select('last_refreshed_at')
    .eq('city', city)
    .maybeSingle();

  if (logRow?.last_refreshed_at) {
    const ageHours = (Date.now() - new Date(logRow.last_refreshed_at).getTime()) / 3_600_000;
    if (ageHours < COOLDOWN_HOURS) {
      return NextResponse.json({ status: 'fresh', ageHours: Math.round(ageHours) });
    }
  }

  // ── Mark refresh started (upsert) ─────────────────────────────────────────
  await supabase.from('city_refresh_log').upsert(
    { city, last_refreshed_at: new Date().toISOString(), refresh_count: (logRow ? 1 : 0) + 1 },
    { onConflict: 'city' },
  );

  // ── Run all specs in parallel (5 results each keeps total DB ops within Vercel 10s limit) ──
  const cityDisplay = city.charAt(0).toUpperCase() + city.slice(1);

  const runSpec = async (spec: SearchSpec): Promise<number> => {
    const places = await serperSearch(`${spec.query} ${cityDisplay}`);
    let count = 0;

    for (const place of places) {
      if (!isNorwegianAddress(place.address)) continue;

      const id = makeId(spec.idPrefix, spec.term, place.address ?? place.title);
      const effectiveCity = extractCity(place.address ?? '') ?? city;

      const serviceRow: Record<string, unknown> = {
        id,
        name: place.title,
        type: spec.type,
        main_category: spec.mainCategory,
        description: `${spec.query.charAt(0).toUpperCase() + spec.query.slice(1)} i ${cityDisplay}`,
        address: place.address ?? null,
        city: effectiveCity,
        phone: place.phone ?? null,
        website: place.website ?? null,
        rating_avg: place.rating ?? 0,
        rating_count: 0,
        is_active: true,
        tags: spec.tags,
        goals: spec.goals,
        venues: spec.venues,
        coverage: [],
        price_level: spec.type === 'pt' ? 'high' : 'medium',
        owner_user_id: null,
      };

      const { error } = await supabase
        .from('services')
        .upsert(serviceRow, { onConflict: 'id', ignoreDuplicates: true });

      if (!error) {
        if (place.latitude && place.longitude) {
          await supabase
            .from('services')
            .update({ base_location: `SRID=4326;POINT(${place.longitude} ${place.latitude})` })
            .eq('id', id);
        }
        try {
          await supabase
            .from('service_coverage')
            .insert({ service_id: id, type: 'city', city: effectiveCity });
        } catch { /* ignore duplicate */ }
        count++;
      }
    }

    return count;
  };

  const results = await Promise.allSettled(SEARCH_SPECS.map(runSpec));
  const added = results.reduce(
    (sum, r) => sum + (r.status === 'fulfilled' ? r.value : 0),
    0
  );

  return NextResponse.json({ status: 'refreshed', city, added });
}
