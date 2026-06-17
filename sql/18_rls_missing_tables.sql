-- ============================================================
-- Migration 18: RLS for remaining unsecured public tables
--
-- Tables covered:
--   organization_members, organization_lead_stats, events,
--   provider_invites, notification_preferences, email_events,
--   deletion_requests, locations, search_cache, service_cache,
--   service_categories, categories
--
-- NOTE: Does NOT touch public.spatial_ref_sys (PostGIS-owned).
-- Run AFTER 00_schema.sql and 02_rls.sql.
-- ============================================================

-- ============================================================
-- HELPER FUNCTION: is_org_admin(org_id)
--
-- SECURITY DEFINER is required to avoid infinite recursion:
-- policies on organization_members call this function, which
-- in turn reads organization_members — DEFINER bypasses RLS
-- on that inner read so we don't loop back into the policy.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND role = 'admin'
  );
$$;

-- ============================================================
-- ORGANIZATION_MEMBERS
-- Members see only their own row; admins see all members
-- in their org and can manage them.
-- ============================================================
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_members_own_select         ON organization_members;
DROP POLICY IF EXISTS org_members_admin_select        ON organization_members;
DROP POLICY IF EXISTS org_members_admin_insert        ON organization_members;
DROP POLICY IF EXISTS org_members_admin_update        ON organization_members;
DROP POLICY IF EXISTS org_members_self_or_admin_delete ON organization_members;
DROP POLICY IF EXISTS org_members_service_role_all    ON organization_members;

-- Any member can read their own membership (e.g. to know their own role)
CREATE POLICY org_members_own_select
  ON organization_members FOR SELECT
  USING (user_id = auth.uid());

-- Org admins can see all members in their org
CREATE POLICY org_members_admin_select
  ON organization_members FOR SELECT
  USING (is_org_admin(organization_id));

-- Only org admins can add members (join-code flow handled by backend/service_role)
CREATE POLICY org_members_admin_insert
  ON organization_members FOR INSERT
  WITH CHECK (is_org_admin(organization_id));

-- Only org admins can change member roles
CREATE POLICY org_members_admin_update
  ON organization_members FOR UPDATE
  USING  (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

-- Org admins can remove anyone; members can remove themselves
CREATE POLICY org_members_self_or_admin_delete
  ON organization_members FOR DELETE
  USING (user_id = auth.uid() OR is_org_admin(organization_id));

CREATE POLICY org_members_service_role_all
  ON organization_members FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- ORGANIZATION_LEAD_STATS
-- Internal stats — only org admins (and backend) may read.
-- ============================================================
ALTER TABLE organization_lead_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_lead_stats_admin_select    ON organization_lead_stats;
DROP POLICY IF EXISTS org_lead_stats_service_role_all ON organization_lead_stats;

CREATE POLICY org_lead_stats_admin_select
  ON organization_lead_stats FOR SELECT
  USING (is_org_admin(organization_id));

CREATE POLICY org_lead_stats_service_role_all
  ON organization_lead_stats FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- EVENTS (analytics)
-- Users track their own events; service owners can see events
-- for their services; all writes are INSERT-only from clients.
-- ============================================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS events_user_insert        ON events;
DROP POLICY IF EXISTS events_user_select        ON events;
DROP POLICY IF EXISTS events_provider_select    ON events;
DROP POLICY IF EXISTS events_service_role_all   ON events;

-- Authenticated users may log events (user_id must match or be null for anon)
CREATE POLICY events_user_insert
  ON events FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (user_id IS NULL OR user_id = auth.uid())
  );

-- Users can read their own event history
CREATE POLICY events_user_select
  ON events FOR SELECT
  USING (user_id = auth.uid());

-- Service owners can read analytics events for their services
CREATE POLICY events_provider_select
  ON events FOR SELECT
  USING (
    service_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM services
      WHERE services.id = events.service_id
        AND services.owner_user_id = auth.uid()
    )
  );

CREATE POLICY events_service_role_all
  ON events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- PROVIDER_INVITES
-- Not public. Only the inviting service owner and backend
-- may read or manage invites. No email-based lookup from
-- client (token exchange handled server-side).
-- ============================================================
ALTER TABLE provider_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS provider_invites_creator_select       ON provider_invites;
DROP POLICY IF EXISTS provider_invites_service_owner_select ON provider_invites;
DROP POLICY IF EXISTS provider_invites_service_owner_insert ON provider_invites;
DROP POLICY IF EXISTS provider_invites_service_owner_delete ON provider_invites;
DROP POLICY IF EXISTS provider_invites_service_role_all     ON provider_invites;

-- Invite creator can see their own invites
CREATE POLICY provider_invites_creator_select
  ON provider_invites FOR SELECT
  USING (created_by = auth.uid());

-- Service owners can see all invites for their services
CREATE POLICY provider_invites_service_owner_select
  ON provider_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM services
      WHERE services.id = provider_invites.service_id
        AND services.owner_user_id = auth.uid()
    )
  );

