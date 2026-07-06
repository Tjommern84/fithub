-- lat/lon som vanlige nullable kolonner, holdt i sync via BEFORE-trigger.
-- GENERATED ALWAYS AS (ST_Y(base_location::geometry)) STORED ble avvist av
-- Postgres — geography::geometry-casten er ikke garantert IMMUTABLE i alle
-- PostGIS-versjoner, og Postgres tillater ikke STABLE/VOLATILE uttrykk i
-- genererte kolonner. Trigger-mønsteret er identisk med services_set_search_text
-- (sql/20_function_search_path.sql) og er veletablert i dette prosjektet.

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lon double precision;

-- Engangsfylling av eksisterende rader
UPDATE services
  SET lat = ST_Y(base_location::geometry),
      lon = ST_X(base_location::geometry)
  WHERE base_location IS NOT NULL;

CREATE OR REPLACE FUNCTION public.services_sync_lat_lon()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.base_location IS NOT NULL THEN
    NEW.lat := ST_Y(NEW.base_location::geometry);
    NEW.lon := ST_X(NEW.base_location::geometry);
  ELSE
    NEW.lat := NULL;
    NEW.lon := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_services_sync_lat_lon ON services;

CREATE TRIGGER trg_services_sync_lat_lon
BEFORE INSERT OR UPDATE OF base_location ON services
FOR EACH ROW EXECUTE FUNCTION services_sync_lat_lon();

NOTIFY pgrst, 'reload schema';
