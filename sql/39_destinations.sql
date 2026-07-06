-- ============================================
-- Destinasjoner / Turmål — fjelltoppar, tjern, hytter, utsiktspunkt
-- Importeres fra OpenStreetMap via Overpass API (scripts/parse-osm-destinations.ts)
-- Punktdata, analogt med settlements — frittstående fra services/søk.
-- ============================================

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'osm',
  source_id text,               -- OSM node/way/relation ID ("N123456789")
  name text NOT NULL,
  destination_type text NOT NULL, -- 'peak'|'lake'|'viewpoint'|'shelter'|'hut'
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  elevation_m int,              -- fra OSM-tag "ele" eller Kartverket høyde-API
  geom geography(Point, 4326) NOT NULL,
  osm_tags jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS destinations_geom_idx ON destinations USING GIST(geom);

-- Ikke-partiell unik indeks — PostgREST sin upsert(onConflict:'source,source_id')
-- genererer "ON CONFLICT (source, source_id)" uten WHERE, matcher ikke partiell indeks.
DROP INDEX IF EXISTS destinations_source_id_idx;
CREATE UNIQUE INDEX IF NOT EXISTS destinations_source_id_idx
  ON destinations(source, source_id)
  WHERE source_id IS NOT NULL;

ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS destinations_public_read ON destinations;
CREATE POLICY destinations_public_read ON destinations FOR SELECT USING (true);
-- Ingen insert/update/delete-policy: kun service-role (import-script) kan skrive.

-- ── RPC 1: bbox-oppslag for kartvisning ────────────────────────────────────
DROP FUNCTION IF EXISTS get_destinations_in_bbox(double precision, double precision, double precision, double precision, text[], int);

CREATE OR REPLACE FUNCTION get_destinations_in_bbox(
  p_min_lon double precision,
  p_min_lat double precision,
  p_max_lon double precision,
  p_max_lat double precision,
  p_types   text[] DEFAULT NULL,
  p_limit   int    DEFAULT 500
) RETURNS TABLE (
  id              text,
  name            text,
  destination_type text,
  elevation_m     int,
  lat             double precision,
  lon             double precision,
  geojson         text
) AS $$
  SELECT
    d.id::text,
    d.name,
    d.destination_type,
    d.elevation_m,
    d.lat,
    d.lon,
    ST_AsGeoJSON(d.geom::geometry) AS geojson
  FROM destinations d
  WHERE ST_Intersects(
      d.geom,
      ST_MakeEnvelope(p_min_lon, p_min_lat, p_max_lon, p_max_lat, 4326)::geography
    )
    AND (p_types IS NULL OR d.destination_type = ANY(p_types))
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 500), 1), 2000);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_destinations_in_bbox(
  double precision, double precision, double precision, double precision, text[], int
) TO anon, authenticated;

-- ── RPC 2: nærmeste destinasjoner (for "Turmål nær deg") ────────────────────
DROP FUNCTION IF EXISTS get_nearest_destinations(double precision, double precision, double precision, text[], int);

CREATE OR REPLACE FUNCTION get_nearest_destinations(
  p_lat       double precision,
  p_lon       double precision,
  p_radius_km double precision DEFAULT 30,
  p_types     text[]           DEFAULT NULL,
  p_limit     int              DEFAULT 20
) RETURNS TABLE (
  id              text,
  name            text,
  destination_type text,
  elevation_m     int,
  lat             double precision,
  lon             double precision,
  distance_km     numeric
) AS $$
  SELECT
    d.id::text,
    d.name,
    d.destination_type,
    d.elevation_m,
    d.lat,
    d.lon,
    (ST_Distance(d.geom,
      ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
    ) / 1000)::numeric(10,2) AS distance_km
  FROM destinations d
  WHERE ST_DWithin(
      d.geom,
      ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
      p_radius_km * 1000
    )
    AND (p_types IS NULL OR d.destination_type = ANY(p_types))
  ORDER BY
    d.geom <-> ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 200);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_nearest_destinations(
  double precision, double precision, double precision, text[], int
) TO anon, authenticated;
