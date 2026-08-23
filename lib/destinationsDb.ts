import { supabase } from './supabaseClient';

export type DestinationType = 'peak' | 'lake' | 'viewpoint' | 'shelter' | 'hut' | 'parking';

export type Destination = {
  id: string;
  name: string;
  destinationType: DestinationType;
  elevationM: number | null;
  lat: number;
  lon: number;
};

export type RouteDestination = Destination & {
  routeByCoordinates?: boolean;
};

export type DestinationWithDistance = Destination & {
  distanceKm: number;
};

type DestinationRow = {
  id: string;
  name: string;
  destination_type: string;
  elevation_m: number | null;
  lat: number;
  lon: number;
  geojson?: string;
};

type DestinationWithDistanceRow = DestinationRow & {
  distance_km: number;
};

function rowToDestination(row: DestinationRow): Destination {
  return {
    id: row.id,
    name: row.name,
    destinationType: row.destination_type as DestinationType,
    elevationM: row.elevation_m ?? null,
    lat: row.lat,
    lon: row.lon,
  };
}

export type BoundingBox = {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
};

export async function getDestinationsInBounds(
  bbox: BoundingBox,
  types?: DestinationType[],
  limit = 500
): Promise<Destination[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_destinations_in_bbox', {
    p_min_lon: bbox.minLon,
    p_min_lat: bbox.minLat,
    p_max_lon: bbox.maxLon,
    p_max_lat: bbox.maxLat,
    p_types:   types && types.length > 0 ? types : null,
    p_limit:   limit,
  });
  if (error || !data) return [];
  return (data as DestinationRow[]).map(rowToDestination);
}

export async function getNearestDestinations(
  lat: number,
  lon: number,
  radiusKm = 30,
  types?: DestinationType[],
  limit = 20
): Promise<DestinationWithDistance[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_nearest_destinations', {
    p_lat:       lat,
    p_lon:       lon,
    p_radius_km: radiusKm,
    p_types:     types && types.length > 0 ? types : null,
    p_limit:     limit,
  });
  if (error || !data) return [];
  return (data as DestinationWithDistanceRow[]).map(row => ({
    ...rowToDestination(row),
    distanceKm: Number(row.distance_km),
  }));
}

export async function findTrailRoute(
  userLat: number,
  userLon: number,
  destLat: number,
  destLon: number
): Promise<{ trailIds: string[]; totalKm: number } | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('find_trail_route', {
    p_user_lat:  userLat,
    p_user_lon:  userLon,
    p_dest_lat:  destLat,
    p_dest_lon:  destLon,
    p_max_depth: 120,
  });
  if (error || !data || !Array.isArray(data) || data.length === 0) return null;
  const row = data[0] as { trail_ids: string[]; total_km: number };
  if (!row.trail_ids?.length) return null;
  return { trailIds: row.trail_ids, totalKm: Number(row.total_km) };
}
