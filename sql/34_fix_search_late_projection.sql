-- ============================================
-- FIX 3: search_services() — fortsatt treg etter sql/32 (GIST-indeks) og
-- sql/33 (UNION ALL-omskriving av matched_coverage)
--
-- EKTE EXPLAIN ANALYZE-data innhentet av bruker direkte i Supabase SQL Editor
-- (2026-06-22) — IKKE gjettet denne gangen:
--   - Hele search_services(...)-kallet: 2087ms total execution time
--   - Den isolerte gren C-spørringen alene (by-avstand-fallback, hot path fra
--     sql/33): kun 392ms, bruker "Index Scan using idx_services_base_location"
--     korrekt (3913 rader inn -> 3545 rader ut etter filter)
-- Konklusjon: indeks- og UNION-fiksene fungerer som tiltenkt for selve
-- coverage-matchingen (392ms av 2087ms). De resterende ~1700ms går til resten
-- av funksjonen — scoring/match-flagg/reasons-beregning for ALLE 3545
-- kandidater, FØR ORDER BY+LIMIT trimmer ned til de p_limit (typisk 50) radene
-- som faktisk returneres til klienten. 2087ms i SQL Editor er under dens egen
-- timeout, men API-kallet via anon/authenticated-rollen timer fortsatt ut
-- (~3.2-4s) — sannsynligvis en kortere statement_timeout for disse rollene,
-- pluss PostgREST/pooler-overhead på toppen av de 2087ms.
--
-- ROTÅRSAK (denne gangen): `reasons`-kolonnen bygges via en korrelert
-- subquery (`SELECT array_agg(reason) FROM (SELECT unnest(ARRAY[...]) ...)`)
-- i den ALLER YTTERSTE SELECT-en — men den ytterste SELECT-en i den
-- opprinnelige strukturen kjører FØR ORDER BY+LIMIT (Postgres sin executor må
-- produsere fullt projiserte rader for å kunne sortere dem, og kan ikke
-- utsette en korrelert subquery i målet-listen til etter LIMIT når Sort+Limit
-- ligger UTENPÅ projeksjonen i spørringstreet). Resultat: subqueryen kjøres
-- per rad for ALLE 3545 kandidater som overlever goal/type/budget/venue-
-- filtrene, ikke bare de p_limit som faktisk skal returneres. Samme gjelder i
-- prinsippet `match_reason`-CASE-en, men den er billig (ingen subquery) og var
-- derfor ikke en reell flaskehals i seg selv — flyttet ut likevel for
-- struktur-symmetri, ingen ytelsesgevinst påstått fra den delen isolert.
--
-- FIX: del opp slutten av funksjonen i to lag:
--   1. `scored_services` — uendret beregning av goal_match/type_match/
--      budget_match/venue_match/rating_score/distance_score/venue_label +
--      score, med samme WHERE-filter som før (goal/type/budget/venue).
--      Kjøres fortsatt på alle kandidater — det er uunngåelig, siden disse
--      filtrene avgjør hvilke rader som i det hele tatt skal være med, og må
--      derfor være ferdige FØR vi vet hvilke 50 rader som vinner.
--   2. `limited_services` — NY CTE. Gjør `ORDER BY ... LIMIT max_limit OFFSET
--      p_offset` rett etter (1), FØR noe annet skjer. Etter dette laget
--      finnes maks `max_limit` rader (typisk 50, aldri mer enn 100).
-- Den ytterste SELECT-en (som bygger `reasons`/`match_reason`/lat/lon m.m.)
-- leser nå KUN fra `limited_services` — den korrelerte subqueryen kjører
-- derfor maks `max_limit` ganger, ikke 3545 ganger. Score-beregningen (ren
-- aritmetikk, ingen subquery) ligger fortsatt i `scored_services`, siden
-- `sort_mode='best_match'` (default) sorterer PÅ score — den må være
-- beregnet FØR sorteringen, i motsetning til reasons som er et rent
-- visningsfelt uten betydning for verken WHERE eller ORDER BY.
--
-- Ingen endring i hvilke rader som matcher eller hvilken rekkefølge de
-- returneres i — kun NÅR i spørringen det dyreste feltet beregnes.
--
-- Input-parameterliste og RETURNS TABLE UENDRET fra sql/33 (26 kolonner).
-- DROP+CREATE kjøres som forsiktighetsregel siden hele kroppen erstattes.
-- ============================================

DROP FUNCTION IF EXISTS search_services(
  text, double precision, double precision,
  text, text, text, text, text, text,
  integer, text, text, text, text[], double precision, int
);

