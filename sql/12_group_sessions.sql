-- ============================================================
-- FitHub – Brukeropprettede gruppeøkter
-- Kjør i Supabase SQL Editor
-- ============================================================

-- ── 1. Profil-utvidelser ──────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_pro boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pro_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- ── 2. group_sessions ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_sessions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  title               text        NOT NULL,
  description         text,
  session_type        text        NOT NULL,   -- 'løpegruppe', 'gågruppe', 'bootcamp', etc.
  tags                text[]      NOT NULL DEFAULT '{}',

  address             text,
  city                text,
  location_notes      text,
  lat                 double precision,
  lon                 double precision,

  is_free             boolean     NOT NULL DEFAULT true,
  price               numeric(8,2),
  payment_info        text,

  starts_at           timestamptz NOT NULL,
  duration_minutes    int,

  -- 'weekly' | 'biweekly' | 'monthly' | NULL (one-time)
  recurrence_type     text        CHECK (recurrence_type IN ('weekly','biweekly','monthly')),
  recurrence_ends_at  timestamptz,

  max_participants    int,
  status              text        NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('active','cancelled','completed')),
  is_active           boolean     NOT NULL DEFAULT true,

  main_category       text        NOT NULL DEFAULT 'trene-sammen',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Auto-oppdater updated_at ved endringer
CREATE OR REPLACE FUNCTION update_group_sessions_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_group_sessions_updated_at ON group_sessions;
CREATE TRIGGER tg_group_sessions_updated_at
  BEFORE UPDATE ON group_sessions
  FOR EACH ROW EXECUTE FUNCTION update_group_sessions_updated_at();

-- ── 3. session_participants ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS session_participants (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid        NOT NULL REFERENCES group_sessions(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status      text        NOT NULL DEFAULT 'confirmed'
                          CHECK (status IN ('confirmed','waitlist','cancelled')),
  joined_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id)
);

-- ── 4. RLS: group_sessions ────────────────────────────────────────────────────

ALTER TABLE group_sessions ENABLE ROW LEVEL SECURITY;

-- Alle kan lese aktive arrangementer
DROP POLICY IF EXISTS "gs_select_active" ON group_sessions;
CREATE POLICY "gs_select_active" ON group_sessions
  FOR SELECT USING (is_active = true);

-- Creator kan alltid lese egne (inkl. inaktive)
DROP POLICY IF EXISTS "gs_select_own" ON group_sessions;
CREATE POLICY "gs_select_own" ON group_sessions
  FOR SELECT USING (auth.uid() = creator_user_id);

-- Kun innlogget bruker med verifisert telefon kan opprette
DROP POLICY IF EXISTS "gs_insert_verified" ON group_sessions;
CREATE POLICY "gs_insert_verified" ON group_sessions
  FOR INSERT WITH CHECK (
    auth.uid() = creator_user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND phone_verified_at IS NOT NULL
    )
  );

-- Kun creator kan redigere og slette
DROP POLICY IF EXISTS "gs_update_own" ON group_sessions;
CREATE POLICY "gs_update_own" ON group_sessions
  FOR UPDATE USING (auth.uid() = creator_user_id);

DROP POLICY IF EXISTS "gs_delete_own" ON group_sessions;
CREATE POLICY "gs_delete_own" ON group_sessions
  FOR DELETE USING (auth.uid() = creator_user_id);

-- ── 5. RLS: session_participants ──────────────────────────────────────────────

ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sp_select_all" ON session_participants;
CREATE POLICY "sp_select_all" ON session_participants
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "sp_insert_own" ON session_participants;
CREATE POLICY "sp_insert_own" ON session_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "sp_delete_own" ON session_participants;
CREATE POLICY "sp_delete_own" ON session_participants
  FOR DELETE USING (auth.uid() = user_id);

-- ── 6. Indekser ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_gs_city         ON group_sessions(city);
CREATE INDEX IF NOT EXISTS idx_gs_starts_at    ON group_sessions(starts_at);
CREATE INDEX IF NOT EXISTS idx_gs_creator      ON group_sessions(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_gs_main_cat     ON group_sessions(main_category);
CREATE INDEX IF NOT EXISTS idx_gs_status       ON group_sessions(status, is_active);
CREATE INDEX IF NOT EXISTS idx_gs_lat_lon      ON group_sessions(lat, lon)
  WHERE lat IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sp_session_id   ON session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_sp_user_id      ON session_participants(user_id);

-- ── 7. Rettigheter ────────────────────────────────────────────────────────────

GRANT SELECT ON group_sessions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON group_sessions TO authenticated;
GRANT SELECT ON session_participants TO anon, authenticated;
GRANT INSERT, DELETE ON session_participants TO authenticated;
