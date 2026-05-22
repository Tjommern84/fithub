import { NextResponse } from 'next/server';
import { getAvailability } from '../../dashboard/actions';
import { getClientIp, isRateLimited } from '../../../lib/rateLimit';

export async function GET(request: Request) {
  const ip = getClientIp(request);
  if (isRateLimited(`availability:${ip}`, 60, 60_000)) {
    return NextResponse.json([], { status: 429 });
  }

  const url = new URL(request.url);
  const serviceId = url.searchParams.get('serviceId') ?? '';
  if (!serviceId) {
    return NextResponse.json([], { status: 400 });
  }

  const availability = await getAvailability(serviceId);
  return NextResponse.json(availability);
}
