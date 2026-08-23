import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';
import { getRoute, OrsRouteError } from '../../../lib/orsClient';
import { getClientIp, isRateLimited } from '../../../lib/rateLimit';
import { parseRouteRequest } from '../../../lib/routeRequest';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ip  = getClientIp(request);

  if (isRateLimited(`route:${ip}`, 20, 60_000)) {
    return NextResponse.json(
      { error: 'For mange ruteberegninger. Vent litt og prøv igjen.' },
      { status: 429 },
    );
  }

  const parsed = parseRouteRequest(url.searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { userLat, userLon, profile, destination } = parsed.value;
  let destLat: number;
  let destLon: number;

  if (destination.kind === 'id') {
    if (!supabase) {
      return NextResponse.json({ error: 'Databasen er ikke konfigurert' }, { status: 503 });
    }

    const { data: dest, error: destErr } = await supabase
      .from('destinations')
      .select('lat, lon')
      .eq('id', destination.id)
      .maybeSingle();

    if (destErr) {
      console.error('[route] Kunne ikke hente turmål:', destErr.message);
      return NextResponse.json({ error: 'Kunne ikke hente turmålet' }, { status: 502 });
    }
    if (!dest) {
      return NextResponse.json({ error: 'Turmålet finnes ikke' }, { status: 404 });
    }
    destLat = dest.lat;
    destLon = dest.lon;
  } else {
    destLat = destination.lat;
    destLon = destination.lon;
  }

  let route;
  try {
    route = await getRoute(userLat, userLon, destLat, destLon, profile);
  } catch (error) {
    if (!(error instanceof OrsRouteError)) {
      console.error('[route] Ukjent feil fra rutemotoren:', error);
      return NextResponse.json(
        { error: 'Rutemotoren er midlertidig utilgjengelig' },
        { status: 502 },
      );
    }

    if (error.reason === 'missing-key') {
      return NextResponse.json(
        { error: 'Rutemotoren er ikke konfigurert' },
        { status: 503 },
      );
    }
    if (error.reason === 'authentication') {
      return NextResponse.json(
        { error: 'Rutemotorens API-nøkkel ble avvist' },
        { status: 502 },
      );
    }
    if (error.reason === 'rate-limit') {
      return NextResponse.json(
        { error: 'Rutemotorens kapasitet er midlertidig brukt opp' },
        { status: 503 },
      );
    }
    if (error.reason === 'timeout') {
      return NextResponse.json(
        { error: 'Rutemotoren brukte for lang tid' },
        { status: 504 },
      );
    }

    return NextResponse.json(
      { error: 'Rutemotoren er midlertidig utilgjengelig' },
      { status: 502 },
    );
  }

  if (!route) {
    return NextResponse.json(
      { error: 'Fant ingen rute mellom startpunktet og turmålet' },
      { status: 502 },
    );
  }
  return NextResponse.json(route);
}
