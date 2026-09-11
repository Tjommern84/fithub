import test from 'node:test';
import assert from 'node:assert/strict';
import { tursoQuery } from '../lib/tursoSql';

test('Turso transport binds parameters, decodes blobs and closes the connection without leaking SQL errors', async () => {
  const oldUrl = process.env.TURSO_DATABASE_URL, oldToken = process.env.TURSO_AUTH_TOKEN;
  const originalFetch = globalThis.fetch;
  process.env.TURSO_DATABASE_URL = 'libsql://test.turso.io';
  process.env.TURSO_AUTH_TOKEN = 'test-secret';
  try {
    globalThis.fetch = async (input, options) => {
      assert.equal(String(input), 'https://test.turso.io/v2/pipeline');
      const request = JSON.parse(String(options?.body));
      assert.equal(request.requests.at(-1).type, 'close');
      assert.deepEqual(request.requests[0].stmt.args, [{ type: 'text', value: "x'; DROP TABLE trails;--" }, { type: 'float', value: 59.7 }]);
      return Response.json({ results: [{ type: 'ok', response: { result: {
        cols: [{ name: 'geom' }, { name: 'length' }, { name: 'name' }],
        rows: [[{ type: 'blob', base64: 'AQID' }, { type: 'float', value: 2.5 }, { type: 'null' }]],
      } } }] });
    };
    assert.deepEqual(await tursoQuery('SELECT ?,?', ["x'; DROP TABLE trails;--", 59.7]), [{ geom: new Uint8Array([1, 2, 3]), length: 2.5, name: null }]);
    globalThis.fetch = async () => Response.json({ results: [{ type: 'error', error: { message: 'sensitive server detail test-secret' } }] });
    await assert.rejects(tursoQuery('SELECT 1'), { message: 'Turso query failed' });
    let cancelled = false;
    globalThis.fetch = async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(8 * 1024 * 1024 + 1)); },
      cancel() { cancelled = true; },
    }));
    await assert.rejects(tursoQuery('SELECT geom FROM trails'), /response too large/);
    assert.equal(cancelled, true, 'Oversized upstream stream must be cancelled');
    const parent = new AbortController();
    parent.abort();
    globalThis.fetch = async (_input, options) => {
      assert.equal(options?.signal?.aborted, true, 'Parent request cancellation must reach fetch');
      throw new Error('Aborted');
    };
    await assert.rejects(tursoQuery('SELECT 1', [], parent.signal), /request unavailable/);
    delete process.env.TURSO_AUTH_TOKEN;
    await assert.rejects(tursoQuery('SELECT 1'), { message: 'Turso configuration missing' });
  } finally {
    globalThis.fetch = originalFetch;
    if (oldUrl === undefined) delete process.env.TURSO_DATABASE_URL; else process.env.TURSO_DATABASE_URL = oldUrl;
    if (oldToken === undefined) delete process.env.TURSO_AUTH_TOKEN; else process.env.TURSO_AUTH_TOKEN = oldToken;
  }
});
