export interface TransitBounds {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

const EARTH_RADIUS_KM = 6_371;
const MAX_SEARCH_RADIUS_KM = 50;

function toRadians(value: number): number {
  return value * Math.PI / 180;
}

function distanceKm(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
): number {
  const latDelta = toRadians(toLat - fromLat);
  const lonDelta = toRadians(toLon - fromLon);
  const fromLatRadians = toRadians(fromLat);
  const toLatRadians = toRadians(toLat);

  const haversine = Math.sin(latDelta / 2) ** 2
    + Math.cos(fromLatRadians) * Math.cos(toLatRadians) * Math.sin(lonDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
}

export function isValidTransitBounds(bounds: TransitBounds): boolean {
  return Object.values(bounds).every(Number.isFinite)
    && bounds.minLon >= -180
    && bounds.maxLon <= 180
    && bounds.minLat >= -90
    && bounds.maxLat <= 90
    && bounds.minLon < bounds.maxLon
    && bounds.minLat < bounds.maxLat;
}

export function getTransitSearchArea(bounds: TransitBounds): {
  lat: number;
  lon: number;
  radiusKm: number;
} {
  const lat = (bounds.minLat + bounds.maxLat) / 2;
  const lon = (bounds.minLon + bounds.maxLon) / 2;
  const radiusKm = distanceKm(lat, lon, bounds.maxLat, bounds.maxLon);

  return {
    lat,
    lon,
    radiusKm: Math.min(MAX_SEARCH_RADIUS_KM, Math.max(0.1, radiusKm)),
  };
}

export function isInsideTransitBounds(lat: number, lon: number, bounds: TransitBounds): boolean {
  return lat >= bounds.minLat
    && lat <= bounds.maxLat
    && lon >= bounds.minLon
    && lon <= bounds.maxLon;
}

export function mapEnturTransportMode(categories: string[] = []): string | null {
  if (categories.includes('metroStation')) return 'metro';
  if (categories.includes('onstreetTram') || categories.includes('tramStation')) return 'tram';
  if (categories.includes('railStation') || categories.includes('vehicleRailInterchange')) return 'rail';
  if (categories.includes('harbourPort') || categories.includes('ferryPort') || categories.includes('ferryStop')) return 'water';
  if (categories.includes('onstreetBus') || categories.includes('busStation') || categories.includes('coachStation')) return 'bus';
  if (categories.includes('airport')) return 'air';
  if (categories.includes('liftStation')) return 'lift';
  return null;
}
