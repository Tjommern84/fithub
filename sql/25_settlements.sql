-- ============================================
-- Tettsteder fra Wikipedia/SSB ("Tettsteder i [fylke]"-sidene)
-- Punktdata for kartlag på /tur — navn, kommune, folketall.
-- Egen tabell, ikke del av services/search_services() (samme mønster som trails).
-- ============================================

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'wikipedia',
  source_local_id text,
  name text,
  county text,
  municipality text,
  population int,
  geom geography(Point, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS settlements_geom_idx ON settlements USING GIST (geom);

-- Ikke-partiell: PostgREST sin upsert(onConflict:'source,source_local_id') genererer
-- "ON CONFLICT (source, source_local_id)" uten WHERE-betingelse, som ikke matcher en
-- partiell unik indeks (samme gotcha som trails — se sql/22_trails.sql).
DROP INDEX IF EXISTS settlements_source_local_id_idx;
CREATE UNIQUE INDEX IF NOT EXISTS settlements_source_local_id_idx ON settlements (source, source_local_id);

ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS settlements_public_read ON settlements;
CREATE POLICY settlements_public_read ON settlements FOR SELECT USING (true);
-- Ingen insert/update/delete-policy: kun service-role (import-script) kan skrive.

-- Henter tettsteder som ligger innenfor et bbox (kartets synlige område), brukt av /api/settlements.
CREATE OR REPLACE FUNCTION get_settlements_in_bbox(
  p_min_lon double precision,
  p_min_lat double precision,
  p_max_lon double precision,
  p_max_lat double precision,
  p_limit   int DEFAULT 2000
) RETURNS TABLE (
  id text,
  name text,
  municipality text,
  population int,
  geojson text
) AS $$
  SELECT
    s.id::text,
    s.name,
    s.municipality,
    s.population,
    ST_AsGeoJSON(s.geom::geometry) AS geojson
  FROM settlements s
  WHERE ST_Intersects(
    s.geom,
    ST_MakeEnvelope(p_min_lon, p_min_lat, p_max_lon, p_max_lat, 4326)::geography
  )
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 2000), 1), 5000);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_settlements_in_bbox(
  double precision, double precision, double precision, double precision, int
) TO anon, authenticated;
