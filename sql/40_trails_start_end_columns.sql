-- ============================================
-- Materialiserte start/end-punkter på trails — forutsetning for BFS rute-søk
--
-- sql/35_nearest_trails_endpoints.sql la til en funksjonell GIST-indeks på
-- ST_Collect(StartPoint, EndPoint), men ingen separate kolonner. BFS i
-- find_trail_route() (sql/41) trenger individuelle ST_DWithin-oppslag mot
-- start- og end-punkter separat — den samlede indeksen dekker ikke dette.
--
-- Bruker trigger-mønsteret fra sql/37 (services_sync_lat_lon) for å holde
-- kolonnene oppdatert automatisk ved INSERT/UPDATE.
-- ============================================

ALTER TABLE trails
  ADD COLUMN IF NOT EXISTS start_point geography(Point, 4326),
  ADD COLUMN IF NOT EXISTS end_point   geography(Point, 4326);

-- Trigger: beregn start_point/end_point fra geom ved INSERT/UPDATE
CREATE OR REPLACE FUNCTION trails_sync_endpoints()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.geom IS NOT NULL THEN
    NEW.start_point := ST_SetSRID(ST_StartPoint(NEW.geom::geometry), 4326)::geography;
    NEW.end_point   := ST_SetSRID(ST_EndPoint(NEW.geom::geometry),   4326)::geography;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trails_sync_endpoints ON trails;

CREATE TRIGGER trg_trails_sync_endpoints
BEFORE INSERT OR UPDATE OF geom ON trails
FOR EACH ROW EXECUTE FUNCTION trails_sync_endpoints();

-- Backfill eksisterende rader (~163k) — dette kan ta 30–60 sekunder.
-- Supabase SQL Editor har typisk 60s timeout — kjør gjerne med EXPLAIN først.
UPDATE trails SET geom = geom WHERE geom IS NOT NULL;

CREATE INDEX IF NOT EXISTS trails_start_point_idx ON trails USING GIST(start_point);
CREATE INDEX IF NOT EXISTS trails_end_point_idx   ON trails USING GIST(end_point);
