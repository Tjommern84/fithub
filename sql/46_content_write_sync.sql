-- ============================================
-- Automatic services -> content model synchronization
-- Keeps providers, venues, offerings and categories current for every write
-- path (dashboard, admin, imports and maintenance scripts).
-- ============================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Rows owned by automatic synchronization can be replaced safely. Existing
-- migration links are marked only when each column is introduced. On reruns,
-- manually curated rows keep the default false value and remain untouched.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'offering_categories'
      AND column_name = 'sync_managed'
  ) THEN
    ALTER TABLE offering_categories
      ADD COLUMN sync_managed boolean NOT NULL DEFAULT false;

    UPDATE offering_categories oc
    SET sync_managed = true
    WHERE EXISTS (
      SELECT 1
      FROM legacy_service_map lsm
      WHERE lsm.offering_id = oc.offering_id
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'offering_venues'
      AND column_name = 'sync_managed'
  ) THEN
    ALTER TABLE offering_venues
      ADD COLUMN sync_managed boolean NOT NULL DEFAULT false;

    UPDATE offering_venues ov
    SET sync_managed = true
    WHERE EXISTS (
      SELECT 1
      FROM legacy_service_map lsm
      WHERE lsm.offering_id = ov.offering_id
    );
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS content_sync_state (
  service_id text PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('synced', 'review', 'failed', 'deleted')),
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  last_synced_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_sync_state_status_idx
  ON content_sync_state (status);

ALTER TABLE content_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_sync_state_service_role ON content_sync_state;
CREATE POLICY content_sync_state_service_role ON content_sync_state
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

GRANT SELECT ON content_sync_state TO service_role;

INSERT INTO content_sync_state (
  service_id,
  status,
  attempt_count,
  last_error,
  last_synced_at,
  updated_at
)
SELECT
  s.id,
  CASE WHEN lsm.offering_id IS NOT NULL THEN 'synced' ELSE 'review' END,
  0,
  NULL,
  now(),
  now()
FROM services s
LEFT JOIN legacy_service_map lsm ON lsm.service_id = s.id
ON CONFLICT (service_id) DO NOTHING;

