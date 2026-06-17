-- Make consent writes idempotent and readable by the owning user.
-- Run after sql/00_schema.sql.

DELETE FROM user_consents
WHERE ctid IN (
  SELECT ctid
  FROM (
    SELECT
      ctid,
      row_number() OVER (
        PARTITION BY user_id, consent_type
        ORDER BY accepted_at DESC, id DESC
      ) AS row_number
    FROM user_consents
  ) duplicates
  WHERE duplicates.row_number > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS user_consents_user_type_unique
  ON user_consents (user_id, consent_type);

ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_consents_owner_select ON user_consents;
CREATE POLICY user_consents_owner_select
  ON user_consents
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_consents_owner_insert ON user_consents;
CREATE POLICY user_consents_owner_insert
  ON user_consents
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_consents_owner_update ON user_consents;
CREATE POLICY user_consents_owner_update
  ON user_consents
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_consents_service_role_all ON user_consents;
CREATE POLICY user_consents_service_role_all
  ON user_consents
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
