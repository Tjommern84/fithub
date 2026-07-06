-- ============================================
-- FIX 2: search_services() statement timeout (57014) — strukturell årsak
--
-- sql/32_fix_search_timeout.sql la til en GIST-indeks på services.base_location.
-- Bekreftet av bruker (2026-06-22) at indeksen ALENE IKKE løste timeouten — samme
-- repro-kall (p_city=null, p_lat/p_lon=Oslo, sort='nearest', p_radius_km=30) ga
-- fortsatt 57014 etter ~3.9-8.4s ved gjentatt testing.
--
-- ROTÅRSAK (strukturell, ikke mangel på indeks i seg selv):
-- matched_coverage-CTE-en bruker ÉN SELECT med et WHERE-uttrykk formet som
-- (A OR B OR C OR D), der A/B/C/D er fire helt forskjellige betingelsestyper
-- (radius-avstand, by-navn-match, by-avstand-match, region-tekstmatch) over en
-- LEFT JOIN mellom service_coverage og services. Postgres sin planlegger kan
-- IKKE pushe en spatial indeksbetingelse (ST_DWithin mot et GIST-indeksert
-- punkt) ned i en effektiv index scan når den sitter som ett av flere ledd i
-- en stor disjunksjon sammen med urelaterte betingelser over andre kolonner —
-- selv med riktig indeks tilgjengelig og oppdaterte statistikker, faller
-- planleggeren typisk tilbake til å evaluere HELE den joinede radmengden
-- sekvensielt og filtrere etterpå. Dette er et kjent, dokumentert
-- PostgreSQL/PostGIS-mønster: "OR over flere indekserbare betingelser på tvers
-- av tabeller hindrer indeksbruk", ikke spesifikt et søk-skjema-problem.
--
-- Konkret i prod (uendret siden sql/32, reverifisert nå): service_coverage
-- har 33 886 rader (type='radius': 0, type='city': 23 354, type='region':
-- 10 532) mot 32 401 services-rader. Når p_city er NULL (vanlig for et rent
-- "nærmeste meg"-søk uten valgt by), bortfaller by-navn-grenen (B) helt, og
-- ALLE 23 354 type='city'-radene må evalueres via den ujournalførte
-- ST_DWithin-grenen (C) — nettopp grenen GIST-indeksen i sql/32 skulle
-- akselerere, men som OR-strukturen hindrer planleggeren i å faktisk bruke.
--
-- FIX: skriv om matched_coverage til en UNION ALL av fire separate, isolerte
-- sub-SELECT-er — én per opprinnelig OR-gren — med DISTINCT ON anvendt på det
-- sammenslåtte resultatet i stedet for inni hver gren. Hver gren har nå et
-- WHERE-uttrykk med KUN sine egne betingelser, uten urelaterte disjunkter i
-- veien, slik at planleggeren fritt kan velge indeks scan per gren uavhengig
-- (radius_center-GIST for gren A, base_location-GIST for gren C). Resultatet
-- er identisk med før: en rad som tilfredsstiller flere grener samtidig
-- (mulig for en service_coverage-rad som matcher BÅDE by-navn og by-avstand)
-- dukker opp flere ganger i UNION ALL-mellomresultatet, men DISTINCT ON
-- (service_id, ordnet på samme coverage_rank+avstand-prioritet som før)
-- kollapser dette til nøyaktig samme endelige rad som den opprinnelige
-- enkelt-SELECT-en ville gitt. Ingen endring i hvilke tjenester som matcher,
-- kun i hvordan planleggeren får lov til å finne dem.
--
-- Input-parameterliste og RETURNS TABLE er UENDRET fra sql/30 (provider_type
-- + reported_at-filteret er begge med, uberørt). DROP+CREATE kjøres likevel
-- som forsiktighetsregel siden hele funksjonskroppen erstattes.
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

    -- Gren C: by-avstand-fallback (proximity). DEN FAKTISKE HOT PATH-en for
    -- "nærmeste meg"-søk uten valgt by (p_city=NULL) — 23 354 rader i prod.
    -- Isolert egen SELECT med KUN denne betingelsen lar planleggeren bruke
    -- GIST-indeksen på services.base_location (sql/32) fritt, uten en
    -- urelatert disjunksjon i veien.
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
  )
  SELECT
    rs.id,
    rs.name,
    rs.type,
    rs.description,
    rs.coverage,
    rs.price_level,
    rs.rating_avg,
    rs.rating_count,
    rs.tags,
    rs.goals,
    rs.venues,
    rs.is_active,
    rs.distance_km::numeric,
    (
      (CASE WHEN goal_match THEN 4 ELSE 0 END)
      + (CASE WHEN type_match THEN 3 ELSE 0 END)
      + (CASE WHEN budget_match THEN 2 ELSE 0 END)
      + (CASE WHEN venue_match THEN 2 ELSE 0 END)
      + rating_score
      + distance_score
      + (CASE WHEN rs.query_similarity > 0 THEN rs.query_similarity * 4 ELSE 0 END)
    )::numeric(12,4) AS score,
    (
      SELECT array_agg(reason)
      FROM (
        SELECT reason FROM (
          SELECT unnest(ARRAY[
            CASE WHEN goal_match THEN 'Mål match' ELSE NULL END,
            CASE WHEN type_match THEN 'Type match' ELSE NULL END,
            CASE WHEN budget_match THEN 'Budsjett match' ELSE NULL END,
            CASE WHEN venue_match THEN 'Passer ' || venue_label ELSE NULL END,
            CASE WHEN rating_score > 0 THEN 'God rating' ELSE NULL END,
            CASE WHEN distance_score > 0 THEN 'Nær deg' ELSE NULL END,
            CASE WHEN rs.query_similarity > 0 THEN 'Treff på søk' ELSE NULL END
          ]) AS reason
        ) AS populated WHERE reason IS NOT NULL LIMIT 4
      ) AS reason_list
    ) AS reasons,
    CASE
      WHEN rs.coverage_type = 'radius' THEN 'Innenfor ' || rs.radius_km::text || ' km'
      WHEN rs.coverage_type = 'city' THEN 'Dekker ' || rs.coverage_city
      WHEN lower(rs.coverage_region) = 'nordic' THEN 'Tilgjengelig i hele Norden'
      ELSE 'Tilgjengelig i hele Norge'
    END AS match_reason,
    rs.address,
    rs.phone,
    rs.email,
    rs.website,
    rs.orgnr,
    ST_Y(rs.base_location::geometry)::double precision AS lat,
    ST_X(rs.base_location::geometry)::double precision AS lon,
    rs.cover_image_url,
    rs.logo_image_url,
    rs.provider_type
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
  ORDER BY
    CASE sort_mode
      WHEN 'nearest' THEN COALESCE(rs.distance_km, 99999)
      WHEN 'rating' THEN -rs.rating_avg
      WHEN 'price_low' THEN CASE rs.price_level WHEN 'low' THEN 1 WHEN 'medium' THEN 2 WHEN 'high' THEN 3 ELSE 4 END
      WHEN 'price_high' THEN CASE rs.price_level WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END * -1
      ELSE -(
        (CASE WHEN rs.goal_match THEN 4 ELSE 0 END)
        + (CASE WHEN rs.type_match THEN 3 ELSE 0 END)
        + (CASE WHEN rs.budget_match THEN 2 ELSE 0 END)
        + (CASE WHEN rs.venue_match THEN 2 ELSE 0 END)
        + rs.rating_score + rs.distance_score
        + (CASE WHEN rs.query_similarity > 0 THEN rs.query_similarity * 4 ELSE 0 END)
      )
    END,
    CASE sort_mode
      WHEN 'nearest' THEN -rs.rating_avg WHEN 'rating' THEN -rs.rating_count ELSE -rs.rating_avg
    END
  LIMIT max_limit OFFSET COALESCE(p_offset, 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION search_services(
  text, double precision, double precision,
  text, text, text, text, text, text,
  integer, text, text, text, text[], double precision, int
) TO anon, authenticated;

-- Oppdater planleggerstatistikk for begge involverte tabeller — kostnadsfritt,
-- og adresserer bruker sin første hypotese (manglende ANALYZE etter sql/32 sin
-- CREATE INDEX). Løser etter all sannsynlighet IKKE problemet alene (se
-- forklaring ovenfor om strukturell OR-årsak), men er en reell, billig
-- medvirkende faktor og bør kjøres uansett.
ANALYZE services;
ANALYZE service_coverage;
