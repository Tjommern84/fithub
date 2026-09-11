import assert from 'node:assert/strict';

const base = new URL(process.argv[2] ?? 'https://fithub.no');
const expectedSource = process.argv[3] ?? 'turso';
assert(['turso', 'supabase'].includes(expectedSource), 'Expected source must be turso or supabase');
assert(base.protocol === 'https:' || (base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname)));
const report = [];
for (const path of [
  '/api/trails?minLon=10.184&maxLon=10.224&minLat=59.734&maxLat=59.754',
  '/api/trails/nearest?lat=59.744&lon=10.204&radiusKm=5&limit=5',
]) {
  const start = performance.now();
  const response = await fetch(new URL(path, base), { redirect: 'manual', signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, `Expected accessible route: ${new URL(path, base).pathname}`);
  assert.equal(response.headers.get('x-fithub-trails-source'), expectedSource, 'Active source differs or deployment is outdated');
  const data = await response.json();
  assert(Array.isArray(data) && data.length > 0, 'Known Drammen query must return actual routes');
  report.push({ path: path.split('?')[0], source: expectedSource, rows: data.length, milliseconds: Math.round(performance.now() - start) });
}
console.log(JSON.stringify({ deployment: base.origin, checkedAt: new Date().toISOString(), report }, null, 2));
