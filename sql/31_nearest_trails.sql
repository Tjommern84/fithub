-- ============================================
-- get_nearest_trails() — RPC for "Aktiviteter nær deg" på forsiden
--
-- Henter navngitte turruter innen en radius rundt et punkt, sortert på avstand.
-- Eget RPC fra get_trails_in_bbox() (sql/22_trails.sql) — den er viewport/bbox-basert
-- for kartsiden /tur, denne er punkt+radius-basert for "nær deg"-bruk uten kart.
-- Samme ST_DWithin+ST_Distance-mønster som radius-matching i search_services()
-- (sql/29_search_services_provider_type.sql, matched_coverage-CTE).
--
-- WHERE name IS NOT NULL: kun navngitte ruter. Bevisst kvalitetsfilter — under 30 %
-- av rader har navn, resten er anonyme geometri-fragmenter som ikke skal vises som
-- "anbefalt aktivitet" i en kortliste.
-- ============================================

CREATE OR REPLACE FUNCTION get_nearest_trails(
  p_lat        double precision,
  p_lon        double precision,
  p_radius_km  double precision,
  p_limit      int DEFAULT 20
) RETURNS TABLE (
  id text,
  name text,
  trail_type text,
  length_km numeric,
  distance_km double precision
) AS $$
  SELECT
    t.id::text,
    t.name,
    t.trail_type,
    t.length_km,
    ST_Distance(
      t.geom,
      ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)
    ) / 1000 AS distance_km
  FROM trails t
  WHERE t.name IS NOT NULL
    AND ST_DWithin(
      t.geom,
      ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326),
      p_radius_km * 1000
    )
  ORDER BY distance_km
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_nearest_trails(
  double precision, double precision, double precision, int
) TO anon, authenticated;
