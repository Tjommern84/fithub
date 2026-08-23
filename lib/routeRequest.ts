import type { OrsProfile } from './orsClient';

type RouteRequest = {
  userLat: number;
  userLon: number;
  profile: OrsProfile;
  destination:
    | { kind: 'id'; id: string }
    | { kind: 'coordinates'; lat: number; lon: number };
};

export type RouteRequestResult =
  | { ok: true; value: RouteRequest }
  | { ok: false; error: string };

const ROUTE_PROFILES = new Set<OrsProfile>([
  'foot-walking',
  'cycling-regular',
  'driving-car',
]);

function parseCoordinate(
  raw: string | null,
  label: string,
  min: number,
  max: number,
): number | string {
  if (raw === null || raw.trim() === '') return `Mangler ${label}`;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    return `Ugyldig ${label}`;
  }
  return value;
}

export function parseRouteRequest(searchParams: URLSearchParams): RouteRequestResult {
  const userLat = parseCoordinate(searchParams.get('user_lat'), 'user_lat', -90, 90);
  if (typeof userLat === 'string') return { ok: false, error: userLat };

  const userLon = parseCoordinate(searchParams.get('user_lon'), 'user_lon', -180, 180);
  if (typeof userLon === 'string') return { ok: false, error: userLon };

  const rawProfile = searchParams.get('profile') ?? 'foot-walking';
  if (!ROUTE_PROFILES.has(rawProfile as OrsProfile)) {
    return { ok: false, error: 'Ugyldig profile' };
  }
  const profile = rawProfile as OrsProfile;

  const destId = searchParams.get('dest_id')?.trim();
  if (destId) {
    return {
      ok: true,
      value: {
        userLat,
        userLon,
        profile,
        destination: { kind: 'id', id: destId },
      },
    };
  }

  const destLat = parseCoordinate(searchParams.get('dest_lat'), 'dest_lat', -90, 90);
  if (typeof destLat === 'string') {
    return { ok: false, error: 'Mangler dest_id eller gyldig dest_lat og dest_lon' };
  }
  const destLon = parseCoordinate(searchParams.get('dest_lon'), 'dest_lon', -180, 180);
  if (typeof destLon === 'string') {
    return { ok: false, error: 'Mangler dest_id eller gyldig dest_lat og dest_lon' };
  }

  return {
    ok: true,
    value: {
      userLat,
      userLon,
      profile,
      destination: { kind: 'coordinates', lat: destLat, lon: destLon },
    },
  };
}
