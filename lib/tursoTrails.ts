import type { BoundingBox, Trail, NearestTrail, TrailType } from './trailsDb';
import { tursoQuery } from './tursoSql';
import { decodeEwkbLineString, decodeEwkbPoint, lineIntersectsBounds, haversineDistanceKm, radiusBounds } from './trailGeometry';

const PAGE = 500;
const MAX_CANDIDATES = 20000;
const metadata = 't.id,t.name,t.trail_type,t.maintainer,t.marked,t.difficulty,t.length_km';
const predicate = 'b.min_lon <= ? AND b.max_lon >= ? AND b.min_lat <= ? AND b.max_lat >= ?';
const boundsArgs = (b: BoundingBox) => [b.maxLon, b.minLon, b.maxLat, b.minLat];
const nullableText = (v: unknown) => v === null ? null : String(v);

export function validTrailBounds(b: BoundingBox): boolean {
  return Object.values(b).every(Number.isFinite) && b.minLon >= -180 && b.maxLon <= 180
    && b.minLat >= -90 && b.maxLat <= 90 && b.minLon < b.maxLon && b.minLat < b.maxLat;
}

export async function getTursoTrailsInBounds(bounds: BoundingBox, limit = 2000, parentSignal?: AbortSignal): Promise<Trail[]> {
  if (!validTrailBounds(bounds)) throw new Error('Invalid trail bounds');
  const take = Math.max(1, Math.min(5000, Math.trunc(limit)));
  const matches: Trail[] = [];
  let vertices = 0;
  const signal = parentSignal ? AbortSignal.any([parentSignal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000);
  for (let offset = 0; offset < MAX_CANDIDATES; offset += PAGE) {
    const rows = await tursoQuery(`SELECT ${metadata},t.geom FROM trails_bounds b JOIN trails t ON t.rowid=b.rowid
      WHERE ${predicate} ORDER BY b.rowid LIMIT ? OFFSET ?`, [...boundsArgs(bounds), PAGE, offset], signal);
    for (const row of rows) {
      if (!(row.geom instanceof Uint8Array)) throw new Error('Missing trail geometry');
      const { coordinates } = decodeEwkbLineString(row.geom);
      if (!lineIntersectsBounds(coordinates, bounds)) continue;
      vertices += coordinates.length;
      if (vertices > 250000) throw new Error('Trail geometry too large; zoom in');
      matches.push({ id: String(row.id), name: nullableText(row.name), trailType: row.trail_type as TrailType,
        maintainer: nullableText(row.maintainer), marked: row.marked === null ? null : Boolean(row.marked),
        difficulty: nullableText(row.difficulty), lengthKm: row.length_km === null ? null : Number(row.length_km),
        coordinates: coordinates.map(([lon, lat]) => [lat, lon]),
      });
      if (matches.length >= take) return matches;
    }
    if (rows.length < PAGE) return matches;
  }
  throw new Error('Trail search too broad; zoom in');
}

export async function getTursoNearestTrails(lat: number, lon: number, radiusKm: number, limit: number, parentSignal?: AbortSignal): Promise<NearestTrail[]> {
  if (![lat, lon, radiusKm, limit].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lon) > 180
    || radiusKm <= 0 || radiusKm > 100) throw new Error('Invalid nearest trail search');
  const take = Math.max(1, Math.min(100, Math.trunc(limit)));
  const signal = parentSignal ? AbortSignal.any([parentSignal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000);
  // Once an inner circle contains enough matches, everything outside it is farther away.
  for (let radius = Math.min(1, radiusKm);; radius = Math.min(radius * 2, radiusKm)) {
    const matches = await nearestWithinRadius(lat, lon, radius, take, signal);
    if (matches.length >= take || radius === radiusKm) return matches;
  }
}

async function nearestWithinRadius(lat: number, lon: number, radiusKm: number, limit: number, signal: AbortSignal): Promise<NearestTrail[]> {
  const bounds = radiusBounds([lon, lat], radiusKm);
  const matches: NearestTrail[] = [];
  // Project only endpoints: downloading every route geometry would dominate nearest-search cost.
  const rows = await tursoQuery(`SELECT t.id,t.name,t.trail_type,t.length_km,t.start_point,t.end_point
      FROM trails_bounds b JOIN trails t ON t.rowid=b.rowid WHERE ${predicate} AND t.name IS NOT NULL
      LIMIT ?`, [...boundsArgs(bounds), MAX_CANDIDATES + 1], signal);
  if (rows.length > MAX_CANDIDATES) throw new Error('Nearest trail search too broad');
    for (const row of rows) {
      if (!(row.start_point instanceof Uint8Array) || !(row.end_point instanceof Uint8Array)) throw new Error('Missing trail endpoints');
      const distanceKm = Math.min(haversineDistanceKm([lon, lat], decodeEwkbPoint(row.start_point).coordinates),
        haversineDistanceKm([lon, lat], decodeEwkbPoint(row.end_point).coordinates));
      if (distanceKm <= radiusKm) matches.push({ id: String(row.id), name: String(row.name),
        trailType: row.trail_type as TrailType, lengthKm: row.length_km === null ? null : Number(row.length_km), distanceKm });
    }
  return matches.sort((a, b) => a.distanceKm - b.distanceKm || a.id.localeCompare(b.id))
      .slice(0, Math.max(1, Math.min(100, Math.trunc(limit))));
}
