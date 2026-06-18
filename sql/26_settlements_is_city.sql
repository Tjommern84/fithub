-- ============================================
-- Legg til by-status på settlements
-- "By" er en egenskap på et eksisterende tettsted, ikke en egen geometritype —
-- se handoff.md "Norske byer på kartet" for full kontekst og kildevalg
-- (Liste over norske byer, 108 byer, Wikipedia).
-- ============================================

ALTER TABLE settlements ADD COLUMN IF NOT EXISTS is_city boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS settlements_is_city_idx ON settlements (is_city) WHERE is_city = true;

-- Samme gotcha som search_services(): DROP gammel signatur FØR CREATE OR REPLACE,
-- ellers oppstår duplikat-overload siden RETURNS TABLE-kolonner endres.
DROP FUNCTION IF EXISTS get_settlements_in_bbox(double precision, double precision, double precision, double precision, int);

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
  is_city boolean,
  geojson text
) AS $$
  SELECT
    s.id::text,
    s.name,
    s.municipality,
    s.population,
    s.is_city,
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
