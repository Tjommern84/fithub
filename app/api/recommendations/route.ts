import { NextRequest, NextResponse } from 'next/server';
import { getRecommendations } from '../../actions/recommendations';
import { getClientIp, isRateLimited } from '../../../lib/rateLimit';

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  if (isRateLimited(`recommendations:${ip}`, 30, 60_000)) {
    return NextResponse.json({ recommendations: [], locationLabel: null }, { status: 429 });
  }

  const header = request.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7) : '';
  if (!token) {
    return NextResponse.json({ recommendations: [], locationLabel: null });
  }

  const limitParam = request.nextUrl.searchParams.get('limit');
  const parsedLimit = Number(limitParam);
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(15, parsedLimit))
    : 5;
  const suggestions = await getRecommendations(token, limit);
  return NextResponse.json(suggestions);
}
