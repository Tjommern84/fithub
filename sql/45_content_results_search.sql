-- ============================================
-- Structured results search
-- Uses providers, venues, offerings and offering_categories as the read model,
-- while preserving the RankedService response consumed by /resultater.
-- ============================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Text search is performed on the structured entity names. These indexes also
-- support future provider and venue search without rebuilding a combined blob.
CREATE INDEX IF NOT EXISTS offerings_name_trgm_idx
  ON offerings USING gin (lower(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS providers_name_trgm_idx
  ON providers USING gin (lower(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS venues_name_trgm_idx
  ON venues USING gin (lower(name) gin_trgm_ops);

CREATE OR REPLACE FUNCTION search_content_services(
  p_main_category text,
  p_lat double precision,
  p_lon double precision,
  p_radius_km double precision,
  p_service_type text,
  p_venue text,
  p_query text,
  p_tags text[],
  p_sort text,
  p_limit integer,
  p_offset integer
) RETURNS TABLE (
  service_id text,
  name text,
  type text,
  description text,
  coverage jsonb,
  price_level text,
  rating_avg numeric,
  rating_count integer,
  tags text[],
  goals text[],
  venues text[],
  is_active boolean,
  distance_km numeric,
  score numeric,
  reasons text[],
  match_reason text,
  address text,
  phone text,
  email text,
  website text,
  orgnr text,
  lat double precision,
  lon double precision,
  cover_image_url text,
  logo_image_url text,
  provider_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH inputs AS (
    SELECT
      nullif(lower(trim(p_query)), '') AS normalized_query,
      coalesce(nullif(p_service_type, ''), 'any') AS type_filter,
      coalesce(nullif(p_venue, ''), 'either') AS venue_filter,
      coalesce(nullif(p_sort, ''),
        CASE WHEN p_lat IS NOT NULL AND p_lon IS NOT NULL
          THEN 'nearest'
          ELSE 'best_match'
        END
      ) AS sort_mode,
      LEAST(GREATEST(coalesce(p_radius_km, 25), 1), 200) AS radius_km
  ),
  raw_candidates AS (
    SELECT
      lsm.service_id,
      oc.category_key,
      o.id AS offering_id,
      v.id AS structured_venue_id,
      o.delivery_mode,
      coalesce(o.name, s.name) AS name,
      s.type,
      coalesce(o.description, s.description, '') AS description,
      s.coverage,
      coalesce(o.price_level, s.price_level) AS price_level,
      s.rating_avg,
      s.rating_count,
      coalesce(o.tags, s.tags, '{}'::text[]) AS tags,
      coalesce(o.goals, s.goals, '{}'::text[]) AS goals,
      s.venues,
      s.is_active,
      CASE
        WHEN o.delivery_mode = 'online' THEN NULL
        WHEN p_lat IS NOT NULL AND p_lon IS NOT NULL AND v.lat IS NOT NULL AND v.lon IS NOT NULL
          THEN (
            ST_Distance(
              ST_SetSRID(ST_MakePoint(v.lon, v.lat), 4326)::geography,
              ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
            ) / 1000
          )::numeric
        ELSE NULL
      END AS distance_km,
      greatest(coalesce(p.quality_score, 0), coalesce(v.quality_score, 0)) AS quality_score,
      concat_ws(' ',
        o.name,
        p.name,
        v.name,
        o.description,
        array_to_string(o.tags, ' '),
        v.address,
        v.city
      ) AS search_text,
      CASE WHEN o.delivery_mode = 'online' THEN NULL ELSE v.address END AS address,
      coalesce(v.phone, p.phone, s.phone) AS phone,
      coalesce(v.email, p.email, s.email) AS email,
      coalesce(v.website, p.website, s.website) AS website,
      coalesce(p.orgnr, s.orgnr) AS orgnr,
      CASE WHEN o.delivery_mode = 'online' THEN NULL ELSE v.lat END AS lat,
      CASE WHEN o.delivery_mode = 'online' THEN NULL ELSE v.lon END AS lon,
      s.cover_image_url,
      s.logo_image_url,
      s.provider_type
    FROM offering_categories oc
    JOIN offerings o ON o.id = oc.offering_id AND o.is_active = true
    LEFT JOIN providers p ON p.id = o.provider_id AND p.is_active = true
    LEFT JOIN offering_venues ov ON ov.offering_id = o.id
    LEFT JOIN venues v ON v.id = ov.venue_id AND v.status = 'active'
    JOIN legacy_service_map lsm ON lsm.offering_id = o.id
    JOIN services s
      ON s.id = lsm.service_id
      AND s.is_active = true
      AND s.reported_at IS NULL
    CROSS JOIN inputs i
    WHERE (o.provider_id IS NULL OR p.id IS NOT NULL)
      AND (ov.venue_id IS NULL OR v.id IS NOT NULL)
      AND (p_main_category IS NULL OR oc.category_key = p_main_category)
      AND (p_tags IS NULL OR o.tags && p_tags)
      AND (
        i.type_filter = 'any'
        OR s.type = i.type_filter
        OR EXISTS (
          SELECT 1
          FROM service_types st
          WHERE st.service_id = s.id
            AND st.type = i.type_filter
        )
      )
      AND (
        i.venue_filter = 'either'
        OR (
          i.venue_filter = 'home'
          AND (
            o.delivery_mode IN ('mobile', 'online', 'hybrid')
            OR 'home' = ANY(s.venues)
          )
        )
        OR (
          i.venue_filter = 'gym'
          AND (
            v.id IS NOT NULL
            OR o.delivery_mode IN ('onsite', 'hybrid')
            OR 'gym' = ANY(s.venues)
          )
        )
      )
      AND (
        p_lat IS NULL
        OR p_lon IS NULL
        OR o.delivery_mode = 'online'
        OR (
          v.lat IS NOT NULL
          AND v.lon IS NOT NULL
          AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(v.lon, v.lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
            i.radius_km * 1000
          )
        )
      )
  ),
  text_matched AS (
    SELECT
      raw_candidates.*,
      CASE
        WHEN inputs.normalized_query IS NULL THEN 0
        ELSE greatest(
          similarity(lower(raw_candidates.search_text), inputs.normalized_query),
          CASE
            WHEN lower(raw_candidates.search_text) LIKE '%' || inputs.normalized_query || '%'
              THEN 1
            ELSE 0
          END
        )
      END AS query_similarity
    FROM raw_candidates
    CROSS JOIN inputs
    WHERE inputs.normalized_query IS NULL
      OR lower(raw_candidates.search_text) % inputs.normalized_query
      OR lower(raw_candidates.search_text) LIKE '%' || inputs.normalized_query || '%'
  ),
  candidates AS (
    -- Category membership and multi-venue offerings can both create duplicate
    -- rows. Retain the nearest and highest-quality representation per service.
    SELECT DISTINCT ON (text_matched.service_id)
      text_matched.*
    FROM text_matched
    ORDER BY
      text_matched.service_id,
      text_matched.distance_km ASC NULLS LAST,
      text_matched.quality_score DESC,
      text_matched.category_key ASC,
      text_matched.structured_venue_id ASC NULLS LAST
  ),
  score_parts AS (
    SELECT
      candidates.*,
      CASE
        WHEN candidates.rating_avg >= 4.7 THEN 3
        WHEN candidates.rating_avg >= 4.4 THEN 2
        WHEN candidates.rating_avg >= 4.1 THEN 1
        ELSE 0
      END AS rating_score,
      CASE
        WHEN candidates.distance_km IS NULL THEN 0
        WHEN candidates.distance_km <= 5 THEN 3
        WHEN candidates.distance_km <= 15 THEN 2
        WHEN candidates.distance_km <= 30 THEN 1
        ELSE 0
      END AS distance_score
    FROM candidates
  ),
  scored AS (
    SELECT
      score_parts.*,
      (
        score_parts.rating_score
        + score_parts.distance_score
        + score_parts.query_similarity::numeric * 4
        + score_parts.quality_score::numeric / 25
      )::numeric(12,4) AS structured_score
    FROM score_parts
  ),
  limited AS (
    SELECT scored.*
    FROM scored
    CROSS JOIN inputs
    ORDER BY
      CASE WHEN inputs.sort_mode = 'nearest' THEN scored.distance_km END ASC NULLS LAST,
      CASE WHEN inputs.sort_mode = 'rating' THEN scored.rating_avg END DESC NULLS LAST,
      CASE WHEN inputs.sort_mode = 'price_low' THEN
        CASE scored.price_level WHEN 'low' THEN 1 WHEN 'medium' THEN 2 WHEN 'high' THEN 3 ELSE 4 END
      END ASC NULLS LAST,
      CASE WHEN inputs.sort_mode = 'price_high' THEN
        CASE scored.price_level WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END
      END ASC NULLS LAST,
      CASE WHEN inputs.sort_mode NOT IN ('nearest', 'rating', 'price_low', 'price_high')
        THEN scored.structured_score
      END DESC NULLS LAST,
      scored.rating_avg DESC,
      scored.quality_score DESC,
      scored.name ASC
    LIMIT LEAST(GREATEST(coalesce(p_limit, 50), 1), 100)
    OFFSET GREATEST(coalesce(p_offset, 0), 0)
  )
  SELECT
    limited.service_id,
    limited.name,
    limited.type,
    limited.description,
    limited.coverage,
    limited.price_level,
    limited.rating_avg,
    limited.rating_count,
    limited.tags,
    limited.goals,
    limited.venues,
    limited.is_active,
    limited.distance_km,
    limited.structured_score AS score,
    array_remove(ARRAY[
      CASE WHEN limited.query_similarity > 0 THEN 'Treff i tilbud' END,
      CASE WHEN p_main_category IS NOT NULL THEN 'Riktig kategori' END,
      CASE WHEN limited.distance_score > 0 THEN 'Nær deg' END,
      CASE WHEN limited.rating_score > 0 THEN 'God rating' END,
      CASE WHEN limited.quality_score >= 75 THEN 'God datakvalitet' END
    ]::text[], NULL) AS reasons,
    CASE
      WHEN limited.delivery_mode = 'online' THEN 'Tilgjengelig på nett'
      WHEN limited.distance_km IS NOT NULL
        THEN round(limited.distance_km, 1)::text || ' km unna'
      ELSE 'Strukturert innholdsmodell'
    END AS match_reason,
    limited.address,
    limited.phone,
    limited.email,
    limited.website,
    limited.orgnr,
    limited.lat,
    limited.lon,
    limited.cover_image_url,
    limited.logo_image_url,
    limited.provider_type
  FROM limited;
$$;

REVOKE ALL ON FUNCTION search_content_services(
  text, double precision, double precision, double precision,
  text, text, text, text[], text, integer, integer
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION search_content_services(
  text, double precision, double precision, double precision,
  text, text, text, text[], text, integer, integer
) TO anon, authenticated, service_role;

COMMIT;
