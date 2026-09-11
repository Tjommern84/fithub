import { getTrailsInBounds, getNearestTrails, type BoundingBox } from './trailsDb';
import { getTursoTrailsInBounds, getTursoNearestTrails } from './tursoTrails';

function isTursoSelected() {
  const source = process.env.TRAILS_DATA_SOURCE ?? 'supabase';
  if (source !== 'supabase' && source !== 'turso') throw new Error('Invalid trails data source');
  return source === 'turso';
}

export function searchTrailBounds(bounds: BoundingBox, limit = 2000, signal?: AbortSignal) {
  return isTursoSelected() ? getTursoTrailsInBounds(bounds, limit, signal) : getTrailsInBounds(bounds, limit);
}

export function searchNearestTrails(lat: number, lon: number, radiusKm: number, limit: number, signal?: AbortSignal) {
  return isTursoSelected() ? getTursoNearestTrails(lat, lon, radiusKm, limit, signal) : getNearestTrails(lat, lon, radiusKm, limit);
}
