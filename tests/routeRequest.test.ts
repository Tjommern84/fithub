import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRouteRequest } from '../lib/routeRequest';

test('rejects a request without user coordinates', () => {
  const result = parseRouteRequest(new URLSearchParams({ dest_id: 'destination-1' }));
  assert.deepEqual(result, { ok: false, error: 'Mangler user_lat' });
});

test('accepts a destination id and defaults to walking', () => {
  const result = parseRouteRequest(new URLSearchParams({
    dest_id: 'destination-1',
    user_lat: '59.91',
    user_lon: '10.75',
  }));

  assert.deepEqual(result, {
    ok: true,
    value: {
      userLat: 59.91,
      userLon: 10.75,
      profile: 'foot-walking',
      destination: { kind: 'id', id: 'destination-1' },
    },
  });
});

test('accepts a coordinate destination for map-selected goals', () => {
  const result = parseRouteRequest(new URLSearchParams({
    user_lat: '59.91',
    user_lon: '10.75',
    dest_lat: '59.93',
    dest_lon: '10.70',
    profile: 'cycling-regular',
  }));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value.destination, {
    kind: 'coordinates',
    lat: 59.93,
    lon: 10.70,
  });
  assert.equal(result.value.profile, 'cycling-regular');
});

test('rejects invalid coordinate ranges and profiles', () => {
  const badLatitude = parseRouteRequest(new URLSearchParams({
    dest_id: 'destination-1',
    user_lat: '91',
    user_lon: '10.75',
  }));
  assert.deepEqual(badLatitude, { ok: false, error: 'Ugyldig user_lat' });

  const badProfile = parseRouteRequest(new URLSearchParams({
    dest_id: 'destination-1',
    user_lat: '59.91',
    user_lon: '10.75',
    profile: 'flying',
  }));
  assert.deepEqual(badProfile, { ok: false, error: 'Ugyldig profile' });
});
