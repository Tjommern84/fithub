-- ============================================
-- Content model v1: who (providers), where (venues), what (offerings)
-- Additive migration. Existing services/search remain available during rollout.
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS content_categories (
  key text PRIMARY KEY CHECK (key IN (
    'trene-selv', 'trene-sammen', 'oppfolging', 'helse',
    'aktivitet-sport', 'paraidrett', 'utendors'
  )),
  label text NOT NULL,
  description text,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO content_categories (key, label, description, sort_order)
VALUES
  ('trene-selv', 'Egentrening', 'Treningssenter og egentrening', 10),
  ('trene-sammen', 'Gruppetime', 'Gruppetimer og fellestrening', 20),
  ('oppfolging', 'Oppfølging & coaching', 'Personlig oppfølging og veiledning', 30),
  ('helse', 'Helse & behandling', 'Behandling, rehabilitering og helse', 40),
  ('aktivitet-sport', 'Sport', 'Idrettslag, anlegg og sportsaktiviteter', 50),
  ('paraidrett', 'Paraidrett', 'Tilrettelagt aktivitet og paraidrett', 60),
  ('utendors', 'Utendørs', 'Utetrening, tufteparker og friluftsaktivitet', 70)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- Keep the existing category table useful as a compatibility bridge for services.
INSERT INTO categories (id, name, description)
SELECT key, label, description FROM content_categories
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

CREATE TABLE IF NOT EXISTS providers (
  id text PRIMARY KEY,
  name text NOT NULL,
  legal_name text,
  orgnr text,
  provider_kind text NOT NULL CHECK (provider_kind IN (
    'company', 'chain', 'association', 'municipality', 'independent', 'other'
  )),
  website text,
  phone text,
  email text,
  owner_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  verification_status text NOT NULL DEFAULT 'imported' CHECK (verification_status IN (
    'imported', 'claimed', 'verified', 'rejected'
  )),
  quality_score integer NOT NULL DEFAULT 0 CHECK (quality_score BETWEEN 0 AND 100),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS providers_orgnr_unique
  ON providers (orgnr) WHERE orgnr IS NOT NULL;
CREATE INDEX IF NOT EXISTS providers_name_idx ON providers (lower(name));
CREATE INDEX IF NOT EXISTS providers_kind_idx ON providers (provider_kind);

CREATE TABLE IF NOT EXISTS venues (
  id text PRIMARY KEY,
  provider_id text REFERENCES providers(id) ON DELETE SET NULL,
  name text NOT NULL,
  venue_kind text NOT NULL CHECK (venue_kind IN (
    'gym', 'pool', 'climbing_gym', 'sports_hall', 'ice_rink', 'studio',
    'martial_arts_studio', 'racket_centre', 'outdoor_gym',
    'sports_facility', 'clinic', 'other'
  )),
  address text,
  city text,
  municipality_code text,
  postcode text,
  lat double precision,
  lon double precision,
  website text,
  phone text,
  email text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'inactive', 'quarantined', 'needs_review'
  )),
  quality_score integer NOT NULL DEFAULT 0 CHECK (quality_score BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((lat IS NULL AND lon IS NULL) OR (lat BETWEEN -90 AND 90 AND lon BETWEEN -180 AND 180))
);

CREATE INDEX IF NOT EXISTS venues_provider_idx ON venues (provider_id);
CREATE INDEX IF NOT EXISTS venues_city_idx ON venues (lower(city));
CREATE INDEX IF NOT EXISTS venues_kind_idx ON venues (venue_kind);
CREATE INDEX IF NOT EXISTS venues_lat_lon_idx ON venues (lat, lon);

CREATE TABLE IF NOT EXISTS offerings (
  id text PRIMARY KEY,
  provider_id text REFERENCES providers(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  delivery_mode text NOT NULL DEFAULT 'onsite' CHECK (delivery_mode IN (
    'onsite', 'online', 'mobile', 'hybrid'
  )),
  price_level text,
  tags text[] NOT NULL DEFAULT '{}',
  goals text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offerings_provider_idx ON offerings (provider_id);
CREATE INDEX IF NOT EXISTS offerings_tags_gin_idx ON offerings USING gin (tags);

CREATE TABLE IF NOT EXISTS offering_venues (
  offering_id text NOT NULL REFERENCES offerings(id) ON DELETE CASCADE,
  venue_id text NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  PRIMARY KEY (offering_id, venue_id)
);

CREATE INDEX IF NOT EXISTS offering_venues_venue_idx ON offering_venues (venue_id);
CREATE UNIQUE INDEX IF NOT EXISTS offering_venues_one_primary_idx
  ON offering_venues (offering_id) WHERE is_primary = true;

CREATE TABLE IF NOT EXISTS offering_categories (
  offering_id text NOT NULL REFERENCES offerings(id) ON DELETE CASCADE,
  category_key text NOT NULL REFERENCES content_categories(key) ON DELETE RESTRICT,
  is_primary boolean NOT NULL DEFAULT false,
  PRIMARY KEY (offering_id, category_key)
);

CREATE INDEX IF NOT EXISTS offering_categories_category_idx
  ON offering_categories (category_key, offering_id);
CREATE UNIQUE INDEX IF NOT EXISTS offering_categories_one_primary_idx
  ON offering_categories (offering_id) WHERE is_primary = true;

CREATE TABLE IF NOT EXISTS content_migration_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_hash text NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  counters jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS legacy_service_map (
  service_id text PRIMARY KEY REFERENCES services(id) ON DELETE CASCADE,
  provider_id text REFERENCES providers(id) ON DELETE SET NULL,
  venue_id text REFERENCES venues(id) ON DELETE SET NULL,
  offering_id text REFERENCES offerings(id) ON DELETE SET NULL,
  migration_run_id uuid REFERENCES content_migration_runs(id) ON DELETE SET NULL,
  confidence numeric(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  status text NOT NULL CHECK (status IN ('migrated', 'review', 'quarantined')),
  reasons text[] NOT NULL DEFAULT '{}',
  migrated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legacy_service_map_provider_idx ON legacy_service_map (provider_id);
CREATE INDEX IF NOT EXISTS legacy_service_map_venue_idx ON legacy_service_map (venue_id);
CREATE INDEX IF NOT EXISTS legacy_service_map_offering_idx ON legacy_service_map (offering_id);

CREATE TABLE IF NOT EXISTS content_sources (
  source text NOT NULL,
  external_id text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('provider', 'venue', 'offering')),
  provider_id text REFERENCES providers(id) ON DELETE CASCADE,
  venue_id text REFERENCES venues(id) ON DELETE CASCADE,
  offering_id text REFERENCES offerings(id) ON DELETE CASCADE,
  confidence numeric(4,3) NOT NULL DEFAULT 1 CHECK (confidence BETWEEN 0 AND 1),
  imported_at timestamptz NOT NULL DEFAULT now(),
  source_updated_at timestamptz,
  PRIMARY KEY (source, external_id, entity_type),
  CHECK (num_nonnulls(provider_id, venue_id, offering_id) = 1)
);

CREATE INDEX IF NOT EXISTS content_sources_provider_idx ON content_sources (provider_id);
CREATE INDEX IF NOT EXISTS content_sources_venue_idx ON content_sources (venue_id);
CREATE INDEX IF NOT EXISTS content_sources_offering_idx ON content_sources (offering_id);

CREATE TABLE IF NOT EXISTS content_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id text NOT NULL UNIQUE REFERENCES services(id) ON DELETE CASCADE,
  reasons text[] NOT NULL DEFAULT '{}',
  suggested_action jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- Read models used by category pages and later search cutover.
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

ALTER TABLE content_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE offering_venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE offering_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_migration_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_service_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_review_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_categories_public_read ON content_categories;
CREATE POLICY content_categories_public_read ON content_categories
  FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS providers_public_read ON providers;
CREATE POLICY providers_public_read ON providers
  FOR SELECT USING (is_active = true AND verification_status <> 'rejected');
DROP POLICY IF EXISTS venues_public_read ON venues;
CREATE POLICY venues_public_read ON venues
  FOR SELECT USING (status = 'active');
DROP POLICY IF EXISTS offerings_public_read ON offerings;
CREATE POLICY offerings_public_read ON offerings
  FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS offering_venues_public_read ON offering_venues;
CREATE POLICY offering_venues_public_read ON offering_venues FOR SELECT USING (true);
DROP POLICY IF EXISTS offering_categories_public_read ON offering_categories;
CREATE POLICY offering_categories_public_read ON offering_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS content_categories_service_role ON content_categories;
CREATE POLICY content_categories_service_role ON content_categories
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS providers_service_role ON providers;
CREATE POLICY providers_service_role ON providers
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS venues_service_role ON venues;
CREATE POLICY venues_service_role ON venues
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS offerings_service_role ON offerings;
CREATE POLICY offerings_service_role ON offerings
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS offering_venues_service_role ON offering_venues;
CREATE POLICY offering_venues_service_role ON offering_venues
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS offering_categories_service_role ON offering_categories;
CREATE POLICY offering_categories_service_role ON offering_categories
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS content_migration_runs_service_role ON content_migration_runs;
CREATE POLICY content_migration_runs_service_role ON content_migration_runs
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS legacy_service_map_service_role ON legacy_service_map;
CREATE POLICY legacy_service_map_service_role ON legacy_service_map
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS content_sources_service_role ON content_sources;
CREATE POLICY content_sources_service_role ON content_sources
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS content_review_queue_service_role ON content_review_queue;
CREATE POLICY content_review_queue_service_role ON content_review_queue
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMIT;
