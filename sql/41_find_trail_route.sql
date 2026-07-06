-- ============================================
-- BFS rute-søk: finn tursti-rute fra brukerposisjon til destinasjon
--
-- Forutsetning: sql/40_trails_start_end_columns.sql må være kjørt,
-- slik at trails.start_point og trails.end_point finnes med GIST-indekser.
--
-- Algoritme: rekursiv CTE (BFS over trail-segmenter).
-- Hvert steg: finn segmenter der start_point er innenfor 35m fra
-- forrige segments end_point. Stopp når vi er innenfor 300m av dest.
--
-- Begrensninger:
--   max_depth: maks antall segmenter i ruten (hindrer evig loop)
--   total_km < 40: maks rutelengde (trimmer urealistisk lange ruter)
--   statement_timeout = '5s': server-side fallback
--
-- Returnerer: ordnet array av trail-IDs eller NULL (fallback til luftlinje).
-- ============================================

DROP FUNCTION IF EXISTS find_trail_route(double precision, double precision, double precision, double precision, int);

CREATE OR REPLACE FUNCTION find_trail_route(
  p_user_lat  double precision,
  p_user_lon  double precision,
  p_dest_lat  double precision,
  p_dest_lon  double precision,
  p_max_depth int DEFAULT 120
) RETURNS TABLE (
  trail_ids text[],
  total_km  numeric
) AS $$
DECLARE
  user_point geography;
  dest_point geography;
BEGIN
  SET LOCAL statement_timeout = '5000ms';  -- 5s maks, returnerer NULL ved timeout

  user_point := ST_SetSRID(ST_MakePoint(p_user_lon, p_user_lat), 4326)::geography;
  dest_point := ST_SetSRID(ST_MakePoint(p_dest_lon, p_dest_lat), 4326)::geography;

  RETURN QUERY
  WITH RECURSIVE bfs AS (
    -- Seed: de 3 nærmeste trail-segmentene til brukerposisjon.
    -- ORDER BY + LIMIT i den ikke-rekursive termen krever en subquery-innpakning —
    -- PostgreSQL tillater ikke ORDER BY/LIMIT direkte i UNION ALL-leddets første del.
    SELECT seed.id, seed.end_point, seed.total_km, seed.path, seed.depth
    FROM (
      SELECT
        t.id,
        t.end_point,
        COALESCE(t.length_km, 0)::double precision AS total_km,
        ARRAY[t.id::text]                           AS path,
        0                                           AS depth
      FROM trails t
      WHERE ST_DWithin(t.start_point, user_point, 300)
        AND t.start_point IS NOT NULL
      ORDER BY t.start_point <-> user_point
      LIMIT 3
    ) AS seed

    UNION ALL

    -- Rekursivt steg: utvid ruten med neste segment
    SELECT
      t.id,
      t.end_point,
      (bfs.total_km + COALESCE(t.length_km, 0))::double precision,
      bfs.path || t.id::text,
      bfs.depth + 1
    FROM trails t
    JOIN bfs ON ST_DWithin(t.start_point, bfs.end_point, 35)
    WHERE NOT t.id::text = ANY(bfs.path)
      AND bfs.depth < p_max_depth
      AND bfs.total_km < 40
      AND t.start_point IS NOT NULL
  )
  SELECT
    bfs.path      AS trail_ids,
    bfs.total_km::numeric(10,2)
  FROM bfs
  WHERE ST_DWithin(bfs.end_point, dest_point, 400)
  ORDER BY bfs.total_km
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION find_trail_route(
  double precision, double precision, double precision, double precision, int
) TO anon, authenticated;
