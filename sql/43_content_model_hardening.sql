-- ============================================
-- Content model v1.1 hardening
-- Safe to run after sql/42_content_model.sql and after content migration.
-- ============================================

BEGIN;

-- Repair any pre-existing duplicate primary flags before enforcing the rule.
WITH ranked AS (
  SELECT
    offering_id,
    venue_id,
    row_number() OVER (
      PARTITION BY offering_id
      ORDER BY venue_id
    ) AS primary_rank
  FROM offering_venues
  WHERE is_primary = true
)
UPDATE offering_venues ov
SET is_primary = false
FROM ranked r
WHERE ov.offering_id = r.offering_id
  AND ov.venue_id = r.venue_id
  AND r.primary_rank > 1;

WITH ranked AS (
  SELECT
    offering_id,
    category_key,
    row_number() OVER (
      PARTITION BY offering_id
      ORDER BY category_key
    ) AS primary_rank
  FROM offering_categories
  WHERE is_primary = true
)
UPDATE offering_categories oc
SET is_primary = false
FROM ranked r
WHERE oc.offering_id = r.offering_id
  AND oc.category_key = r.category_key
  AND r.primary_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS offering_venues_one_primary_idx
  ON offering_venues (offering_id) WHERE is_primary = true;

CREATE UNIQUE INDEX IF NOT EXISTS offering_categories_one_primary_idx
  ON offering_categories (offering_id) WHERE is_primary = true;

-- Do not expose inactive providers or venues as empty-looking public rows.
CREATE OR REPLACE VIEW content_category_listings
WITH (security_invoker = true)
AS
SELECT
  oc.category_key,
  o.id AS offering_id,
  o.name AS offering_name,
  o.description,
  o.tags,
  o.goals,
  o.price_level,
  p.id AS provider_id,
  p.name AS provider_name,
  p.provider_kind,
  v.id AS venue_id,
  v.name AS venue_name,
  v.venue_kind,
  v.address,
  v.city,
  v.lat,
  v.lon,
  greatest(coalesce(p.quality_score, 0), coalesce(v.quality_score, 0)) AS quality_score
FROM offering_categories oc
JOIN offerings o ON o.id = oc.offering_id AND o.is_active = true
LEFT JOIN providers p ON p.id = o.provider_id AND p.is_active = true
LEFT JOIN offering_venues ov ON ov.offering_id = o.id
LEFT JOIN venues v ON v.id = ov.venue_id AND v.status = 'active'
WHERE (o.provider_id IS NULL OR p.id IS NOT NULL)
  AND (ov.venue_id IS NULL OR v.id IS NOT NULL);

COMMIT;