-- Only service owners can create invites for their own services
CREATE POLICY provider_invites_service_owner_insert
  ON provider_invites FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM services
      WHERE services.id = provider_invites.service_id
        AND services.owner_user_id = auth.uid()
    )
  );

-- Service owners can revoke (delete) their own invites
CREATE POLICY provider_invites_service_owner_delete
  ON provider_invites FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM services
      WHERE services.id = provider_invites.service_id
        AND services.owner_user_id = auth.uid()
    )
  );

CREATE POLICY provider_invites_service_role_all
  ON provider_invites FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- NOTIFICATION_PREFERENCES
-- Strict owner-only: user_id = auth.uid().
-- ============================================================
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notif_prefs_owner_select       ON notification_preferences;
DROP POLICY IF EXISTS notif_prefs_owner_insert       ON notification_preferences;
DROP POLICY IF EXISTS notif_prefs_owner_update       ON notification_preferences;
DROP POLICY IF EXISTS notif_prefs_owner_delete       ON notification_preferences;
DROP POLICY IF EXISTS notif_prefs_service_role_all   ON notification_preferences;

CREATE POLICY notif_prefs_owner_select
  ON notification_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY notif_prefs_owner_insert
  ON notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY notif_prefs_owner_update
  ON notification_preferences FOR UPDATE
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY notif_prefs_owner_delete
  ON notification_preferences FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY notif_prefs_service_role_all
  ON notification_preferences FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- EMAIL_EVENTS
-- Internal email audit log — no frontend access whatsoever.
-- Only backend/service_role writes and reads this table.
-- ============================================================
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_events_service_role_all ON email_events;

CREATE POLICY email_events_service_role_all
  ON email_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- DELETION_REQUESTS (GDPR)
-- Users submit and view their own requests; status lifecycle
-- (pending → completed/cancelled) is handled by backend only.
-- ============================================================
ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deletion_requests_user_insert      ON deletion_requests;
DROP POLICY IF EXISTS deletion_requests_user_select      ON deletion_requests;
DROP POLICY IF EXISTS deletion_requests_service_role_all ON deletion_requests;

CREATE POLICY deletion_requests_user_insert
  ON deletion_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY deletion_requests_user_select
  ON deletion_requests FOR SELECT
  USING (user_id = auth.uid());

-- Backend handles UPDATE (status changes) and DELETE
CREATE POLICY deletion_requests_service_role_all
  ON deletion_requests FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- LOCATIONS (geocoding cache)
-- Contains place names + lat/lon only — no PII.
-- Public read is safe. All writes come from backend geocoder.
-- ============================================================
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS locations_public_select      ON locations;
DROP POLICY IF EXISTS locations_service_role_write ON locations;

CREATE POLICY locations_public_select
  ON locations FOR SELECT
  USING (true);

-- Backend (geocoder scripts) writes new entries via service_role
CREATE POLICY locations_service_role_write
  ON locations FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- SEARCH_CACHE
-- Cached search result payloads — no PII, safe to read.
-- Writes managed by backend only (no client cache poisoning).
-- ============================================================
ALTER TABLE search_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS search_cache_public_select      ON search_cache;
DROP POLICY IF EXISTS search_cache_service_role_write ON search_cache;

CREATE POLICY search_cache_public_select
  ON search_cache FOR SELECT
  USING (true);

CREATE POLICY search_cache_service_role_write
  ON search_cache FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- SERVICE_CACHE
-- Cached service payloads — derived from public services data,
-- no PII. Reads are public; writes are backend-only.
-- ============================================================
ALTER TABLE service_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_cache_public_select      ON service_cache;
DROP POLICY IF EXISTS service_cache_service_role_write ON service_cache;

CREATE POLICY service_cache_public_select
  ON service_cache FOR SELECT
  USING (true);

CREATE POLICY service_cache_service_role_write
  ON service_cache FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- CATEGORIES (reference data)
-- Public read — category names and descriptions.
-- Backend manages the category taxonomy.
-- ============================================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS categories_public_select      ON categories;
DROP POLICY IF EXISTS categories_service_role_write ON categories;

CREATE POLICY categories_public_select
  ON categories FOR SELECT
  USING (true);

CREATE POLICY categories_service_role_write
  ON categories FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- SERVICE_CATEGORIES (reference data — join table)
-- Public read. Only backend assigns services to categories.
-- ============================================================
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_categories_public_select      ON service_categories;
DROP POLICY IF EXISTS service_categories_service_role_write ON service_categories;

CREATE POLICY service_categories_public_select
  ON service_categories FOR SELECT
  USING (true);

CREATE POLICY service_categories_service_role_write
  ON service_categories FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- VERIFICATION
-- Run this after applying to confirm all tables are secured:
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'organization_members','organization_lead_stats','events',
--     'provider_invites','notification_preferences','email_events',
--     'deletion_requests','locations','search_cache','service_cache',
--     'service_categories','categories'
--   )
-- ORDER BY tablename;
-- ============================================================
