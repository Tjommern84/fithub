import { supabase } from './supabaseClient';

export type TrailType = 'fotrute' | 'skiloype' | 'sykkelrute' | 'annet';

export type Trail = {
  id: string;
  name: string | null;
  trailType: TrailType;
  maintainer: string | null;
  marked: boolean | null;
  difficulty: string | null;
  lengthKm: number | null;
  coordinates: [number, number][]; // [lat, lon] pairs, for Leaflet Polyline
};

type TrailRow = {
  id: string;
  name: string | null;
  trail_type: TrailType;
  maintainer: string | null;
  marked: boolean | null;
  difficulty: string | null;
  length_km: number | null;
  geojson: string;
};

function rowToTrail(row: TrailRow): Trail | null {
  try {
    const geometry = JSON.parse(row.geojson) as { type: string; coordinates: [number, number][] };
    if (geometry.type !== 'LineString') return null;
    return {
      id: row.id,
      name: row.name,
      trailType: row.trail_type,
      maintainer: row.maintainer,
      marked: row.marked,
      difficulty: row.difficulty,
      lengthKm: row.length_km,
      coordinates: geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    };
  } catch {
    return null;
  }
}

export type BoundingBox = {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
};

export async function getTrailsInBounds(bbox: BoundingBox, limit = 2000): Promise<Trail[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_trails_in_bbox', {
    p_min_lon: bbox.minLon,
    p_min_lat: bbox.minLat,
    p_max_lon: bbox.maxLon,
    p_max_lat: bbox.maxLat,
    p_limit: limit,
  });
  if (error || !data) return [];
  return (data as TrailRow[])
    .map(rowToTrail)
    .filter((t): t is Trail => t !== null);
}

export type NearestTrail = {
  id: string;
  name: string | null;
  trailType: TrailType;
  lengthKm: number | null;
  distanceKm: number;
};

type NearestTrailRow = {
  id: string;
  name: string | null;
  trail_type: TrailType;
  length_km: number | null;
  distance_km: number;
};

// Punkt+radius-basert (i motsetning til getTrailsInBounds() sin viewport/bbox) — for
// "nær deg"-bruk uten kart. RPC-en (get_nearest_trails, sql/31_nearest_trails.sql) er
// IKKE kjørt mot databasen ennå ved skrivende stund — kaller MÅ feile gracefully
// (tomt array), ikke kaste, til migrasjonen er kjørt manuelt av bruker.
export async function getNearestTrails(
  lat: number,
  lon: number,
  radiusKm: number,
  limit: number
): Promise<NearestTrail[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_nearest_trails', {
    p_lat: lat,
    p_lon: lon,
    p_radius_km: radiusKm,
    p_limit: limit,
  });
  if (error || !data) return [];
  return (data as NearestTrailRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    trailType: row.trail_type,
    lengthKm: row.length_km,
    distanceKm: row.distance_km,
  }));
}
