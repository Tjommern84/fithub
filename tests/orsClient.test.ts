import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { getRoute, OrsRouteError } from '../lib/orsClient';

const originalFetch = globalThis.fetch;
const originalKey = process.env.ORS_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.ORS_API_KEY;
  else process.env.ORS_API_KEY = originalKey;
});

test('reports a missing ORS key as a configuration error', async () => {
  delete process.env.ORS_API_KEY;

  await assert.rejects(
    () => getRoute(59.9139, 10.7522, 59.92, 10.76),
    (error: unknown) => {
      assert.ok(error instanceof OrsRouteError);
      assert.equal(error.reason, 'missing-key');
      return true;
    },
  );
});

test('reports an ORS authentication response without exposing the key', async () => {
  process.env.ORS_API_KEY = 'test-key';
  globalThis.fetch = (async () => new Response(null, { status: 401 })) as typeof fetch;

  await assert.rejects(
    () => getRoute(59.9139, 10.7522, 59.92, 10.76),
    (error: unknown) => {
      assert.ok(error instanceof OrsRouteError);
      assert.equal(error.reason, 'authentication');
      assert.equal(error.upstreamStatus, 401);
      assert.equal(error.message.includes('test-key'), false);
      return true;
    },
  );
});

test('keeps mapping successful ORS responses to the route contract', async () => {
  process.env.ORS_API_KEY = 'test-key';
  globalThis.fetch = (async () => new Response(JSON.stringify({
    features: [{
      properties: {
        summary: { distance: 902.2, duration: 649.6 },
        ascent: 24.4,
      },
      geometry: {
        coordinates: [[10.7522, 59.9139], [10.76, 59.92]],
      },
    }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })) as typeof fetch;

  const route = await getRoute(59.9139, 10.7522, 59.92, 10.76);

  assert.deepEqual(route, {
    distanceKm: 0.9,
    durationMin: 11,
    elevationGainM: 24,
    coordinates: [[10.7522, 59.9139], [10.76, 59.92]],
  });
});
