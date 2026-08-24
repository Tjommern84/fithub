-- ============================================
-- Structured category search
-- Reads the new provider/venue/offering model while returning the legacy
-- RankedService contract used by category pages during the gradual cutover.
-- ============================================

BEGIN;

-- Support the distance filter without scanning every venue for every city page.
CREATE INDEX IF NOT EXISTS venues_geography_idx
  ON venues USING gist (
    (ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography)
  )
  WHERE lat IS NOT NULL AND lon IS NOT NULL;

CREATE OR REPLACE FUNCTION search_content_category_services(
  p_main_category text,
  p_lat double precision,
  p_lon double precision,
  p_radius_km double precision DEFAULT 50,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
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
  WITH raw_candidates AS (
    SELECT
      lsm.service_id,
      c.venue_id AS structured_venue_id,
      coalesce(c.offering_name, s.name) AS name,
      s.type,
      coalesce(c.description, s.description, '') AS description,
      s.coverage,
      coalesce(c.price_level, s.price_level) AS price_level,
      s.rating_avg,
      s.rating_count,
      coalesce(c.tags, s.tags, '{}'::text[]) AS tags,
      coalesce(c.goals, s.goals, '{}'::text[]) AS goals,
      s.venues,
      s.is_active,
      (CASE
        WHEN p_lat IS NOT NULL AND p_lon IS NOT NULL AND c.lat IS NOT NULL AND c.lon IS NOT NULL
          THEN ST_Distance(
            ST_SetSRID(ST_MakePoint(c.lon, c.lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
          ) / 1000
        ELSE NULL
      END)::numeric AS distance_km,
      coalesce(c.quality_score, 0)::numeric AS score,
      ARRAY['Strukturert kategori']::text[] AS reasons,
      'Strukturert innholdsmodell'::text AS match_reason,
      c.address,
      s.phone,
      s.email,
      s.website,
      s.orgnr,
      c.lat,
      c.lon,
      s.cover_image_url,
      s.logo_image_url,
      s.provider_type
    FROM content_category_listings c
    JOIN legacy_service_map lsm ON lsm.offering_id = c.offering_id
    JOIN services s ON s.id = lsm.service_id AND s.is_active = true
    WHERE c.category_key = p_main_category
      AND (
        p_lat IS NULL OR p_lon IS NULL
        OR (
          c.lat IS NOT NULL
          AND c.lon IS NOT NULL
          AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(c.lon, c.lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
            LEAST(GREATEST(coalesce(p_radius_km, 50), 1), 200) * 1000
          )
        )
      )
  ),
  candidates AS (
    -- One offering can be connected to several venues. Keep the closest
    -- venue so a service is never rendered as duplicate cards on a city page.
    SELECT DISTINCT ON (raw_candidates.service_id)
      raw_candidates.*
    FROM raw_candidates
    ORDER BY
      raw_candidates.service_id,
      raw_candidates.distance_km ASC NULLS LAST,
      raw_candidates.score DESC,
      raw_candidates.structured_venue_id ASC NULLS LAST
  )
  SELECT
    candidates.service_id,
    candidates.name,
    candidates.type,
    candidates.description,
    candidates.coverage,
    candidates.price_level,
    candidates.rating_avg,
    candidates.rating_count,
    candidates.tags,
    candidates.goals,
    candidates.venues,
    candidates.is_active,
    candidates.distance_km,
    candidates.score,
    candidates.reasons,
    candidates.match_reason,
    candidates.address,
    candidates.phone,
    candidates.email,
    candidates.website,
    candidates.orgnr,
    candidates.lat,
    candidates.lon,
    candidates.cover_image_url,
    candidates.logo_image_url,
    candidates.provider_type
  FROM candidates
  ORDER BY
    candidates.distance_km ASC NULLS LAST,
    candidates.score DESC,
    candidates.name ASC
  LIMIT LEAST(GREATEST(coalesce(p_limit, 20), 1), 100)
  OFFSET GREATEST(coalesce(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION search_content_category_services(
  text, double precision, double precision, double precision, integer, integer
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION search_content_category_services(
  text, double precision, double precision, double precision, integer, integer
) TO anon, authenticated, service_role;

COMMIT;
