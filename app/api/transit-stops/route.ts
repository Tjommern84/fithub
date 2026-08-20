import { NextResponse } from 'next/server';
import { getClientIp, isRateLimited } from '../../../lib/rateLimit';
import {
  getTransitSearchArea,
  isInsideTransitBounds,
  isValidTransitBounds,
  mapEnturTransportMode,
  type TransitBounds,
} from '../../../lib/transitStops';

interface EnturGeocoderFeature {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    id?: string;
    name?: string;
    category?: string[];
  };
}

interface EnturGeocoderResponse {
  features?: EnturGeocoderFeature[];
}

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
};

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const ip = getClientIp(request);

  if (isRateLimited(`transit-stops:${ip}`, 60, 60_000)) {
    return NextResponse.json([], { status: 429 });
  }

  const bounds: TransitBounds = {
    minLon: Number(requestUrl.searchParams.get('minLon')),
    minLat: Number(requestUrl.searchParams.get('minLat')),
    maxLon: Number(requestUrl.searchParams.get('maxLon')),
    maxLat: Number(requestUrl.searchParams.get('maxLat')),
  };

  if (!isValidTransitBounds(bounds)) {
    return NextResponse.json({ error: 'Mangler eller ugyldig bbox' }, { status: 400 });
  }

  const searchArea = getTransitSearchArea(bounds);
  const enturUrl = new URL('https://api.entur.io/geocoder/v1/reverse');
  enturUrl.searchParams.set('point.lat', String(searchArea.lat));
  enturUrl.searchParams.set('point.lon', String(searchArea.lon));
  enturUrl.searchParams.set('boundary.circle.radius', searchArea.radiusKm.toFixed(2));
  enturUrl.searchParams.set('layers', 'venue');
  enturUrl.searchParams.set('size', '100');
  enturUrl.searchParams.set('lang', 'no');

  let enturData: EnturGeocoderResponse;
  try {
    const response = await fetch(enturUrl, {
      headers: {
        Accept: 'application/json',
        'ET-Client-Name': 'fithub-kart',
      },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      console.warn(`Entur Geocoder svarte med HTTP ${response.status}`);
      return NextResponse.json([], { headers: CACHE_HEADERS });
    }

    enturData = await response.json() as EnturGeocoderResponse;
  } catch (error) {
    console.warn('Kunne ikke hente kollektivstopp fra Entur', error);
    return NextResponse.json([], { headers: CACHE_HEADERS });
  }

  const seen = new Set<string>();
  const result = (enturData.features ?? []).flatMap((feature) => {
    const id = feature.properties?.id;
    const name = feature.properties?.name;
    const coordinates = feature.geometry?.coordinates;
    if (!id || !name || !coordinates || seen.has(id)) return [];

    const [lon, lat] = coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !isInsideTransitBounds(lat, lon, bounds)) {
      return [];
    }

    seen.add(id);
    return [{
      id,
      name,
      transportMode: mapEnturTransportMode(feature.properties?.category),
      lat,
      lon,
    }];
  });

  return NextResponse.json(result, { headers: CACHE_HEADERS });
}
