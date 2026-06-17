-- Admin allowlist for fithub.no.
-- Run after sql/00_schema.sql and sql/02_rls.sql.

CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  email text NOT NULL UNIQUE,
  phone_e164 text,
  active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_user_id_unique
  ON admin_users (user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_phone_e164_unique
  ON admin_users (phone_e164)
  WHERE phone_e164 IS NOT NULL;

CREATE OR REPLACE FUNCTION update_admin_users_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_admin_users_updated_at ON admin_users;
CREATE TRIGGER tg_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION update_admin_users_updated_at();

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_users_service_role_all ON admin_users;
CREATE POLICY admin_users_service_role_all
  ON admin_users
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Bootstrap example:
-- INSERT INTO admin_users (user_id, email, phone_e164)
-- VALUES ('<auth-user-id>', 'admin@fithub.no', '+4712345678');
