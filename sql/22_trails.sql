-- ============================================
-- Turruter fra Geonorge (Turrutebasen)
-- Landsdekkende fotruter, skiløyper, sykkelruter og andre ruter.
-- Egen tabell, ikke del av services/search_services() — annen datatype
-- (linjegeometri uten pris/tilbyder/dekningsregler).
-- ============================================

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS trails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'geonorge',
  source_local_id text,
  name text,
  trail_type text NOT NULL CHECK (trail_type IN ('fotrute', 'skiloype', 'sykkelrute', 'annet')),
  municipality text,
  maintainer text,
  marked boolean,
  difficulty text,
  length_km numeric,
  geom geography(LineString, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trails_geom_idx ON trails USING GIST (geom);

-- Ikke-partiell: PostgREST sin upsert(onConflict:'source,source_local_id') genererer
-- "ON CONFLICT (source, source_local_id)" uten WHERE-betingelse, som ikke matcher en
-- partiell unik indeks. NULL <> NULL i en vanlig UNIQUE-indeks, så rader uten
-- source_local_id krasjer uansett ikke i hverandre.
DROP INDEX IF EXISTS trails_source_local_id_idx;
CREATE UNIQUE INDEX IF NOT EXISTS trails_source_local_id_idx ON trails (source, source_local_id);

ALTER TABLE trails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trails_public_read ON trails;
CREATE POLICY trails_public_read ON trails FOR SELECT USING (true);
-- Ingen insert/update/delete-policy: kun service-role (import-script) kan skrive.

-- Henter ruter som skjærer et bbox (kartets synlige område), brukt av /api/trails.
CREATE OR REPLACE FUNCTION get_trails_in_bbox(
  p_min_lon double precision,
  p_min_lat double precision,
  p_max_lon double precision,
  p_max_lat double precision,
  p_limit   int DEFAULT 2000
) RETURNS TABLE (
  id text,
  name text,
  trail_type text,
  maintainer text,
  marked boolean,
  difficulty text,
  length_km numeric,
  geojson text
) AS $$
  SELECT
    t.id::text,
    t.name,
    t.trail_type,
    t.maintainer,
    t.marked,
    t.difficulty,
    t.length_km,
    ST_AsGeoJSON(t.geom::geometry) AS geojson
  FROM trails t
  WHERE ST_Intersects(
    t.geom,
    ST_MakeEnvelope(p_min_lon, p_min_lat, p_max_lon, p_max_lat, 4326)::geography
  )
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 2000), 1), 5000);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_trails_in_bbox(
  double precision, double precision, double precision, double precision, int
) TO anon, authenticated;
