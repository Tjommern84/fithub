import { NextResponse } from 'next/server';
import { getTrailsInBounds } from '../../../lib/trailsDb';
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

  if (![minLon, minLat, maxLon, maxLat].every(Number.isFinite)) {
    return NextResponse.json({ error: 'Mangler eller ugyldig bbox' }, { status: 400 });
  }

  const trails = await getTrailsInBounds({ minLon, minLat, maxLon, maxLat });
  return NextResponse.json(trails);
}