CREATE OR REPLACE FUNCTION search_services(
  p_city             text,
  p_lat              double precision,
  p_lon              double precision,
  p_goal             text,
  p_service_type     text,
  p_budget           text,
  p_venue            text,
  p_sort             text,
  p_query            text,
  p_limit            int,
  p_borough          text             DEFAULT NULL,
  p_tag              text             DEFAULT NULL,
  p_main_category    text             DEFAULT NULL,
  p_tags             text[]           DEFAULT NULL,
  p_radius_km        double precision DEFAULT NULL,
  p_offset           int              DEFAULT 0
) RETURNS TABLE (
  service_id text,
  name text,
  type text,
  description text,
  coverage jsonb,
  price_level text,
  rating_avg numeric,
  rating_count int,
  tags text[],
  goals text[],
  venues text[],
  is_active boolean,
  distance_km numeric,
  score numeric,
  reasons text[],
  match_reason text,
  address text,
  phone text,
  email text,
  website text,
  orgnr text,
  lat double precision,
  lon double precision,
  cover_image_url text,
  logo_image_url text,
  provider_type text
) AS $$
#variable_conflict use_column
DECLARE
  user_point geography;
  venue_key text;
  goal_candidate text := COALESCE(p_goal, 'any');
  type_candidate text := COALESCE(p_service_type, 'any');
  budget_candidate text := COALESCE(p_budget, 'any');
  venue_candidate text := COALESCE(p_venue, 'either');
  sort_mode text := COALESCE(NULLIF(p_sort, ''), 'best_match');
  max_limit int := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
  normalized_query text := NULL;
  borough_candidate text := NULL;
  tag_candidate text := NULL;
