import { getTrailsInBounds, getNearestTrails, type BoundingBox } from './trailsDb';
import { getTursoTrailsInBounds, getTursoNearestTrails } from './tursoTrails';

export function getTrailDataSource() {
  const source = process.env.TRAILS_DATA_SOURCE ?? 'supabase';
  if (source !== 'supabase' && source !== 'turso') throw new Error('Invalid trails data source');
  return source;
}

export function searchTrailBounds(bounds: BoundingBox, limit = 2000, signal?: AbortSignal) {
  return getTrailDataSource() === 'turso' ? getTursoTrailsInBounds(bounds, limit, signal) : getTrailsInBounds(bounds, limit);
}

export function searchNearestTrails(lat: number, lon: number, radiusKm: number, limit: number, signal?: AbortSignal) {
  return getTrailDataSource() === 'turso' ? getTursoNearestTrails(lat, lon, radiusKm, limit, signal) : getNearestTrails(lat, lon, radiusKm, limit);
}
