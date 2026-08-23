const ORS_BASE = 'https://api.openrouteservice.org';

export type OrsProfile = 'foot-walking' | 'cycling-regular' | 'driving-car';

export type OrsFailureReason =
  | 'missing-key'
  | 'authentication'
  | 'rate-limit'
  | 'timeout'
  | 'network'
  | 'upstream';

export class OrsRouteError extends Error {
  constructor(
    public readonly reason: OrsFailureReason,
    message: string,
    public readonly upstreamStatus?: number,
  ) {
    super(message);
    this.name = 'OrsRouteError';
  }
}

function getKey(): string {
  const key = process.env.ORS_API_KEY?.trim();
  if (!key) {
    throw new OrsRouteError('missing-key', 'ORS_API_KEY mangler');
  }
  return key;
}

function failureReasonForStatus(status: number): OrsFailureReason {
  if (status === 401 || status === 403) return 'authentication';
  if (status === 429) return 'rate-limit';
  return 'upstream';
}

export type WalkingRoute = {
  distanceKm: number;
  durationMin: number;
  elevationGainM: number | null;
  coordinates: [number, number][]; // [lon, lat] — konverteres til [lat,lon] i Leaflet
};

export async function getRoute(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  profile: OrsProfile = 'foot-walking'
): Promise<WalkingRoute | null> {
  try {
    const res = await fetch(`${ORS_BASE}/v2/directions/${profile}/geojson`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getKey(),
      },
      body: JSON.stringify({
        coordinates: [[fromLon, fromLat], [toLon, toLat]],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw new OrsRouteError(
        failureReasonForStatus(res.status),
        `OpenRouteService svarte HTTP ${res.status}`,
        res.status,
      );
    }

    const data = await res.json() as {
      features: Array<{
        properties: {
          summary: { distance: number; duration: number };
          ascent?: number;
        };
        geometry: { coordinates: [number, number][] };
      }>;
    };

    const feature = data.features?.[0];
    if (!feature) return null;

    const { distance, duration } = feature.properties.summary;
    // ORS returnerer ascent (total stigning) direkte i summary
    const ascent = feature.properties.ascent ?? null;

    return {
      distanceKm:    Math.round(distance / 10) / 100,   // meter → km, 2 desimaler
      durationMin:   Math.round(duration / 60),          // sekunder → minutter
      elevationGainM: ascent != null ? Math.round(ascent) : null,
      coordinates:   feature.geometry.coordinates,       // [lon, lat][]
    };
  } catch (e) {
    if (e instanceof OrsRouteError) {
      console.error(`[ORS] getRoute(${profile}) feil:`, e.message);
      throw e;
    }

    const error = e as Error;
    const reason: OrsFailureReason = error.name === 'TimeoutError' ? 'timeout' : 'network';
    console.error(`[ORS] getRoute(${profile}) feil:`, error.message);
    throw new OrsRouteError(reason, error.message);
  }
}

// Bakoverkompatibelt alias
export const getWalkingRoute = (
  fromLat: number, fromLon: number, toLat: number, toLon: number
) => getRoute(fromLat, fromLon, toLat, toLon, 'foot-walking');
