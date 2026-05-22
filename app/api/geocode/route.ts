import { NextResponse } from 'next/server';
import { cacheLocations, queryLocationsByLabel, type CachedLocation } from '../../../lib/locations';
import { getClientIp, isRateLimited } from '../../../lib/rateLimit';

const parseCity = (address?: Record<string, unknown>) => {
  if (!address) return undefined;
  return (
    (address.city as string | undefined) ??
    (address.town as string | undefined) ??
    (address.municipality as string | undefined) ??
    (address.village as string | undefined)
  );
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim();
  const ip = getClientIp(request);

  if (!query) {
    return NextResponse.json([]);
  }

  if (isRateLimited(`geocode:${ip}`, 30, 60_000)) {
    return NextResponse.json([], { status: 429 });
  }

  const cached = await queryLocationsByLabel(query, 5);
  if (cached.length > 0) {
    return NextResponse.json(cached);
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&q=${encodeURIComponent(
        query
      )}`,
      {
        headers: {
          'User-Agent': 'fithub/1.0 (fithub.no)',
        },
      }
    );
    if (!response.ok) {
      return NextResponse.json([]);
    }
    const body = (await response.json()) as Array<Record<string, unknown>>;
    const results: CachedLocation[] = body
      .filter((item) => item.lat && item.lon && item.display_name)
      .slice(0, 5)
      .map((item) => {
        const addr = item.address as Record<string, unknown> | undefined;
        const road = addr?.road as string | undefined;
        const houseNr = addr?.house_number as string | undefined;
        const city = parseCity(addr);
        const streetPart = [road, houseNr].filter(Boolean).join(' ');
        const shortLabel = streetPart
          ? `${streetPart}, ${city ?? ''}`.replace(/,\s*$/, '')
          : (city ?? String(item.display_name));
        return {
          label: shortLabel,
          lat: Number(item.lat),
          lon: Number(item.lon),
          city,
          country: addr?.country_code
            ? String((addr.country_code as string).toUpperCase())
            : undefined,
          source: 'nominatim',
        };
      });
    if (results.length > 0) {
      await cacheLocations(results);
    }
    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
