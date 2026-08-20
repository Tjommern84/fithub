import assert from 'node:assert/strict';
import test from 'node:test';
import { getSafeAdminPath, getSafeInternalPath } from '../lib/safeRedirect';

test('accepts local paths and preserves query parameters', () => {
  assert.equal(getSafeInternalPath('/resultater?q=styrke'), '/resultater?q=styrke');
  assert.equal(getSafeAdminPath('/admin/brreg?page=2'), '/admin/brreg?page=2');
});

test('rejects external, protocol-relative and backslash redirects', () => {
  assert.equal(getSafeInternalPath('https://evil.example'), '/');
  assert.equal(getSafeInternalPath('//evil.example'), '/');
  assert.equal(getSafeInternalPath('/\\evil.example'), '/');
  assert.equal(getSafeAdminPath('/resultater'), '/admin');
});
