-- ============================================
-- get_nearest_trails() — bruk representative endepunkter, ikke hele linjen
--
-- SYMPTOM: get_nearest_trails() timer ut (samme 57014 som search_services()
-- hadde før sql/32-34) på 163 781 rader LineString-geometri.
--
-- ROTÅRSAK (strukturelt ulik search_services()-saken — IKKE manglende indeks):
-- trails.geom HAR allerede en GIST-indeks (trails_geom_idx, sql/22_trails.sql).
-- Problemet er at ST_Distance/ST_DWithin mot en hel LINJE er vesentlig dyrere
-- per rad enn punkt-til-punkt: PostGIS må finne det NÆRMESTE punktet langs
-- hele linjens geometri til brukerens posisjon, ikke bare regne avstanden
-- mellom to punkter. For en lang sti (flere km, mange vertekser) er dette en
-- ikke-trivial beregning, og ORDER BY ST_Distance(...) tvinger denne
-- beregningen for samtlige rader som passerer bounding-box-filteret før
-- sortering kan skje.
--
-- FIX: sammenligne mot stiens REPRESENTATIVE punkter (start + slutt) i stedet
-- for hele linjen. Implementert som ST_Collect(ST_StartPoint(...),
-- ST_EndPoint(...)) — en 2-punkts MultiPoint-geometri. ST_DWithin/ST_Distance
-- mot en MultiPoint regner automatisk MINSTE avstand til ETT AV punktene, så
-- "nær start ELLER nær slutt"løses med ett enkelt uttrykk — bevisst valgt
-- over en OR/UNION ALL av to separate betingelser, nettopp for å unngå å
-- gjenskape samme klasse problem som søk-timeout-saken (en disjunksjon over
-- flere indekserbare betingelser kan hindre planleggeren i å bruke noen av
-- dem effektivt — se gotcha i CLAUDE.md). Med ett samlet uttrykk er det kun
-- ÉN betingelse å indeksere og slå opp.
--
-- Ny funksjonell GIST-indeks på nettopp dette uttrykket — den eksisterende
-- trails_geom_idx (bygget på rå `geom`, hele linjen) kan IKKE brukes for et
-- annet uttrykk enn det den faktisk er bygget på, uavhengig av at dataene
-- stammer fra samme kolonne. Indeksen må matche uttrykket i spørringen
-- strukturelt for at planleggeren skal kunne bruke den.
--
-- Avgrensning: dette finner ruter der BRUKEREN er nær et av endepunktene –
-- ikke der brukeren er nær et MIDTPUNKT på en rundtur/lang strekning langt
-- fra start/slutt. Se egen undersøkelse i handoff.md ("kryss-punkter") for et
-- mulig fremtidig tillegg som adresserer det — IKKE implementert her, kun
-- rapportert som funn.
--
-- Kan ikke verifiseres med EXPLAIN ANALYZE av meg (ingen direkte DB-tilgang,
-- se CLAUDE.md). Be bruker køre EXPLAIN ANALYZE SELECT * FROM
-- get_nearest_trails(59.9139, 10.7522, 30, 20); og bekrefte at planen viser
-- en Index Scan mot trails_endpoints_idx, ikke en sekvensiell skanning.
-- ============================================

CREATE INDEX IF NOT EXISTS trails_endpoints_idx
  ON trails
  USING GIST ((
    ST_Collect(ST_StartPoint(geom::geometry), ST_EndPoint(geom::geometry))::geography
  ));

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
      ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
    ) / 1000 AS distance_km
  FROM trails t
  WHERE t.name IS NOT NULL
    AND ST_DWithin(
      ST_Collect(ST_StartPoint(t.geom::geometry), ST_EndPoint(t.geom::geometry))::geography,
      ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
      p_radius_km * 1000
    )
  ORDER BY distance_km
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_nearest_trails(
  double precision, double precision, double precision, int
) TO anon, authenticated;
