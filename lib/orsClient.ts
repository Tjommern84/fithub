const ORS_BASE = 'https://api.openrouteservice.org';

export type OrsProfile = 'foot-walking' | 'cycling-regular' | 'driving-car';

function getKey(): string {
  const key = process.env.ORS_API_KEY;
  if (!key) throw new Error('ORS_API_KEY mangler i .env.local');
  return key;
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
      console.error(`[ORS] directions feil: HTTP ${res.status}`);
      return null;
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
    console.error(`[ORS] getRoute(${profile}) feil:`, (e as Error).message);
    return null;
  }
}

// Bakoverkompatibelt alias
export const getWalkingRoute = (
  fromLat: number, fromLon: number, toLat: number, toLon: number
) => getRoute(fromLat, fromLon, toLat, toLon, 'foot-walking');
