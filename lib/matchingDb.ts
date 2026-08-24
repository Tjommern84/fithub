import { supabase } from './supabaseClient';
import type { Service } from './domain';
import type { RankedService } from './matching';
import { findSettlementInQuery } from './settlementsDb';

export type SearchServicesRow = {
  service_id: string;
  name: string;
  type: Service['type'];
  description: string;
  coverage: Service['coverage'];
  price_level: Service['price_level'];
  rating_avg: number;
  rating_count: number;
  tags: string[];
  goals: Service['goals'];
  venues: Service['venues'];
  is_active: boolean;
  distance_km: number | null;
  score: number;
  reasons: string[] | null;
  match_reason: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  orgnr: string | null;
  lat: number | null;
  lon: number | null;
  cover_image_url: string | null;
  logo_image_url: string | null;
  provider_type: Service['provider_type'] | null;
};

export const mapRowToRankedService = (row: SearchServicesRow): RankedService => ({
  service: {
    id: row.service_id,
    name: row.name,
    type: row.type,
    description: row.description,
    coverage: row.coverage ?? [],
    price_level: row.price_level,
    rating_avg: row.rating_avg ?? 0,
    rating_count: row.rating_count ?? 0,
    tags: row.tags ?? [],
    goals: row.goals ?? [],
    venues: row.venues ?? [],
    is_active: row.is_active ?? true,
    address: row.address ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    website: row.website ?? null,
    orgnr: row.orgnr ?? null,
    cover_image_url: row.cover_image_url ?? null,
    logo_image_url: row.logo_image_url ?? null,
    provider_type: row.provider_type ?? 'business',
  },
  distanceKm: row.distance_km ?? undefined,
  score: row.score,
  reasons: row.reasons ?? [],
  matchReason: row.match_reason ?? '',
  lat: row.lat ?? undefined,
  lon: row.lon ?? undefined,
});

export type SearchParams = {
  type?: string;
  venue?: string;
  city?: string;
  borough?: string;
  lat?: number;
  lon?: number;
  sort?: string;
  query?: string;
  tag?: string;
  mainCategory?: string;
  tags?: string[];
  radiusKm?: number;
  limit?: number;
  page?: number;
};

export async function searchServices(params: SearchParams): Promise<RankedService[]> {
  if (!supabase) return [];
  const pageSize = params.limit ?? 50;
  const offset = ((params.page ?? 1) - 1) * pageSize;
  const baseArgs = {
    p_city: params.city ?? null,
    p_lat: params.lat ?? null,
    p_lon: params.lon ?? null,
    p_goal: 'any',
    p_service_type: params.type ?? 'any',
    p_budget: 'any',
    p_venue: params.venue && params.venue !== 'either' ? params.venue : null,
    p_sort: params.sort ?? 'best_match',
    p_query: params.query ?? null,
    p_tag: params.tag ?? null,
    p_main_category: params.mainCategory ?? null,
    p_tags: params.tags && params.tags.length > 0 ? params.tags : null,
    p_radius_km: params.radiusKm ?? null,
    p_limit: pageSize,
    // Only include p_offset when > 0 so the old function signature still works
    // until sql/13_add_offset_pagination.sql has been run in Supabase.
    ...(offset > 0 ? { p_offset: offset } : {}),
  };

  let data: unknown[] | null = null;
  let error: { message?: string; code?: string } | null = null;

  if (params.borough) {
    const withBorough = await supabase.rpc('search_services', {
      ...baseArgs,
      p_borough: params.borough,
    });
    data = withBorough.data as unknown[] | null;
    error = withBorough.error;

    const msg = `${error?.message ?? ''}`.toLowerCase();
    const shouldRetryWithoutBorough =
      !!error &&
      (msg.includes('p_borough') ||
        msg.includes('function search_services') ||
        msg.includes('could not find the function'));

    // Backward compatibility for prod environments where the SQL function
    // has not been updated to the new signature yet.
    if (shouldRetryWithoutBorough) {
      const legacy = await supabase.rpc('search_services', baseArgs);
      data = legacy.data as unknown[] | null;
      error = legacy.error;
    }
  } else {
    const res = await supabase.rpc('search_services', baseArgs);
    data = res.data as unknown[] | null;
    error = res.error;
  }

  if (error) throw error;

  return (Array.isArray(data) ? data : []).map((row) =>
    mapRowToRankedService(row as SearchServicesRow)
  );
}

export type ContentCategorySearchParams = {
  mainCategory: string;
  lat: number;
  lon: number;
  radiusKm?: number;
  limit?: number;
  page?: number;
};

/**
 * Reads category pages from the structured provider/venue/offering model.
 * Callers should retain the legacy search as a fallback until SQL 44 has
 * been deployed in every environment.
 */
