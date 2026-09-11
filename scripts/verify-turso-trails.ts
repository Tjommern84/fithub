import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { getTursoTrailsInBounds, getTursoNearestTrails } from '../lib/tursoTrails';
import { tursoQuery } from '../lib/tursoSql';

async function rpc(name: string, params: Record<string, number>) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(params), signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Supabase comparison HTTP ${response.status}`);
  return response.json() as Promise<{ id: string; distance_km?: number }[]>;
}

async function main() {
  const report: unknown[] = [];
  for (const place of [
    { name: 'Drammen', lat: 59.744, lon: 10.204 },
    { name: 'Oslo', lat: 59.9139, lon: 10.7522 },
    { name: 'Tromsø', lat: 69.6492, lon: 18.9553 },
  ]) {
    const bounds = { minLon: place.lon - 0.02, maxLon: place.lon + 0.02, minLat: place.lat - 0.01, maxLat: place.lat + 0.01 };
    const started = performance.now();
    const actual = await getTursoTrailsInBounds(bounds);
    const elapsedMs = performance.now() - started;
    const expected = await rpc('get_trails_in_bbox', { p_min_lon: bounds.minLon, p_max_lon: bounds.maxLon,
      p_min_lat: bounds.minLat, p_max_lat: bounds.maxLat, p_limit: 2000 });
    const ids = new Set(actual.map(t => t.id)), expectedIds = new Set(expected.map(t => t.id));
    const missing = expected.filter(t => !ids.has(t.id)).map(t => t.id);
    const extra = actual.filter(t => !expectedIds.has(t.id)).map(t => t.id);
    report.push({ place: place.name, test: 'bounds', count: actual.length, sourceCount: expected.length, missing, extra, elapsedMs });
    assert.equal(missing.length + extra.length, 0, `Bounds differ for ${place.name}`);
    for (const radius of [5, 30]) {
    const startNearest = performance.now();
    const nearest = await getTursoNearestTrails(place.lat, place.lon, radius, 20);
    const nearestMs = performance.now() - startNearest;
    let expectedNearest;
    try {
      expectedNearest = await rpc('get_nearest_trails', { p_lat: place.lat, p_lon: place.lon, p_radius_km: radius, p_limit: 20 });
    } catch (error) {
      report.push({ place: place.name, test: 'nearest', radius, count: nearest.length, elapsedMs: nearestMs,
        comparisonUnavailable: error instanceof Error ? error.message : 'Supabase unavailable' });
      console.log(`LIMIT ${place.name} ${radius}km: Turso returned ${nearest.length}; Supabase reference unavailable`);
      continue;
    }
    assert.deepEqual(new Set(nearest.map(t => t.id)), new Set(expectedNearest.map(t => t.id)), `Nearest differs for ${place.name}`);
    const distanceDifferenceKm = Math.max(0, ...nearest.map(t => Math.abs(t.distanceKm - expectedNearest.find(e => e.id === t.id)!.distance_km!)));
    assert(distanceDifferenceKm < 0.001, 'Distance difference exceeds one metre');
    report.push({ place: place.name, test: 'nearest', radius, count: nearest.length, elapsedMs: nearestMs, distanceDifferenceKm });
    console.log(`PASS ${place.name}: bounds ${actual.length}, nearest ${nearest.length} within ${radius}km`);
    }
  }
  // A write-shaped statement that changes no rows still requires write authorization.
  await assert.rejects(tursoQuery("UPDATE trails SET name=name WHERE 0"), /query failed|HTTP/);
  report.push({ test: 'read-only token rejects writes', passed: true });
  mkdirSync('.tmp/turso', { recursive: true });
  writeFileSync('.tmp/turso/comparison.json', JSON.stringify({ at: new Date().toISOString(), report }, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.some(item => typeof item === 'object' && item !== null && 'comparisonUnavailable' in item)) {
    process.exitCode = 1;
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Verification failed'); process.exitCode = 1; });
