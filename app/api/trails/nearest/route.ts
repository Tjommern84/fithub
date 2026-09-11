import { NextResponse } from 'next/server';
import { searchNearestTrails, getTrailDataSource } from '../../../../lib/trailsServer';
import { getClientIp, isRateLimited } from '../../../../lib/rateLimit';

export async function GET(request: Request) {
  if (isRateLimited(`nearest-trails:${getClientIp(request)}`, 60, 60000)) return NextResponse.json([], { status: 429 });
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get('lat')), lon = Number(params.get('lon'));
  const radius = Number(params.get('radiusKm') ?? 30), limit = Number(params.get('limit') ?? 20);
  if (!params.get('lat')?.trim() || !params.get('lon')?.trim() || ![lat, lon, radius, limit].every(Number.isFinite)
    || Math.abs(lat) > 90 || Math.abs(lon) > 180 || radius <= 0 || radius > 100 || limit < 1 || limit > 100 || !Number.isInteger(limit)) {
    return NextResponse.json({ error: 'Ugyldig sted, radius eller antall' }, { status: 400 });
  }
  try { return NextResponse.json(await searchNearestTrails(lat, lon, radius, limit, request.signal), {
    headers: { 'X-FitHub-Trails-Source': getTrailDataSource(), 'Cache-Control': 'no-store' },
  }); }
  catch { return NextResponse.json({ error: 'Kunne ikke hente nærliggende turruter' }, { status: 503 }); }
}
