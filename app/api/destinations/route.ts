import { NextResponse } from 'next/server';
import { getDestinationsInBounds } from '../../../lib/destinationsDb';
import type { DestinationType } from '../../../lib/destinationsDb';
import { getClientIp, isRateLimited } from '../../../lib/rateLimit';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ip  = getClientIp(request);

  if (isRateLimited(`destinations:${ip}`, 200, 60_000)) {
    return NextResponse.json([], { status: 429 });
  }

  const minLon = Number(url.searchParams.get('minLon'));
  const minLat = Number(url.searchParams.get('minLat'));
  const maxLon = Number(url.searchParams.get('maxLon'));
  const maxLat = Number(url.searchParams.get('maxLat'));

  if (![minLon, minLat, maxLon, maxLat].every(Number.isFinite)) {
    return NextResponse.json({ error: 'Mangler eller ugyldig bbox' }, { status: 400 });
  }

  const rawTypes = url.searchParams.get('types');
  const types = rawTypes
    ? (rawTypes.split(',').filter(Boolean) as DestinationType[])
    : undefined;

  const destinations = await getDestinationsInBounds({ minLon, minLat, maxLon, maxLat }, types);
  return NextResponse.json(destinations);
}
