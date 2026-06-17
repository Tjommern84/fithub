-- Migration 19: Fjern public read fra cache-tabeller
--
-- service_cache og search_cache leses kun server-side via service_role.
-- Ingen anon-tilgang er nødvendig, og public read inviterer til direkte
-- Supabase REST API-misbruk fra bots.

-- SEARCH_CACHE: kun service_role
DROP POLICY IF EXISTS search_cache_public_select      ON search_cache;
DROP POLICY IF EXISTS search_cache_service_role_write ON search_cache;

CREATE POLICY search_cache_service_role_all
  ON search_cache FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- SERVICE_CACHE: kun service_role
DROP POLICY IF EXISTS service_cache_public_select      ON service_cache;
DROP POLICY IF EXISTS service_cache_service_role_write ON service_cache;

CREATE POLICY service_cache_service_role_all
  ON service_cache FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
