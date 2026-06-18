-- ============================================
-- Søk-fallback-kjede: Tier 2 (rekoordinert søk) + Tier 3 (unanchored søk)
--
-- Denne migrasjonen endrer IKKE search_services(). Se
-- sql/23_fix_search_services_overload.sql for siste korrekte versjon av den
-- funksjonen — skal ikke endres her.
-- ============================================

-- ── Seksjon A: trigger-utvidelse — søk skal også matche by/adresse ─────────
-- search_text inkluderer nå city + address (i tillegg til name/description/tags),
-- slik at f.eks. "yoga drammen" kan finne treff via byen i søketeksten.

CREATE OR REPLACE FUNCTION public.services_set_search_text()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_text :=
    lower(
      coalesce(NEW.name, '') || ' ' ||
      coalesce(NEW.description, '') || ' ' ||
      coalesce(array_to_string(NEW.tags, ' '), '') || ' ' ||
      coalesce(NEW.city, '') || ' ' ||
      coalesce(NEW.address, '')
    );
  RETURN NEW;
END;
$$;

-- Trigger må også fyre ved endring av city/address, ikke bare name/description/tags
-- (samme prinsipp som funksjonskroppen utvides for — uten dette ville en isolert
-- adresseoppdatering ikke reindeksere search_text).
DROP TRIGGER IF EXISTS trg_services_set_search_text ON services;

CREATE TRIGGER trg_services_set_search_text
BEFORE INSERT OR UPDATE OF name, description, tags, city, address ON services
FOR EACH ROW EXECUTE FUNCTION services_set_search_text();

-- ── Seksjon B: engangs-backfill ──────────────────────────────────────────────
-- Nødvendig fordi triggeren over kun kjører på fremtidige INSERT/UPDATE —
-- eksisterende rader må reindekseres manuelt én gang (samme mønster som sql/11).

UPDATE services SET search_text =
  lower(
    coalesce(name, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    coalesce(array_to_string(tags, ' '), '') || ' ' ||
    coalesce(city, '') || ' ' ||
    coalesce(address, '')
  );

-- ── Seksjon C: search_services_unanchored() — Tier 3, helt frittstående ────
-- Ingen dekningssemantikk (service_coverage berøres ikke) — finner treff på
-- fritekst uavhengig av om tjenesten dekker brukerens lokasjon. Brukes kun når
-- search_services() (Tier 1) og rekoordinert søk (Tier 2) begge gir 0 treff.

-- Obligatorisk DROP FØR CREATE OR REPLACE — se CLAUDE.md-gotcha om forrige
-- incident (sql/23_fix_search_services_overload.sql): uten denne linjen
-- risikerer man en duplikat-overload hvis funksjonen tidligere er opprettet
-- med en annen signatur.
--
-- Bruker word_similarity()/<% (ikke similarity()/% som search_services()) —
-- similarity() sammenligner trigram-sett for HELE begge strenger og straffer
-- lengdeforskjell hardt. Et kort søkeord som "yoga" mot en lang sammensatt
-- search_text (navn+beskrivelse+tags+by+adresse) scorer da typisk 0.14-0.16,
-- godt under standard threshold 0.3 — ekte treff blir filtrert bort. Verifisert
-- empirisk mot prod-data 2026-06-18. word_similarity() måler likhet mot beste
-- SUBSTRENG i target, riktig semantikk for "finn dette ordet et sted i teksten".
DROP FUNCTION IF EXISTS search_services_unanchored(text, double precision, double precision, int);

CREATE OR REPLACE FUNCTION search_services_unanchored(
  p_query text,
  p_lat   double precision DEFAULT NULL,
  p_lon   double precision DEFAULT NULL,
  p_limit int DEFAULT 20
) RETURNS TABLE (
  service_id text,
  name text,
  type text,
  description text,
  city text,
  address text,
  tags text[],
  rating_avg numeric,
  rating_count int,
  price_level text,
  website text,
  phone text,
  email text,
  orgnr text,
  cover_image_url text,
  logo_image_url text,
  lat double precision,
  lon double precision,
  distance_km numeric,
  similarity_score numeric
) AS $$
#variable_conflict use_column
DECLARE
  user_point geography;
  normalized_query text;
  max_limit int := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
BEGIN
  IF p_query IS NULL OR trim(p_query) = '' THEN
    RETURN;
  END IF;
  normalized_query := lower(trim(p_query));

  IF p_lat IS NOT NULL AND p_lon IS NOT NULL THEN
    user_point := ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326);
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.type,
    s.description,
    s.city,
    s.address,
    s.tags,
    s.rating_avg,
    s.rating_count,
    s.price_level,
    s.website,
    s.phone,
    s.email,
    s.orgnr,
    s.cover_image_url,
    s.logo_image_url,
    ST_Y(s.base_location::geometry)::double precision AS lat,
    ST_X(s.base_location::geometry)::double precision AS lon,
    CASE
      WHEN user_point IS NOT NULL AND s.base_location IS NOT NULL
        THEN (ST_Distance(s.base_location, user_point) / 1000)::numeric
      ELSE NULL
    END AS distance_km,
    word_similarity(normalized_query, s.search_text)::numeric AS similarity_score
  FROM services s
  WHERE s.is_active = true
    AND normalized_query <% s.search_text
  ORDER BY similarity_score DESC, distance_km ASC NULLS LAST
  LIMIT max_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION search_services_unanchored(
  text, double precision, double precision, int
) TO anon, authenticated;