CREATE OR REPLACE FUNCTION content_stable_id(p_prefix text, p_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public, extensions, pg_catalog
AS $$
  SELECT p_prefix || '_' || substr(
    encode(digest(p_prefix || ':' || p_key, 'sha256'), 'hex'),
    1,
    24
  );
$$;

CREATE OR REPLACE FUNCTION content_source_for_service(
  p_service_id text,
  p_orgnr text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT CASE
    WHEN lower(coalesce(p_service_id, '')) ~ '^[0-9a-f]{8}-[0-9a-f-]{27}$'
      AND p_orgnr IS NOT NULL THEN 'brreg'
    WHEN left(lower(coalesce(p_service_id, '')), 4) = 'osm_' THEN 'osm'
    WHEN left(lower(coalesce(p_service_id, '')), 4) = 'anl_' THEN 'anleggsregisteret'
    WHEN left(lower(coalesce(p_service_id, '')), 3) = 'tp_' THEN 'tufteparker'
    WHEN left(lower(coalesce(p_service_id, '')), 3) = 'gp_' THEN 'google_places'
    WHEN left(lower(coalesce(p_service_id, '')), 3) = 'gf_' THEN 'group_fitness'
    WHEN left(lower(coalesce(p_service_id, '')), 3) = 'sc_' THEN 'sport_club'
    WHEN left(lower(coalesce(p_service_id, '')), 3) = 'pt_'
      OR left(lower(coalesce(p_service_id, '')), 6) = 'bg_pt_' THEN 'pt_search'
    WHEN left(lower(coalesce(p_service_id, '')), 4) = 'ern_'
      OR left(lower(coalesce(p_service_id, '')), 7) = 'bg_ern_' THEN 'nutrition_search'
    WHEN left(lower(coalesce(p_service_id, '')), 5) = 'para_' THEN 'paraidrett'
    WHEN left(lower(coalesce(p_service_id, '')), 6) = 'bg_sc_' THEN 'sport_club'
    WHEN lower(p_service_id) ~ '^(feel24|sporty|mova|evo|impulse|sats|3t)_' THEN 'chain_import'
    WHEN p_orgnr IS NOT NULL THEN 'brreg'
    ELSE 'legacy'
  END;
$$;

CREATE OR REPLACE FUNCTION sync_service_content(p_service_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_service services%ROWTYPE;
  v_existing_map legacy_service_map%ROWTYPE;
  v_source text;
  v_orgnr text;
  v_brand text;
  v_signals text;
  v_categories text[];
  v_primary_category text;
  v_category text;
  v_provider_id text;
  v_venue_id text;
  v_offering_id text;
  v_provider_identity text;
  v_provider_name text;
  v_provider_kind text;
  v_venue_kind text;
  v_delivery_mode text;
  v_quality_score integer := 0;
  v_has_physical boolean;
  v_needs_provider boolean;
  v_provider_shared boolean := false;
  v_manual_category_primary boolean := false;
  v_manual_venue_primary boolean := false;
  v_is_public boolean;
  v_reasons text[] := '{}'::text[];
BEGIN
  SELECT * INTO v_service
  FROM services
  WHERE id = p_service_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT * INTO v_existing_map
  FROM legacy_service_map
  WHERE service_id = v_service.id;

  v_orgnr := nullif(regexp_replace(coalesce(v_service.orgnr, ''), '[^0-9]', '', 'g'), '');
  IF v_orgnr IS NOT NULL AND length(v_orgnr) <> 9 THEN
    v_orgnr := NULL;
  END IF;

  IF v_orgnr IS NULL THEN
    SELECT substring(lower(tag) FROM '^orgnr:([0-9]{9})$')
    INTO v_orgnr
    FROM unnest(coalesce(v_service.tags, '{}'::text[])) AS service_tag(tag)
    WHERE tag ~* '^orgnr:[0-9]{9}$'
    LIMIT 1;
  END IF;

  v_source := content_source_for_service(v_service.id, v_orgnr);
  v_signals := lower(concat_ws(
    ' ',
    v_service.name,
    v_service.type,
    array_to_string(v_service.tags, ' '),
    coalesce((
      SELECT string_agg(st.type, ' ')
      FROM service_types st
      WHERE st.service_id = v_service.id
    ), '')
  ));

  SELECT brand INTO v_brand
  FROM unnest(ARRAY[
    'fresh fitness', 'family sports club', 'fitnesspoint', 'aktiv365',
    'sky fitness', 'feel24', 'sporty', 'mova', 'evo', 'sats',
    'impulse', 'spenst', '3t'
  ]::text[]) WITH ORDINALITY AS brands(brand, sort_order)
  WHERE v_signals LIKE '%' || brand || '%'
  ORDER BY sort_order
  LIMIT 1;

  v_primary_category := CASE lower(coalesce(v_service.main_category, ''))
    WHEN 'trene-selv' THEN 'trene-selv'
    WHEN 'trene-sammen' THEN 'trene-sammen'
    WHEN 'trene-samen' THEN 'trene-sammen'
    WHEN 'oppfolging' THEN 'oppfolging'
    WHEN 'helse' THEN 'helse'
    WHEN 'aktivitet-sport' THEN 'aktivitet-sport'
    WHEN 'paraidrett' THEN 'paraidrett'
    WHEN 'utendors' THEN 'utendors'
    ELSE NULL
  END;

  SELECT array_agg(cc.key ORDER BY cc.sort_order)
  INTO v_categories
  FROM content_categories cc
  WHERE cc.is_active = true
    AND (
      cc.key = v_primary_category
      OR EXISTS (
        SELECT 1
        FROM service_categories sc
        WHERE sc.service_id = v_service.id
          AND cc.key = CASE lower(sc.category_id)
            WHEN 'trene-samen' THEN 'trene-sammen'
            ELSE lower(sc.category_id)
          END
      )
      OR (cc.key = 'trene-selv' AND v_signals ~ '(styrke|kondisjon|teknologi|treningssenter|styrketrening|klatr|svømm|svomm|crossfit)')
      OR (cc.key = 'trene-sammen' AND v_signals ~ '(gruppe|gruppetime|yoga|mindbody|bootcamp|løpegruppe|lopegruppe|spinning|aerobic|fellestimer|outdoor)')
      OR (cc.key = 'oppfolging' AND v_signals ~ '(pt|personligtrener|personaltrainer|coaching|livsstil|kosthold|ernæring|ernaering|spesialisert)')
      OR (cc.key = 'helse' AND v_signals ~ '(helse|rehab|fysio|kiro|naprapat|osteopati|ernæring|ernaering|spesialisert|klinikk)')
      OR (cc.key = 'aktivitet-sport' AND v_signals ~ '(sport|idrett|fotball|ski|langrenn|tennis|padel|golf|ishockey|friidrett|orientering|kampsport|turn|riding|hest|bowling)')
      OR (cc.key = 'paraidrett' AND v_signals ~ '(paraidrett|tilrettelagt|rullestol|sittevolleyball)')
      OR (cc.key = 'utendors' AND v_signals ~ '(outdoor|utendørs|utendors|utetrening|tuftepark|friluft|aktivitetspark|hinderløype|hinderloype|pumptrack|diskgolf)')
    );

  IF v_primary_category IS NULL AND coalesce(array_length(v_categories, 1), 0) > 0 THEN
    v_primary_category := v_categories[1];
  END IF;

  v_has_physical := (
    (v_service.lat IS NOT NULL AND v_service.lon IS NOT NULL)
    OR nullif(trim(coalesce(v_service.address, '')), '') IS NOT NULL
  );
  v_needs_provider := (
    coalesce(v_service.provider_type, 'business') <> 'facility'
    OR v_orgnr IS NOT NULL
    OR v_source IN ('sport_club', 'pt_search', 'nutrition_search', 'group_fitness', 'paraidrett')
  );
  v_is_public := coalesce(v_service.is_active, true) AND v_service.reported_at IS NULL;

  IF v_service.lat IS NOT NULL AND v_service.lon IS NOT NULL THEN v_quality_score := v_quality_score + 25; END IF;
  IF nullif(trim(coalesce(v_service.address, '')), '') IS NOT NULL THEN v_quality_score := v_quality_score + 20; END IF;
  IF nullif(trim(coalesce(v_service.city, '')), '') IS NOT NULL THEN v_quality_score := v_quality_score + 15; END IF;
  IF v_service.website IS NOT NULL OR v_service.phone IS NOT NULL OR v_service.email IS NOT NULL THEN v_quality_score := v_quality_score + 20; END IF;
  IF length(trim(coalesce(v_service.description, ''))) >= 40 THEN v_quality_score := v_quality_score + 10; END IF;
  IF coalesce(array_length(v_service.tags, 1), 0) >= 2 THEN v_quality_score := v_quality_score + 10; END IF;

  v_provider_id := v_existing_map.provider_id;
  v_venue_id := v_existing_map.venue_id;
  v_offering_id := v_existing_map.offering_id;

  IF NOT v_needs_provider THEN
    v_provider_id := NULL;
  ELSIF v_provider_id IS NULL THEN
    IF v_orgnr IS NOT NULL THEN
      SELECT id INTO v_provider_id
      FROM providers
      WHERE orgnr = v_orgnr
      LIMIT 1;
    END IF;

    IF v_provider_id IS NULL AND v_brand IS NOT NULL THEN
      SELECT id INTO v_provider_id
      FROM providers
      WHERE lower(name) = v_brand
      ORDER BY quality_score DESC, id
      LIMIT 1;
    END IF;

    IF v_provider_id IS NULL THEN
      v_provider_identity := CASE
        WHEN v_orgnr IS NOT NULL THEN 'orgnr:' || v_orgnr
        WHEN v_brand IS NOT NULL THEN 'brand:' || regexp_replace(v_brand, '[^a-z0-9æøå]', '', 'g')
        ELSE 'legacy:' || v_service.id
      END;
      v_provider_id := content_stable_id('provider', v_provider_identity);
    END IF;
  END IF;

  IF v_has_physical AND v_venue_id IS NULL THEN
    v_venue_id := content_stable_id('venue', v_source || ':' || v_service.id);
  END IF;
  IF v_offering_id IS NULL THEN
    v_offering_id := content_stable_id('offering', 'legacy:' || v_service.id);
  END IF;

  IF coalesce(array_length(v_categories, 1), 0) = 0 THEN
    v_reasons := array_append(v_reasons, 'missing_category');
  END IF;
  IF v_provider_id IS NULL AND NOT v_has_physical THEN
    v_reasons := array_append(v_reasons, 'missing_entity_target');
  END IF;

  IF coalesce(array_length(v_reasons, 1), 0) > 0 THEN
    IF v_existing_map.offering_id IS NOT NULL THEN
      UPDATE offerings
      SET is_active = false, updated_at = now()
      WHERE id = v_existing_map.offering_id;

      UPDATE legacy_service_map
      SET status = 'review', reasons = v_reasons, migrated_at = now()
      WHERE service_id = v_service.id;
    END IF;

    INSERT INTO content_review_queue (service_id, reasons, suggested_action, status, resolved_at)
    VALUES (
      v_service.id,
      v_reasons,
      jsonb_build_object('source', 'automatic_sync', 'service_id', v_service.id),
      'pending',
      NULL
    )
    ON CONFLICT (service_id) DO UPDATE SET
      reasons = EXCLUDED.reasons,
      suggested_action = EXCLUDED.suggested_action,
      status = CASE
        WHEN content_review_queue.status = 'resolved' THEN 'pending'
        ELSE content_review_queue.status
      END,
      resolved_at = CASE
        WHEN content_review_queue.status = 'resolved' THEN NULL
        ELSE content_review_queue.resolved_at
      END;

    INSERT INTO content_sync_state (
      service_id, status, attempt_count, last_error, last_synced_at, updated_at
    ) VALUES (
      v_service.id, 'review', 1, array_to_string(v_reasons, ', '), now(), now()
    )
    ON CONFLICT (service_id) DO UPDATE SET
      status = 'review',
      attempt_count = content_sync_state.attempt_count + 1,
      last_error = EXCLUDED.last_error,
      last_synced_at = now(),
      updated_at = now();

    IF v_existing_map.provider_id IS NOT NULL THEN
      UPDATE providers p
      SET
        is_active = EXISTS (
          SELECT 1 FROM offerings o
          WHERE o.provider_id = p.id AND o.is_active = true
        ),
        updated_at = now()
      WHERE p.id = v_existing_map.provider_id;
    END IF;
    RETURN;
  END IF;

  v_provider_name := CASE WHEN v_brand IS NOT NULL THEN initcap(v_brand) ELSE v_service.name END;
  v_provider_kind := CASE
    WHEN v_brand IS NOT NULL THEN 'chain'
    WHEN v_source = 'sport_club' OR v_signals ~ '(idrettslag|klubb|forening)' THEN 'association'
    WHEN v_signals ~ '(kommune|kommunal)' THEN 'municipality'
    WHEN v_source IN ('pt_search', 'nutrition_search') THEN 'independent'
    WHEN v_orgnr IS NOT NULL THEN 'company'
    ELSE 'other'
  END;

  v_venue_kind := CASE
    WHEN v_signals ~ '(treningssenter|fitness|gym)' THEN 'gym'
    WHEN v_signals ~ '(svømm|svomm|basseng|badeland)' THEN 'pool'
    WHEN v_signals ~ '(klatr|buldr)' THEN 'climbing_gym'
    WHEN v_signals ~ '(idrettshall|sportsanlegg|flerbrukshall)' THEN 'sports_hall'
    WHEN v_signals ~ '(ishall|ishockey|skøyte|skoyte)' THEN 'ice_rink'
    WHEN v_signals ~ '(kampsport|martial)' THEN 'martial_arts_studio'
    WHEN v_signals ~ '(padel|tennis|racket)' THEN 'racket_centre'
    WHEN v_signals ~ '(tuftepark|utetrening|outdoor|aktivitetspark)' THEN 'outdoor_gym'
    WHEN v_signals ~ '(fysio|kiro|rehab|klinikk)' THEN 'clinic'
    WHEN v_signals ~ '(yoga|pilates|dans|studio|gruppe)' THEN 'studio'
    WHEN v_service.provider_type = 'facility' OR v_service.type = 'sport' THEN 'sports_facility'
    ELSE 'other'
  END;

  v_delivery_mode := CASE
    WHEN v_signals ~ '(online|digital)' AND v_has_physical THEN 'hybrid'
    WHEN v_signals ~ '(online|digital)' THEN 'online'
    WHEN v_signals ~ '(hjemmetrening)' AND NOT v_has_physical THEN 'mobile'
    ELSE 'onsite'
  END;

  IF v_provider_id IS NOT NULL THEN
    INSERT INTO providers (
      id, name, legal_name, orgnr, provider_kind, website, phone, email,
      owner_user_id, verification_status, quality_score, is_active, updated_at
    ) VALUES (
      v_provider_id,
      v_provider_name,
      CASE WHEN v_orgnr IS NOT NULL THEN v_service.name ELSE NULL END,
      v_orgnr,
      v_provider_kind,
      v_service.website,
      v_service.phone,
      v_service.email,
      v_service.owner_user_id,
      CASE WHEN v_service.owner_user_id IS NOT NULL THEN 'claimed' ELSE 'imported' END,
      v_quality_score,
      v_is_public,
      now()
    )
    ON CONFLICT (id) DO NOTHING;

    SELECT EXISTS (
      SELECT 1
      FROM legacy_service_map lsm
      WHERE lsm.provider_id = v_provider_id
        AND lsm.service_id <> v_service.id
    ) INTO v_provider_shared;

    UPDATE providers p
    SET
      name = CASE
        WHEN NOT v_provider_shared OR v_quality_score > p.quality_score THEN v_provider_name
        ELSE p.name
      END,
      legal_name = CASE
        WHEN NOT v_provider_shared OR v_quality_score > p.quality_score
          THEN CASE WHEN v_orgnr IS NOT NULL THEN v_service.name ELSE p.legal_name END
        ELSE p.legal_name
      END,
      orgnr = coalesce(p.orgnr, v_orgnr),
      provider_kind = CASE WHEN p.provider_kind = 'other' THEN v_provider_kind ELSE p.provider_kind END,
      website = CASE
        WHEN NOT v_provider_shared OR v_quality_score > p.quality_score
          THEN coalesce(v_service.website, p.website)
        ELSE coalesce(p.website, v_service.website)
      END,
      phone = CASE
        WHEN NOT v_provider_shared OR v_quality_score > p.quality_score
          THEN coalesce(v_service.phone, p.phone)
        ELSE coalesce(p.phone, v_service.phone)
      END,
      email = CASE
        WHEN NOT v_provider_shared OR v_quality_score > p.quality_score
          THEN coalesce(v_service.email, p.email)
        ELSE coalesce(p.email, v_service.email)
      END,
      owner_user_id = coalesce(v_service.owner_user_id, p.owner_user_id),
      verification_status = CASE
        WHEN v_service.owner_user_id IS NOT NULL AND p.verification_status = 'imported' THEN 'claimed'
        ELSE p.verification_status
      END,
      quality_score = greatest(p.quality_score, v_quality_score),
      updated_at = now()
    WHERE p.id = v_provider_id;
  END IF;

  IF v_has_physical THEN
    INSERT INTO venues (
      id, provider_id, name, venue_kind, address, city, lat, lon,
      website, phone, email, status, quality_score, updated_at
    ) VALUES (
      v_venue_id,
      v_provider_id,
      v_service.name,
      v_venue_kind,
      v_service.address,
      v_service.city,
      v_service.lat,
      v_service.lon,
      v_service.website,
      v_service.phone,
      v_service.email,
      CASE WHEN v_is_public THEN 'active' ELSE 'inactive' END,
      v_quality_score,
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      provider_id = EXCLUDED.provider_id,
      name = EXCLUDED.name,
      venue_kind = EXCLUDED.venue_kind,
      address = EXCLUDED.address,
      city = EXCLUDED.city,
      lat = EXCLUDED.lat,
      lon = EXCLUDED.lon,
      website = EXCLUDED.website,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email,
      status = EXCLUDED.status,
      quality_score = EXCLUDED.quality_score,
      updated_at = now();
  ELSIF v_venue_id IS NOT NULL THEN
    UPDATE venues SET status = 'inactive', updated_at = now() WHERE id = v_venue_id;
  END IF;

  INSERT INTO offerings (
    id, provider_id, name, description, delivery_mode, price_level,
    tags, goals, is_active, updated_at
  ) VALUES (
    v_offering_id,
    v_provider_id,
    v_service.name,
    v_service.description,
    v_delivery_mode,
    v_service.price_level,
    coalesce(v_service.tags, '{}'::text[]),
    coalesce(v_service.goals, '{}'::text[]),
    v_is_public,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    provider_id = EXCLUDED.provider_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    delivery_mode = EXCLUDED.delivery_mode,
    price_level = EXCLUDED.price_level,
    tags = EXCLUDED.tags,
    goals = EXCLUDED.goals,
    is_active = EXCLUDED.is_active,
    updated_at = now();

  DELETE FROM offering_venues
  WHERE offering_id = v_offering_id
    AND sync_managed = true
    AND (NOT v_has_physical OR venue_id <> v_venue_id);

  IF v_has_physical THEN
    SELECT EXISTS (
      SELECT 1 FROM offering_venues
      WHERE offering_id = v_offering_id
        AND is_primary = true
        AND sync_managed = false
    ) INTO v_manual_venue_primary;

    INSERT INTO offering_venues (offering_id, venue_id, is_primary, sync_managed)
    VALUES (v_offering_id, v_venue_id, NOT v_manual_venue_primary, true)
    ON CONFLICT (offering_id, venue_id) DO NOTHING;
  ELSE
    DELETE FROM offering_venues
    WHERE offering_id = v_offering_id AND sync_managed = true;
  END IF;

  DELETE FROM offering_categories
  WHERE offering_id = v_offering_id AND sync_managed = true;

  SELECT EXISTS (
    SELECT 1 FROM offering_categories
    WHERE offering_id = v_offering_id
      AND is_primary = true
      AND sync_managed = false
  ) INTO v_manual_category_primary;

  FOREACH v_category IN ARRAY v_categories LOOP
    INSERT INTO offering_categories (offering_id, category_key, is_primary, sync_managed)
    VALUES (
      v_offering_id,
      v_category,
      v_category = v_primary_category AND NOT v_manual_category_primary,
      true
    )
    ON CONFLICT (offering_id, category_key) DO NOTHING;
  END LOOP;

  INSERT INTO legacy_service_map (
    service_id, provider_id, venue_id, offering_id, migration_run_id,
    confidence, status, reasons, migrated_at
  ) VALUES (
    v_service.id,
    v_provider_id,
    v_venue_id,
    v_offering_id,
    v_existing_map.migration_run_id,
    0.900,
    'migrated',
    '{}'::text[],
    now()
  )
  ON CONFLICT (service_id) DO UPDATE SET
    provider_id = EXCLUDED.provider_id,
    venue_id = EXCLUDED.venue_id,
    offering_id = EXCLUDED.offering_id,
    confidence = greatest(legacy_service_map.confidence, EXCLUDED.confidence),
    status = 'migrated',
    reasons = '{}'::text[],
    migrated_at = now();

  INSERT INTO content_sources (
    source, external_id, entity_type, provider_id, venue_id, offering_id,
    confidence, imported_at, source_updated_at
  ) VALUES (
    v_source, v_service.id, 'offering', NULL, NULL, v_offering_id,
    0.900, now(), now()
  )
  ON CONFLICT (source, external_id, entity_type) DO UPDATE SET
    provider_id = NULL,
    venue_id = NULL,
    offering_id = EXCLUDED.offering_id,
    confidence = greatest(content_sources.confidence, EXCLUDED.confidence),
    source_updated_at = now();

  IF v_provider_id IS NOT NULL THEN
    INSERT INTO content_sources (
      source, external_id, entity_type, provider_id, venue_id, offering_id,
      confidence, imported_at, source_updated_at
    ) VALUES (
      v_source, v_service.id, 'provider', v_provider_id, NULL, NULL,
      0.900, now(), now()
    )
    ON CONFLICT (source, external_id, entity_type) DO UPDATE SET
      provider_id = EXCLUDED.provider_id,
      venue_id = NULL,
      offering_id = NULL,
      confidence = greatest(content_sources.confidence, EXCLUDED.confidence),
      source_updated_at = now();
  END IF;

  IF v_has_physical THEN
    INSERT INTO content_sources (
      source, external_id, entity_type, provider_id, venue_id, offering_id,
      confidence, imported_at, source_updated_at
    ) VALUES (
      v_source, v_service.id, 'venue', NULL, v_venue_id, NULL,
      0.900, now(), now()
    )
    ON CONFLICT (source, external_id, entity_type) DO UPDATE SET
      provider_id = NULL,
      venue_id = EXCLUDED.venue_id,
      offering_id = NULL,
      confidence = greatest(content_sources.confidence, EXCLUDED.confidence),
      source_updated_at = now();
  END IF;

  UPDATE content_review_queue
  SET status = 'resolved', resolved_at = now()
  WHERE service_id = v_service.id AND status = 'pending';

  IF v_provider_id IS NOT NULL THEN
    UPDATE providers p
    SET
      is_active = EXISTS (
        SELECT 1 FROM offerings o
        WHERE o.provider_id = p.id AND o.is_active = true
      ),
      updated_at = now()
    WHERE p.id = v_provider_id;
  END IF;

  INSERT INTO content_sync_state (
    service_id, status, attempt_count, last_error, last_synced_at, updated_at
  ) VALUES (
    v_service.id, 'synced', 1, NULL, now(), now()
  )
  ON CONFLICT (service_id) DO UPDATE SET
    status = 'synced',
    attempt_count = content_sync_state.attempt_count + 1,
    last_error = NULL,
    last_synced_at = now(),
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION handle_service_content_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
  BEGIN
    PERFORM sync_service_content(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO content_sync_state (
      service_id, status, attempt_count, last_error, last_synced_at, updated_at
    ) VALUES (
      NEW.id, 'failed', 1, left(SQLERRM, 1000), NULL, now()
    )
    ON CONFLICT (service_id) DO UPDATE SET
      status = 'failed',
      attempt_count = content_sync_state.attempt_count + 1,
      last_error = EXCLUDED.last_error,
      updated_at = now();
  END;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION handle_service_relation_content_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_service_id text;
BEGIN
  v_service_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.service_id ELSE NEW.service_id END;
  BEGIN
    PERFORM sync_service_content(v_service_id);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO content_sync_state (
      service_id, status, attempt_count, last_error, last_synced_at, updated_at
    ) VALUES (
      v_service_id, 'failed', 1, left(SQLERRM, 1000), NULL, now()
    )
    ON CONFLICT (service_id) DO UPDATE SET
      status = 'failed',
      attempt_count = content_sync_state.attempt_count + 1,
      last_error = EXCLUDED.last_error,
      updated_at = now();
  END;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION handle_service_content_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_map legacy_service_map%ROWTYPE;
BEGIN
  BEGIN
    SELECT * INTO v_map FROM legacy_service_map WHERE service_id = OLD.id;

    IF v_map.offering_id IS NOT NULL THEN
      DELETE FROM offerings WHERE id = v_map.offering_id;
    END IF;

    IF v_map.venue_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM offering_venues WHERE venue_id = v_map.venue_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM legacy_service_map
        WHERE venue_id = v_map.venue_id AND service_id <> OLD.id
      ) THEN
      DELETE FROM venues WHERE id = v_map.venue_id;
    END IF;

    IF v_map.provider_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM offerings WHERE provider_id = v_map.provider_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM venues WHERE provider_id = v_map.provider_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM legacy_service_map
        WHERE provider_id = v_map.provider_id AND service_id <> OLD.id
      ) THEN
      DELETE FROM providers WHERE id = v_map.provider_id;
    ELSIF v_map.provider_id IS NOT NULL THEN
      UPDATE providers p
      SET is_active = EXISTS (
        SELECT 1 FROM offerings o
        WHERE o.provider_id = p.id AND o.is_active = true
      ), updated_at = now()
      WHERE p.id = v_map.provider_id;
    END IF;

    INSERT INTO content_sync_state (
      service_id, status, attempt_count, last_error, last_synced_at, updated_at
    ) VALUES (
      OLD.id, 'deleted', 1, NULL, now(), now()
    )
    ON CONFLICT (service_id) DO UPDATE SET
      status = 'deleted',
      attempt_count = content_sync_state.attempt_count + 1,
      last_error = NULL,
      last_synced_at = now(),
      updated_at = now();
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO content_sync_state (
      service_id, status, attempt_count, last_error, last_synced_at, updated_at
    ) VALUES (
      OLD.id, 'failed', 1, left(SQLERRM, 1000), NULL, now()
    )
    ON CONFLICT (service_id) DO UPDATE SET
      status = 'failed',
      attempt_count = content_sync_state.attempt_count + 1,
      last_error = EXCLUDED.last_error,
      updated_at = now();
  END;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_services_content_sync_insert ON services;
CREATE TRIGGER trg_services_content_sync_insert
AFTER INSERT ON services
FOR EACH ROW EXECUTE FUNCTION handle_service_content_sync();

DROP TRIGGER IF EXISTS trg_services_content_sync_update ON services;
CREATE TRIGGER trg_services_content_sync_update
AFTER UPDATE OF
  name, description, type, main_category, provider_type, price_level,
  goals, venues, tags, is_active, reported_at, address, city,
  base_location, lat, lon, website, phone, email, orgnr, owner_user_id
ON services
FOR EACH ROW EXECUTE FUNCTION handle_service_content_sync();

DROP TRIGGER IF EXISTS trg_services_content_sync_delete ON services;
CREATE TRIGGER trg_services_content_sync_delete
BEFORE DELETE ON services
FOR EACH ROW EXECUTE FUNCTION handle_service_content_delete();

DROP TRIGGER IF EXISTS trg_service_types_content_sync ON service_types;
CREATE TRIGGER trg_service_types_content_sync
AFTER INSERT OR UPDATE OR DELETE ON service_types
FOR EACH ROW EXECUTE FUNCTION handle_service_relation_content_sync();

DROP TRIGGER IF EXISTS trg_service_categories_content_sync ON service_categories;
CREATE TRIGGER trg_service_categories_content_sync
AFTER INSERT OR UPDATE OR DELETE ON service_categories
FOR EACH ROW EXECUTE FUNCTION handle_service_relation_content_sync();

-- A small service-role-only health endpoint lets operations verify both data
-- coverage and trigger installation without exposing the sync log publicly.
CREATE OR REPLACE FUNCTION get_content_sync_health()
RETURNS TABLE (
  current_services bigint,
  tracked_services bigint,
  synced_services bigint,
  review_services bigint,
  failed_services bigint,
  deleted_states bigint,
  enabled_triggers bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    (SELECT count(*) FROM services),
    (
      SELECT count(*)
      FROM services s
      JOIN content_sync_state css ON css.service_id = s.id
      WHERE css.status IN ('synced', 'review')
    ),
    (
      SELECT count(*)
      FROM services s
      JOIN content_sync_state css ON css.service_id = s.id
      WHERE css.status = 'synced'
    ),
    (
      SELECT count(*)
      FROM services s
      JOIN content_sync_state css ON css.service_id = s.id
      WHERE css.status = 'review'
    ),
    (
      SELECT count(*)
      FROM services s
      JOIN content_sync_state css ON css.service_id = s.id
      WHERE css.status = 'failed'
    ),
    (SELECT count(*) FROM content_sync_state WHERE status = 'deleted'),
    (
      SELECT count(*)
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND t.tgname IN (
          'trg_services_content_sync_insert',
          'trg_services_content_sync_update',
          'trg_services_content_sync_delete',
          'trg_service_types_content_sync',
          'trg_service_categories_content_sync'
        )
        AND t.tgenabled <> 'D'
        AND NOT t.tgisinternal
    );
$$;

REVOKE ALL ON FUNCTION content_stable_id(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION content_source_for_service(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION sync_service_content(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_content_sync_health() FROM PUBLIC;
REVOKE ALL ON FUNCTION handle_service_content_sync() FROM PUBLIC;
REVOKE ALL ON FUNCTION handle_service_relation_content_sync() FROM PUBLIC;
REVOKE ALL ON FUNCTION handle_service_content_delete() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION sync_service_content(text) TO service_role;
GRANT EXECUTE ON FUNCTION get_content_sync_health() TO service_role;

-- Transactional self-test: exercises insert, update, relation sync, manual
-- category preservation and delete cleanup. No test data survives COMMIT.
DO $$
DECLARE
  v_test_service_id text := '__content_sync_self_test__';
  v_test_offering_id text;
  v_test_provider_id text;
  v_test_venue_id text;
BEGIN
  IF EXISTS (SELECT 1 FROM services WHERE id = v_test_service_id) THEN
    RAISE EXCEPTION 'Reserved content sync self-test ID already exists';
  END IF;

  INSERT INTO services (
    id, name, type, description, price_level, goals, venues, coverage, tags,
    is_active, main_category, provider_type, address, city, base_location
  ) VALUES (
    v_test_service_id,
    'Content Sync Test',
    'styrke',
    'Temporary row used by SQL 46 transactional self-test.',
    'medium',
    ARRAY['strength']::text[],
    ARRAY['gym']::text[],
    '[]'::jsonb,
    ARRAY['styrke', 'treningssenter']::text[],
    false,
    'trene-selv',
    'business',
    'Testveien 1',
    'Oslo',
    ST_SetSRID(ST_MakePoint(10.7522, 59.9139), 4326)::geography
  );

  SELECT provider_id, venue_id, offering_id
  INTO v_test_provider_id, v_test_venue_id, v_test_offering_id
  FROM legacy_service_map
  WHERE service_id = v_test_service_id;

  IF v_test_offering_id IS NULL OR v_test_provider_id IS NULL OR v_test_venue_id IS NULL THEN
    RAISE EXCEPTION 'Content sync self-test did not create the entity graph';
  END IF;

  INSERT INTO offering_categories (offering_id, category_key, is_primary, sync_managed)
  VALUES (v_test_offering_id, 'helse', false, false);

  UPDATE offering_venues
  SET sync_managed = false
  WHERE offering_id = v_test_offering_id
    AND venue_id = v_test_venue_id;

  UPDATE services
  SET name = 'Content Sync Test Updated'
  WHERE id = v_test_service_id;

  IF NOT EXISTS (
    SELECT 1 FROM offerings
    WHERE id = v_test_offering_id AND name = 'Content Sync Test Updated'
  ) THEN
    RAISE EXCEPTION 'Content sync self-test did not propagate service update';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM offering_categories
    WHERE offering_id = v_test_offering_id
      AND category_key = 'helse'
      AND sync_managed = false
  ) THEN
    RAISE EXCEPTION 'Content sync self-test removed a manual category';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM offering_venues
    WHERE offering_id = v_test_offering_id
      AND venue_id = v_test_venue_id
      AND sync_managed = false
  ) THEN
    RAISE EXCEPTION 'Content sync self-test removed a manual venue link';
  END IF;

  INSERT INTO service_types (service_id, type, is_primary)
  VALUES (v_test_service_id, 'sport', false);

  IF NOT EXISTS (
    SELECT 1 FROM offering_categories
    WHERE offering_id = v_test_offering_id
      AND category_key = 'aktivitet-sport'
      AND sync_managed = true
  ) THEN
    RAISE EXCEPTION 'Content sync self-test did not propagate service type';
  END IF;

  DELETE FROM services WHERE id = v_test_service_id;

  IF EXISTS (SELECT 1 FROM offerings WHERE id = v_test_offering_id) THEN
    RAISE EXCEPTION 'Content sync self-test did not clean up offering';
  END IF;

  IF EXISTS (SELECT 1 FROM venues WHERE id = v_test_venue_id)
    OR EXISTS (SELECT 1 FROM providers WHERE id = v_test_provider_id)
    OR EXISTS (SELECT 1 FROM legacy_service_map WHERE service_id = v_test_service_id)
    OR EXISTS (SELECT 1 FROM content_sources WHERE external_id = v_test_service_id) THEN
    RAISE EXCEPTION 'Content sync self-test left orphaned entity data';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM content_sync_state
    WHERE service_id = v_test_service_id AND status = 'deleted'
  ) THEN
    RAISE EXCEPTION 'Content sync self-test did not record deletion state';
  END IF;

  DELETE FROM content_sync_state WHERE service_id = v_test_service_id;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
