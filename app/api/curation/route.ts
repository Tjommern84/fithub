'use server';

import { NextRequest, NextResponse } from 'next/server';
import {
  adminUpdateServiceCuration,
  adminUpsertCategory,
  getCategories,
  getFeaturedServices,
  getServicesByCategory,
} from '../../actions/curation';

const parseAccessToken = (request: NextRequest): string | null => {
  const header = request.headers.get('Authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
};

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type');
  if (type === 'categories') {
    const categories = await getCategories();
    return NextResponse.json({ categories });
  }
  if (type === 'featured') {
    const featured = await getFeaturedServices();
    return NextResponse.json({ featured });
  }
  if (type === 'category' && request.nextUrl.searchParams.has('id')) {
    const categoryId = request.nextUrl.searchParams.get('id') as string;
    const q = request.nextUrl.searchParams.get('q') ?? undefined;
    const services = await getServicesByCategory({ categoryId, q });
    return NextResponse.json({ services });
  }
  return NextResponse.json({ message: 'Invalid type' }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const accessToken = parseAccessToken(request);
  if (!accessToken) {
    return NextResponse.json({ ok: false, message: 'Manglende tilgang.' }, { status: 401 });
  }
  const body = await request.json() as { action?: string; serviceId?: string; isFeatured?: boolean; featuredRank?: number; categories?: string[]; id?: string; name?: string; description?: string };
  if (body.action === 'update-service') {
    if (!body.serviceId || body.isFeatured == null || body.featuredRank == null || !Array.isArray(body.categories)) {
      return NextResponse.json({ ok: false, message: 'Mangler felt.' }, { status: 400 });
    }
    const result = await adminUpdateServiceCuration(accessToken, {
      serviceId: body.serviceId,
      isFeatured: body.isFeatured,
      featuredRank: body.featuredRank,
      categories: body.categories,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }
  if (body.action === 'upsert-category') {
    if (!body.name) {
      return NextResponse.json({ ok: false, message: 'Navn er påkrevd.' }, { status: 400 });
    }
    const result = await adminUpsertCategory(accessToken, { id: body.id, name: body.name, description: body.description });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }
  return NextResponse.json({ ok: false, message: 'Ugyldig handling.' }, { status: 400 });
}
