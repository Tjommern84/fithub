-- ============================================
-- "Søk her i stedet" + tag-filter-fiks
--
-- search_services_unanchored() (Tier 3) støttet ikke tag-filtrering — et søk
-- som "Drammen" i Sport-kategorien med Ishockey-tag huket av ga uriktige treff
-- fra ALLE sporter når søket falt gjennom til Tier 3. Legger til p_tags på
-- samme funksjon, med eksakt samme (allerede fiksede) kropp som
-- sql/24_search_fallback_tiers.sql — IKKE den opprinnelige similarity()/%-
-- versjonen, se CLAUDE.md-gotcha om word_similarity() vs similarity().
-- ============================================

-- Obligatorisk DROP med EKSAKT gammel signatur FØR CREATE OR REPLACE — samme
-- gotcha som forrige incident (sql/23_fix_search_services_overload.sql).
-- Uten denne sameksisterer gammel (4 param) og ny (5 param) som to overloads.
DROP FUNCTION IF EXISTS search_services_unanchored(text, double precision, double precision, int);

CREATE OR REPLACE FUNCTION search_services_unanchored(
  p_query text,
  p_lat   double precision DEFAULT NULL,
  p_lon   double precision DEFAULT NULL,
  p_tags  text[]           DEFAULT NULL,
  p_limit int              DEFAULT 20
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
    AND (p_tags IS NULL OR s.tags && p_tags)
  ORDER BY similarity_score DESC, distance_km ASC NULLS LAST
  LIMIT max_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Ny signatur (p_tags lagt til FØR p_limit) — JS-kallet i lib/matchingDb.ts
-- bruker navngitte parametre, ikke posisjonelle, så rekkefølgen er trygg.
GRANT EXECUTE ON FUNCTION search_services_unanchored(
  text, double precision, double precision, text[], int
) TO anon, authenticated;