BEGIN
  IF p_lat IS NOT NULL AND p_lon IS NOT NULL THEN
    user_point := ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326);
    IF p_sort IS NULL OR p_sort = '' THEN
      sort_mode := 'nearest';
    END IF;
  END IF;

  IF p_query IS NOT NULL THEN
    normalized_query := NULLIF(TRIM(p_query), '');
    IF normalized_query IS NOT NULL THEN
      normalized_query := lower(normalized_query);
    END IF;
  END IF;

  IF p_borough IS NOT NULL THEN
    borough_candidate := NULLIF(TRIM(p_borough), '');
    IF borough_candidate IS NOT NULL THEN
      borough_candidate := lower(borough_candidate);
    END IF;
  END IF;

  IF p_tag IS NOT NULL THEN
    tag_candidate := NULLIF(TRIM(p_tag), '');
    IF tag_candidate IS NOT NULL THEN
      tag_candidate := lower(tag_candidate);
    END IF;
  END IF;

  IF venue_candidate = 'home' THEN
    venue_key := 'home';
  ELSIF venue_candidate = 'gym' THEN
    venue_key := 'gym';
  ELSE
    venue_key := NULL;
  END IF;

  RETURN QUERY
  WITH matched_coverage_raw AS (
    -- Gren A: radius-dekning (0 rader i prod i dag, men beholdt for korrekthet/fremtid)
    SELECT
      sc.service_id,
      sc.type,
      sc.radius_km,
      sc.city,
      sc.region,
      sc.radius_center,
      ST_Distance(sc.radius_center, user_point) / 1000 AS distance_km,
      1 AS coverage_rank
    FROM service_coverage sc
    WHERE sc.type = 'radius'
      AND user_point IS NOT NULL
      AND sc.radius_center IS NOT NULL
      AND sc.radius_km IS NOT NULL
      AND ST_DWithin(sc.radius_center, user_point, sc.radius_km * 1000)

    UNION ALL

    -- Gren B: by-navn-match (eksakt by valgt av bruker)
    SELECT
      sc.service_id,
      sc.type,
      sc.radius_km,
      sc.city,
      sc.region,
      sc.radius_center,
      CASE
        WHEN user_point IS NOT NULL AND s_loc.base_location IS NOT NULL
          THEN ST_Distance(s_loc.base_location, user_point) / 1000
        ELSE NULL
      END AS distance_km,
      2 AS coverage_rank
    FROM service_coverage sc
    LEFT JOIN services s_loc ON s_loc.id = sc.service_id
    WHERE sc.type = 'city'
      AND p_city IS NOT NULL
      AND p_city <> ''
      AND sc.city IS NOT NULL
      AND lower(sc.city) = lower(p_city)

    UNION ALL

    -- Gren C: by-avstand-fallback (proximity) — hot path for p_city=NULL.
    -- Bekreftet via EXPLAIN ANALYZE 2026-06-22: 392ms, Index Scan using
    -- idx_services_base_location (sql/32) — denne grenen fungerer korrekt.
    SELECT
      sc.service_id,
      sc.type,
      sc.radius_km,
      sc.city,
      sc.region,
      sc.radius_center,
      ST_Distance(s_loc.base_location, user_point) / 1000 AS distance_km,
      2 AS coverage_rank
    FROM service_coverage sc
    JOIN services s_loc ON s_loc.id = sc.service_id
    WHERE sc.type = 'city'
      AND user_point IS NOT NULL
      AND s_loc.base_location IS NOT NULL
      AND ST_DWithin(s_loc.base_location, user_point, COALESCE(p_radius_km, 25) * 1000)

    UNION ALL

    -- Gren D: landsdekkende/nordisk (kun online-tjenester)
    SELECT
      sc.service_id,
      sc.type,
      sc.radius_km,
      sc.city,
      sc.region,
      sc.radius_center,
      CASE
        WHEN user_point IS NOT NULL AND s_loc.base_location IS NOT NULL
          THEN ST_Distance(s_loc.base_location, user_point) / 1000
        ELSE NULL
      END AS distance_km,
      3 AS coverage_rank
    FROM service_coverage sc
    LEFT JOIN services s_loc ON s_loc.id = sc.service_id
    WHERE sc.type = 'region'
      AND sc.region IS NOT NULL
      AND lower(sc.region) IN ('norway', 'nordic')
      AND 'online' = ANY(s_loc.venues)
  ),
  matched_coverage AS (
    SELECT DISTINCT ON (service_id)
      service_id,
      type,
      radius_km,
      city,
      region,
      radius_center,
      distance_km,
      coverage_rank
    FROM matched_coverage_raw
    ORDER BY service_id, coverage_rank, COALESCE(distance_km, 0)
  ),
  ranked_services AS (
    SELECT
      s.*,
      mc.distance_km,
      mc.type AS coverage_type,
      mc.radius_km,
      mc.city AS coverage_city,
      mc.region AS coverage_region,
      CASE
        WHEN normalized_query IS NOT NULL THEN similarity(s.search_text, normalized_query)
        ELSE 0
      END AS query_similarity
    FROM services s
    JOIN matched_coverage mc ON mc.service_id = s.id
    WHERE s.is_active = true
      AND s.reported_at IS NULL
      AND (
        borough_candidate IS NULL
        OR lower(coalesce(s.oslo_bydel, '')) = borough_candidate
      )
      AND (
        normalized_query IS NULL
        OR s.search_text % normalized_query
      )
      AND (tag_candidate IS NULL OR tag_candidate = ANY(s.tags))
      AND (
        p_main_category IS NULL
        OR s.main_category = p_main_category
        OR EXISTS (
          SELECT 1 FROM service_types st
          WHERE st.service_id = s.id
            AND st.type = ANY(CASE p_main_category
              WHEN 'trene-selv'      THEN ARRAY['styrke','kondisjon','teknologi']
              WHEN 'trene-sammen'    THEN ARRAY['gruppe','yoga','mindbody','outdoor']
              WHEN 'oppfolging'      THEN ARRAY['pt','spesialisert','livsstil']
              WHEN 'helse'           THEN ARRAY['rehab','ernæring','helse','spesialisert']
              WHEN 'aktivitet-sport' THEN ARRAY['sport']
              WHEN 'utendors'        THEN ARRAY['outdoor']
              ELSE ARRAY[]::text[]
            END)
        )
      )
      AND (p_tags IS NULL OR s.tags && p_tags)
      AND (
        p_radius_km IS NULL
        OR mc.distance_km IS NULL
        OR mc.distance_km <= p_radius_km
      )
  ),
  -- NYTT LAG (1/2): match-flagg + score for ALLE kandidater som overlevde
  -- coverage-matching + basisfiltrene over. Uunngåelig å kjøre på hele settet
  -- — goal/type/budget/venue-filtrene avgjør hvilke rader som er med i det
  -- hele tatt, og score trengs for sortering når sort_mode='best_match'.
  -- INGEN korrelerte subqueries her — kun ren aritmetikk/boolske uttrykk.
  scored_services AS (
    SELECT
      rs.*,
      (
        (CASE WHEN rs.goal_match THEN 4 ELSE 0 END)
        + (CASE WHEN rs.type_match THEN 3 ELSE 0 END)
        + (CASE WHEN rs.budget_match THEN 2 ELSE 0 END)
        + (CASE WHEN rs.venue_match THEN 2 ELSE 0 END)
        + rs.rating_score
        + rs.distance_score
        + (CASE WHEN rs.query_similarity > 0 THEN rs.query_similarity * 4 ELSE 0 END)
      )::numeric(12,4) AS score
    FROM (
      SELECT *,
        CASE venue_key WHEN 'home' THEN 'Hjemme' WHEN 'gym' THEN 'Senter' ELSE NULL END AS venue_label
      FROM (
        SELECT rs0.*,
          (goal_candidate = 'any' OR goal_candidate = '' OR goal_candidate::text = ANY(rs0.goals)) AS goal_match,
          (type_candidate = 'any' OR type_candidate = '' OR EXISTS (
            SELECT 1 FROM service_types st
            WHERE st.service_id = rs0.id AND st.type = type_candidate
          )) AS type_match,
          (budget_candidate = 'any' OR budget_candidate = '' OR budget_candidate::text = rs0.price_level) AS budget_match,
          (venue_key IS NOT NULL AND venue_key = ANY(rs0.venues)) AS venue_match,
          CASE
            WHEN rs0.rating_avg >= 4.7 THEN 3 WHEN rs0.rating_avg >= 4.4 THEN 2
            WHEN rs0.rating_avg >= 4.1 THEN 1 ELSE 0
          END AS rating_score,
          CASE
            WHEN rs0.distance_km IS NULL THEN 0 WHEN rs0.distance_km <= 5 THEN 3
            WHEN rs0.distance_km <= 15 THEN 2 WHEN rs0.distance_km <= 30 THEN 1 ELSE 0
          END AS distance_score
        FROM ranked_services rs0
      ) AS matched
    ) AS rs
    WHERE (goal_candidate IN ('any', '') OR rs.goal_match)
      AND (type_candidate IN ('any', '') OR rs.type_match)
      AND (budget_candidate IN ('any', '') OR rs.budget_match)
      AND (venue_key IS NULL OR rs.venue_match)
  ),
  -- NYTT LAG (2/2): sortering + trimming til maks max_limit rader HER, FØR
  -- den ytterste SELECT-en under bygger reasons/match_reason/lat/lon. Dette
  -- er selve fiksen — alt etter dette punktet kjører på maks 100 rader
  -- (typisk 50), ikke 3545.
  limited_services AS (
    SELECT ss.*
    FROM scored_services ss
    ORDER BY
      CASE sort_mode
        WHEN 'nearest' THEN COALESCE(ss.distance_km, 99999)
        WHEN 'rating' THEN -ss.rating_avg
        WHEN 'price_low' THEN CASE ss.price_level WHEN 'low' THEN 1 WHEN 'medium' THEN 2 WHEN 'high' THEN 3 ELSE 4 END
        WHEN 'price_high' THEN CASE ss.price_level WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END * -1
        ELSE -ss.score
      END,
      CASE sort_mode
        WHEN 'nearest' THEN -ss.rating_avg WHEN 'rating' THEN -ss.rating_count ELSE -ss.rating_avg
      END
    LIMIT max_limit OFFSET COALESCE(p_offset, 0)
  )
  -- Ytterste SELECT: leser KUN fra limited_services (maks max_limit rader).
  -- reasons-subqueryen under kjører derfor maks max_limit ganger, ikke for
  -- hele kandidatsettet — dette er hele poenget med restruktureringen.
  SELECT
    ls.id,
    ls.name,
    ls.type,
    ls.description,
    ls.coverage,
    ls.price_level,
    ls.rating_avg,
    ls.rating_count,
    ls.tags,
    ls.goals,
    ls.venues,
    ls.is_active,
    ls.distance_km::numeric,
    ls.score,
    (
      SELECT array_agg(reason)
      FROM (
        SELECT reason FROM (
          SELECT unnest(ARRAY[
            CASE WHEN ls.goal_match THEN 'Mål match' ELSE NULL END,
            CASE WHEN ls.type_match THEN 'Type match' ELSE NULL END,
            CASE WHEN ls.budget_match THEN 'Budsjett match' ELSE NULL END,
            CASE WHEN ls.venue_match THEN 'Passer ' || ls.venue_label ELSE NULL END,
            CASE WHEN ls.rating_score > 0 THEN 'God rating' ELSE NULL END,
            CASE WHEN ls.distance_score > 0 THEN 'Nær deg' ELSE NULL END,
            CASE WHEN ls.query_similarity > 0 THEN 'Treff på søk' ELSE NULL END
          ]) AS reason
        ) AS populated WHERE reason IS NOT NULL LIMIT 4
      ) AS reason_list
    ) AS reasons,
    CASE
      WHEN ls.coverage_type = 'radius' THEN 'Innenfor ' || ls.radius_km::text || ' km'
      WHEN ls.coverage_type = 'city' THEN 'Dekker ' || ls.coverage_city
      WHEN lower(ls.coverage_region) = 'nordic' THEN 'Tilgjengelig i hele Norden'
      ELSE 'Tilgjengelig i hele Norge'
    END AS match_reason,
    ls.address,
    ls.phone,
    ls.email,
    ls.website,
    ls.orgnr,
    ST_Y(ls.base_location::geometry)::double precision AS lat,
    ST_X(ls.base_location::geometry)::double precision AS lon,
    ls.cover_image_url,
    ls.logo_image_url,
    ls.provider_type
  FROM limited_services ls;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION search_services(
  text, double precision, double precision,
  text, text, text, text, text, text,
  integer, text, text, text, text[], double precision, int
) TO anon, authenticated;
