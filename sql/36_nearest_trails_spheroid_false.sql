-- ============================================
-- get_nearest_trails() — fortsatt treg etter sql/35 (endepunkt-optimalisering)
--
-- EKTE EXPLAIN ANALYZE (innhentet av bruker, 2026-06-22): "Index Scan using
-- trails_endpoints_idx" returnerer 15 056 kandidatrader etter bbox-filter
-- (19 159 vurdert totalt: 15 056 beholdt + 4 103 fjernet). 2140ms av 2147ms
-- totalt går til å beregne EKSAKT ST_Distance/ST_DWithin på ::geography for
-- disse radene. Konklusjon: indeksbruken fra sql/35 er korrekt og fungerer
-- som tiltenkt — flaskehalsen er nå selve VOLUMET av eksakte geodetiske
-- avstandsberegninger, ikke kandidat-utvelgelsen.
--
-- VALGT FIKS (avveid mot to alternativer, ikke valgt blindt):
--
-- Alternativ 1 (foreslått i oppgaven): bytt til ::geometry + grad-basert
-- radius (p_radius_km / 111.0). Forkastet som PRIMÆRVALG: grader bredde-
-- og lengdegrad er IKKE samme fysiske avstand utenfor ekvator — ved Oslos
-- breddegrad (~60°N) dekker 1° lengdegrad bare ~55 km (cos(60°)≈0,5) mot
-- 1° breddegrad sine ~111 km. En enkelt grad-faktor brukt i begge retninger
-- gir et sirkel-søk som i praksis blir en ellipse strukket nord-sør —
-- forskjellen er størst nettopp i Norge pga. høy breddegrad, som oppgaven
-- selv påpekte. Akseptabelt for en "i nærheten"-funksjon, men unødvendig når
-- et bedre alternativ finnes (se under).
--
-- Alternativ 2 (valgt): bruk geography fortsatt (ingen breddegrad-forvridning,
-- riktig meter-avstand uansett breddegrad), men med use_spheroid=false på
-- BÅDE ST_Distance og ST_DWithin. Dette er en offisielt dokumentert PostGIS-
-- mekanisme nettopp for denne avveiningen: standard (use_spheroid=true)
-- bruker en iterativ ellipsoide geodesic-algoritme (presis, men tregere);
-- use_spheroid=false bruker en enklere sfærisk (storsirkel) beregning —
-- vesentlig billigere å beregne, fortsatt i ekte meter, fortsatt korrekt
-- uavhengig av breddegrad. Presisjonstapet (sfære vs. ellipsoide) er typisk
-- under 0,5 % avvik — irrelevant for en "i nærheten"-forslagsfunksjon med
-- 1-30 km radius. Krever INGEN ny indeks — GIST-indeksen fra sql/35
-- (trails_endpoints_idx) brukes identisk for kandidat-utvelgelse uansett
-- hvilken use_spheroid-verdi som brukes i selve avstandsberegningen for de
-- utvalgte kandidatene; det er KUN beregningsmetoden for eksakt avstand på
-- allerede-filtrerte rader som endres, ikke hvordan indeksen brukes.
--
-- IKKE empirisk verifisert av meg (ingen EXPLAIN ANALYZE-tilgang, se
-- CLAUDE.md) — valget er begrunnet i PostGIS sin dokumenterte oppførsel,
-- ikke målt selv. Hvis dette IKKE er tilstrekkelig, er alternativ 1 (grad-
-- basert geometry) en reservefiks — se utkommentert variant nederst i filen.
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
      ST_Collect(ST_StartPoint(t.geom::geometry), ST_EndPoint(t.geom::geometry))::geography,
      ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
      false  -- use_spheroid=false: sfærisk i stedet for ellipsoide beregning, vesentlig billigere
    ) / 1000 AS distance_km
  FROM trails t
  WHERE t.name IS NOT NULL
    AND ST_DWithin(
      ST_Collect(ST_StartPoint(t.geom::geometry), ST_EndPoint(t.geom::geometry))::geography,
      ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
      p_radius_km * 1000,
      false  -- samme use_spheroid=false her, for konsistens mellom filter og sortering
    )
  ORDER BY distance_km
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_nearest_trails(
  double precision, double precision, double precision, int
) TO anon, authenticated;

-- ============================================
-- RESERVEFIKS (kun hvis use_spheroid=false over IKKE er nok — be bruker
-- bekrefte med EXPLAIN ANALYZE først). Bytt til ::geometry + grad-radius.
-- Fjern kommentarmerkingen og kjør denne CREATE OR REPLACE i stedet hvis
-- nødvendig — krever ALSO en ny indeks på ::geometry (geography-indeksen fra
-- sql/35 er ikke gjenbrukbar for et geometry-uttrykk).
-- ============================================

-- CREATE INDEX IF NOT EXISTS trails_endpoints_geom_idx
--   ON trails
--   USING GIST ((ST_Collect(ST_StartPoint(geom::geometry), ST_EndPoint(geom::geometry))));
--
-- CREATE OR REPLACE FUNCTION get_nearest_trails(
--   p_lat        double precision,
--   p_lon        double precision,
--   p_radius_km  double precision,
--   p_limit      int DEFAULT 20
-- ) RETURNS TABLE (
--   id text,
--   name text,
--   trail_type text,
--   length_km numeric,
--   distance_km double precision
-- ) AS $$
--   SELECT
--     t.id::text,
--     t.name,
--     t.trail_type,
--     t.length_km,
--     ST_Distance(
--       ST_Collect(ST_StartPoint(t.geom::geometry), ST_EndPoint(t.geom::geometry)),
--       ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)
--     ) * 111.0 AS distance_km  -- grov grad->km, kun for ORDER BY/visning
--   FROM trails t
--   WHERE t.name IS NOT NULL
--     AND ST_DWithin(
--       ST_Collect(ST_StartPoint(t.geom::geometry), ST_EndPoint(t.geom::geometry)),
--       ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326),
--       p_radius_km / 111.0
--     )
--   ORDER BY distance_km
--   LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
-- $$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
