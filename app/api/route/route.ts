import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';
import { getRoute, type OrsProfile } from '../../../lib/orsClient';
import { getClientIp, isRateLimited } from '../../../lib/rateLimit';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ip  = getClientIp(request);

  if (isRateLimited(`route:${ip}`, 20, 60_000)) {
    return NextResponse.json(null, { status: 429 });
  }

  const destId  = url.searchParams.get('dest_id');
  const userLat = Number(url.searchParams.get('user_lat'));
  const userLon = Number(url.searchParams.get('user_lon'));
  const rawProfile = url.searchParams.get('profile') ?? 'foot-walking';
  const profile: OrsProfile = ['foot-walking', 'cycling-regular', 'driving-car'].includes(rawProfile)
    ? rawProfile as OrsProfile
    : 'foot-walking';

  if (!destId || !Number.isFinite(userLat) || !Number.isFinite(userLon)) {
    return NextResponse.json({ error: 'Mangler dest_id, user_lat eller user_lon' }, { status: 400 });
  }

  if (!supabase) return NextResponse.json(null);

  const { data: dest, error: destErr } = await supabase
    .from('destinations')
    .select('lat, lon')
    .eq('id', destId)
    .maybeSingle();

  if (destErr || !dest) return NextResponse.json(null);

  const route = await getRoute(userLat, userLon, dest.lat, dest.lon, profile);
  return NextResponse.json(route);
}
