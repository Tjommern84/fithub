import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeEwkbLineString, decodeEwkbPoint, haversineDistanceKm, lineIntersectsBounds, radiusBounds, type Coordinate } from '../lib/trailGeometry';

function geometry(type: 1 | 2, points: number[][], littleEndian = true, dimensions = 2, srid = 4326): Buffer {
  const bytes = Buffer.alloc(9 + (type === 2 ? 4 : 0) + points.length * dimensions * 8);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  view.setUint8(0, Number(littleEndian));
  view.setUint32(1, (type | 0x20000000 | (dimensions === 3 ? 0x80000000 : dimensions === 4 ? 0xc0000000 : 0)) >>> 0, littleEndian);
  view.setUint32(5, srid, littleEndian);
  let offset = 9;
  if (type === 2) { view.setUint32(offset, points.length, littleEndian); offset += 4; }
  for (const point of points) for (const value of point) { view.setFloat64(offset, value, littleEndian); offset += 8; }
  return bytes;
}

test('EWKB preserves double precision in both byte orders and respects sliced buffer offsets', () => {
  const points: Coordinate[] = [[10.1234567890123, 59.8765432109876], [10.2234567890123, 59.7765432109876]];
  for (const endian of [true, false]) {
    const raw = geometry(2, points, endian);
    const padded = Buffer.alloc(raw.length + 10);
    padded.set(raw, 7);
    const sliced = padded.subarray(7, 7 + raw.length);
    assert.deepEqual(decodeEwkbLineString(sliced), { type: 'LineString', coordinates: points });
    assert.deepEqual(decodeEwkbPoint(geometry(1, [points[0]], endian)).coordinates, points[0]);
  }
});

test('EWKB consumes Z/M dimensions while returning XY and rejects corrupt or projected data', () => {
  assert.deepEqual(decodeEwkbLineString(geometry(2, [[10, 60, 300, 40], [11, 61, 500, 50]], true, 4)).coordinates, [[10, 60], [11, 61]]);
  assert.deepEqual(decodeEwkbPoint(geometry(1, [[10, 60, 300]], false, 3)).coordinates, [10, 60]);
  assert.throws(() => decodeEwkbPoint(geometry(1, [[10, 60]], true, 2, 25833)), /SRID/);
  assert.throws(() => decodeEwkbPoint(geometry(1, [[NaN, 60]])), /coordinate/);
  assert.throws(() => decodeEwkbLineString(geometry(2, [[10, 60]]).subarray(0, 15)), /Truncated/);
  assert.throws(() => decodeEwkbPoint(geometry(2, [[10, 60]])), /type/);
  const raw = geometry(1, [[10, 60]]);
  const trailing = new Uint8Array(raw.length + 1);
  trailing.set(raw);
  assert.throws(() => decodeEwkbPoint(trailing), /trailing/);
});

test('exact viewport intersection includes crossing segments and boundary contact, excludes bbox false positives', () => {
  const box = { minLon: 0, minLat: 0, maxLon: 1, maxLat: 1 };
  assert.equal(lineIntersectsBounds([[-1, 0.5], [2, 0.5]], box), true);
  assert.equal(lineIntersectsBounds([[0.5, -1], [0.5, 2]], box), true);
  assert.equal(lineIntersectsBounds([[-1, 1], [1, -1]], box), true);
  assert.equal(lineIntersectsBounds([[-1, 0.1], [0.1, -1]], box), false);
  assert.equal(lineIntersectsBounds([[-1, 2], [2, 2]], box), false);
  assert.equal(lineIntersectsBounds([[0.5, 0.5], [0.5, 0.5]], box), true);
  assert.equal(lineIntersectsBounds([[2, 2], [2, 2]], box), false);
  assert.equal(lineIntersectsBounds([], box), false);
});

test('spherical distances handle identical, known equatorial and antipodal points', () => {
  assert.equal(haversineDistanceKm([10, 60], [10, 60]), 0);
  assert.ok(Math.abs(haversineDistanceKm([0, 0], [1, 0]) - 111.19508) < 0.00001);
  assert.ok(Math.abs(haversineDistanceKm([0, 0], [180, 0]) - 20015.11444) < 0.00001);
  assert.equal(haversineDistanceKm([10, 60], [11, 61]), haversineDistanceKm([11, 61], [10, 60]));
});

test('radius candidate bounds contain destination points in all bearings across Norway and Svalbard', () => {
  for (const center of [[10.2, 59.74], [18.95, 69.65], [15.6, 78.2]] satisfies Coordinate[]) {
    const radius = 100;
    const bounds = radiusBounds(center, radius);
    const lat = center[1] * Math.PI / 180;
    const lon = center[0] * Math.PI / 180;
    const angular = radius / 6371.0088;
    for (let bearing = 0; bearing < 360; bearing += 5) {
      const theta = bearing * Math.PI / 180;
      const phi = Math.asin(Math.sin(lat) * Math.cos(angular) + Math.cos(lat) * Math.sin(angular) * Math.cos(theta));
      const lambda = lon + Math.atan2(Math.sin(theta) * Math.sin(angular) * Math.cos(lat), Math.cos(angular) - Math.sin(lat) * Math.sin(phi));
      const point = [lambda * 180 / Math.PI, phi * 180 / Math.PI];
      assert.ok(point[0] >= bounds.minLon - 1e-10 && point[0] <= bounds.maxLon + 1e-10);
      assert.ok(point[1] >= bounds.minLat - 1e-10 && point[1] <= bounds.maxLat + 1e-10);
    }
  }
  assert.equal(radiusBounds([179.9, 60], 100).minLon, -180);
  assert.equal(radiusBounds([0, 89.9], 100).maxLat, 90);
  assert.deepEqual(radiusBounds([10, 60], 0), { minLon: 10, maxLon: 10, minLat: 60, maxLat: 60 });
  assert.throws(() => radiusBounds([10, 60], -1));
});