export async function searchContentCategoryServices(
  params: ContentCategorySearchParams,
): Promise<RankedService[]> {
  if (!supabase) return [];
  const pageSize = Math.min(Math.max(params.limit ?? 20, 1), 100);
  const offset = (Math.max(params.page ?? 1, 1) - 1) * pageSize;
  const { data, error } = await supabase.rpc('search_content_category_services', {
    p_main_category: params.mainCategory,
    p_lat: params.lat,
    p_lon: params.lon,
    p_radius_km: params.radiusKm ?? 50,
    p_limit: pageSize,
    p_offset: offset,
  });

  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((row) =>
    mapRowToRankedService(row as SearchServicesRow)
  );
}

export type ContentResultsSearchArgs = {
  p_main_category: string | null;
  p_lat: number | null;
  p_lon: number | null;
  p_radius_km: number;
  p_service_type: string;
  p_venue: string;
  p_query: string | null;
  p_tags: string[] | null;
  p_sort: string;
  p_limit: number;
  p_offset: number;
};

export const canUseContentResultsSearch = (params: SearchParams): boolean => {
  const hasLat = Number.isFinite(params.lat);
  const hasLon = Number.isFinite(params.lon);

  // SQL 45 searches places geographically. If a caller only has a city name,
  // retain the legacy coverage search rather than silently searching Norway.
  if (params.city && (!hasLat || !hasLon)) return false;
  return !params.borough && !params.tag && hasLat === hasLon;
};

export const buildContentResultsSearchArgs = (
  params: SearchParams,
): ContentResultsSearchArgs => {
  const pageSize = Math.min(Math.max(params.limit ?? 50, 1), 100);
  const page = Math.max(params.page ?? 1, 1);

  return {
    p_main_category: params.mainCategory ?? null,
    p_lat: params.lat ?? null,
    p_lon: params.lon ?? null,
    p_radius_km: Math.min(Math.max(params.radiusKm ?? 25, 1), 200),
    p_service_type: params.type ?? 'any',
    p_venue: params.venue ?? 'either',
    p_query: params.query?.trim() || null,
    p_tags: params.tags && params.tags.length > 0 ? params.tags : null,
    p_sort: params.sort ?? (params.lat != null && params.lon != null ? 'nearest' : 'best_match'),
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  };
};

/**
 * Full structured read path for /resultater. SQL 45 returns the existing
 * RankedService contract so cards, maps and provider profile links remain
 * compatible while provider/venue/offering becomes the discovery source.
 */
export async function searchContentServices(params: SearchParams): Promise<RankedService[]> {
  if (!supabase || !canUseContentResultsSearch(params)) return [];
  const { data, error } = await supabase.rpc(
    'search_content_services',
    buildContentResultsSearchArgs(params),
  );

  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((row) =>
    mapRowToRankedService(row as SearchServicesRow)
  );
}

// ─── Tier 3: frittstående navnetreff, ingen dekningsbegrensning ──────────────
// Egen type — IKKE RankedService — siden Tier 3-rader mangler ekte deknings-/score-semantikk
// (search_services_unanchored() joiner ikke mot service_coverage).

type UnanchoredSearchRow = {
  service_id: string;
  name: string;
  type: Service['type'];
  description: string;
  city: string | null;
  address: string | null;
  tags: string[];
  rating_avg: number;
  rating_count: number;
  price_level: Service['price_level'];
  website: string | null;
  phone: string | null;
  email: string | null;
  orgnr: string | null;
  cover_image_url: string | null;
  logo_image_url: string | null;
  lat: number | null;
  lon: number | null;
  distance_km: number | null;
  similarity_score: number;
};

export type UnanchoredService = {
  id: string;
  name: string;
  type: Service['type'];
  description: string;
  city: string | null;
  address: string | null;
  tags: string[];
  rating_avg: number;
  rating_count: number;
  price_level: Service['price_level'];
  website: string | null;
  phone: string | null;
  email: string | null;
  orgnr: string | null;
  cover_image_url: string | null;
  logo_image_url: string | null;
  lat: number | null;
  lon: number | null;
  distanceKm: number | null;
  similarityScore: number;
};

const mapRowToUnanchoredService = (row: UnanchoredSearchRow): UnanchoredService => ({
  id: row.service_id,
  name: row.name,
  type: row.type,
  description: row.description,
  city: row.city ?? null,
  address: row.address ?? null,
  tags: row.tags ?? [],
  rating_avg: row.rating_avg ?? 0,
  rating_count: row.rating_count ?? 0,
  price_level: row.price_level,
  website: row.website ?? null,
  phone: row.phone ?? null,
  email: row.email ?? null,
  orgnr: row.orgnr ?? null,
  cover_image_url: row.cover_image_url ?? null,
  logo_image_url: row.logo_image_url ?? null,
  lat: row.lat ?? null,
  lon: row.lon ?? null,
  distanceKm: row.distance_km ?? null,
  similarityScore: row.similarity_score ?? 0,
});

export type UnanchoredSearchParams = {
  query: string;
  lat?: number;
  lon?: number;
  tags?: string[];
  limit?: number;
};

