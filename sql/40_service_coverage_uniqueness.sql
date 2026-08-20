-- Gjør periodiske importer idempotente for bydekning.
-- Behold eldste rad der historiske importer har laget duplikater.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY service_id, type, city
      ORDER BY created_at ASC, id ASC
    ) AS duplicate_number
  FROM service_coverage
  WHERE type = 'city' AND city IS NOT NULL
)
DELETE FROM service_coverage coverage
USING ranked
WHERE coverage.id = ranked.id
  AND ranked.duplicate_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS service_coverage_service_type_city_idx
  ON service_coverage (service_id, type, city);
