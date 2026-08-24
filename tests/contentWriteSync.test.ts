import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../sql/46_content_write_sync.sql', import.meta.url),
  'utf8',
);

test('installs automatic synchronization for every services content write path', () => {
  const triggerNames = [
    'trg_services_content_sync_insert',
    'trg_services_content_sync_update',
    'trg_services_content_sync_delete',
    'trg_service_types_content_sync',
    'trg_service_categories_content_sync',
  ];

  for (const triggerName of triggerNames) {
    assert.match(migration, new RegExp(`CREATE TRIGGER ${triggerName}\\b`));
  }
  assert.match(migration, /CREATE OR REPLACE FUNCTION sync_service_content\(p_service_id text\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION get_content_sync_health\(\)/);
});

test('keeps manual links outside automatic replacement on migration reruns', () => {
  assert.match(migration, /column_name = 'sync_managed'/);
  assert.match(migration, /sync_managed = false/);
  assert.match(migration, /DELETE FROM offering_categories[\s\S]+sync_managed = true/);
  assert.match(migration, /DELETE FROM offering_venues[\s\S]+sync_managed = true/);
  assert.match(migration, /Content sync self-test removed a manual category/);
  assert.match(migration, /Content sync self-test removed a manual venue link/);
});

test('contains a transactional write lifecycle self-test and restricted operations access', () => {
  assert.match(migration, /^BEGIN;/m);
  assert.match(migration, /Content sync self-test did not create the entity graph/);
  assert.match(migration, /Content sync self-test did not propagate service update/);
  assert.match(migration, /Content sync self-test did not propagate service type/);
  assert.match(migration, /Content sync self-test did not clean up offering/);
  assert.match(migration, /Content sync self-test left orphaned entity data/);
  assert.match(migration, /Content sync self-test did not record deletion state/);
  assert.match(migration, /REVOKE ALL ON FUNCTION get_content_sync_health\(\) FROM PUBLIC/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION get_content_sync_health\(\) TO service_role/);
  assert.match(migration, /COMMIT;\s*$/);
});