// Kjent å feile (gracefully, ikke throw) før sql/24_search_fallback_tiers.sql er kjørt
// av bruker — funksjonen finnes ikke i Supabase ennå. Samme mønster som getSettlementsInBounds.
export async function searchServicesUnanchored(
  params: UnanchoredSearchParams
): Promise<UnanchoredService[]> {
  if (!supabase) return [];
  const baseArgs = {
    p_query: params.query,
    p_lat: params.lat ?? null,
    p_lon: params.lon ?? null,
    p_limit: params.limit ?? 20,
  };
  const tags = params.tags && params.tags.length > 0 ? params.tags : null;

  const withTags = await supabase.rpc('search_services_unanchored', { ...baseArgs, p_tags: tags });
  let data = withTags.data as unknown[] | null;
  let error = withTags.error;

  const msg = `${error?.message ?? ''}`.toLowerCase();
  const shouldRetryWithoutTags =
    !!error &&
    (msg.includes('p_tags') ||
      msg.includes('function search_services_unanchored') ||
      msg.includes('could not find the function'));

  // Backward compatibility for prod environments where sql/27_search_unanchored_tags.sql
  // (adds p_tags) has not been run yet — PostgREST rejects the WHOLE call on signature
  // mismatch (not just the tag filter), so without this retry Tier 3 would return 0 for
  // every query, not just tag-filtered ones. Same pattern as searchServices()'s
  // p_borough retry above.
  if (shouldRetryWithoutTags) {
    const legacy = await supabase.rpc('search_services_unanchored', baseArgs);
    data = legacy.data as unknown[] | null;
    error = legacy.error;
  }

  if (error || !data) return [];
  return (Array.isArray(data) ? data : []).map((row) =>
    mapRowToUnanchoredService(row as UnanchoredSearchRow)
  );
}

export type FallbackNotice = { tier: 2 | 3; message: string; city?: string } | null;

export type SearchWithFallbackResult = {
  results: RankedService[];
  unanchoredResults: UnanchoredService[];
  fallbackNotice: FallbackNotice;
};

// Orkestrerer Tier 1 → 2 → 3, stopper ved første treff. Rekoordineringen i Tier 2 er
// 100% intern her — lekker aldri til LocationContext eller lagret lokasjon.
type AnchoredSearch = (params: SearchParams) => Promise<RankedService[]>;

async function runSearchWithFallback(
  params: SearchParams,
  anchoredSearch: AnchoredSearch,
): Promise<SearchWithFallbackResult> {
  if (!params.query) {
    const results = await anchoredSearch(params);
    return { results, unanchoredResults: [], fallbackNotice: null };
  }

  // Tier 1 — uendret, lokasjonsforankret søk
  const tier1Results = await anchoredSearch(params);
  if (tier1Results.length > 0) {
    return { results: tier1Results, unanchoredResults: [], fallbackNotice: null };
  }

  // Tier 2 — flytt søkeområde til et stedsnavn funnet i søketeksten
  const settlement = await findSettlementInQuery(params.query);
  if (settlement) {
    const tier2Results = await anchoredSearch({
      ...params,
      lat: settlement.lat,
      lon: settlement.lon,
      city: settlement.name.toLowerCase(),
      // Tomt remainder (hele query var stedsnavnet) skal gi et rent lokasjons+tag-søk i
      // det nye stedet — IKKE et nytt tekstsøk på selve stedsnavnet (params.query), som
      // ofte feiler trigram-likhet mot search_text og maskerer reelle treff.
      query: settlement.remainder || undefined,
    });
    if (tier2Results.length > 0) {
      return {
        results: tier2Results,
        unanchoredResults: [],
        fallbackNotice: {
          tier: 2,
          message: `Fant ingen treff nær deg — viser resultater i ${settlement.name} i stedet`,
          city: settlement.name,
        },
      };
    }
  }

  // Tier 3 — frittstående navnetreff, ingen dekningsbegrensning
  const unanchoredResults = await searchServicesUnanchored({
    query: params.query,
    lat: params.lat,
    lon: params.lon,
    tags: params.tags,
    limit: params.limit,
  });
  if (unanchoredResults.length > 0) {
    return {
      results: [],
      unanchoredResults,
      fallbackNotice: { tier: 3, message: 'Disse resultatene ligger utenfor ditt område' },
    };
  }

  return { results: [], unanchoredResults: [], fallbackNotice: null };
}

export async function searchServicesWithFallback(
  params: SearchParams,
): Promise<SearchWithFallbackResult> {
  return runSearchWithFallback(params, searchServices);
}

async function searchContentFirst(params: SearchParams): Promise<RankedService[]> {
  if (canUseContentResultsSearch(params)) {
    try {
      const structuredResults = await searchContentServices(params);
      if (structuredResults.length > 0) return structuredResults;
    } catch {
      // SQL 45 is deployed separately. Keep existing search available during
      // rollout and in environments that have not installed the function.
    }
  }

  return searchServices(params);
}

export async function searchContentServicesWithFallback(
  params: SearchParams,
): Promise<SearchWithFallbackResult> {
  return runSearchWithFallback(params, searchContentFirst);
}
