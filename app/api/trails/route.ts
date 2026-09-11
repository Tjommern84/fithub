import { NextResponse } from 'next/server';
import { searchTrailBounds, getTrailDataSource } from '../../../lib/trailsServer';
import { validTrailBounds } from '../../../lib/tursoTrails';
import { getClientIp, isRateLimited } from '../../../lib/rateLimit';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ip = getClientIp(request);

  if (isRateLimited(`trails:${ip}`, 60, 60_000)) {
    return NextResponse.json([], { status: 429 });
  }

  const minLon = Number(url.searchParams.get('minLon'));
  const minLat = Number(url.searchParams.get('minLat'));
  const maxLon = Number(url.searchParams.get('maxLon'));
  const maxLat = Number(url.searchParams.get('maxLat'));

  if (!['minLon','minLat','maxLon','maxLat'].every(key => url.searchParams.get(key)?.trim())
    || !validTrailBounds({ minLon, minLat, maxLon, maxLat })) {
    return NextResponse.json({ error: 'Mangler eller ugyldig bbox' }, { status: 400 });
  }

  try {
    const trails = await searchTrailBounds({ minLon, minLat, maxLon, maxLat }, 2000, request.signal);
    return NextResponse.json(trails, { headers: { 'X-FitHub-Trails-Source': getTrailDataSource(), 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Kunne ikke hente turruter. Prøv igjen eller zoom inn.' }, { status: 503 });
  }
}
