import { NextRequest, NextResponse } from 'next/server'

const WINDOW_MS = 60_000
const MAX_REQUESTS = 30

const counts = new Map<string, { n: number; reset: number }>()

export function middleware(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  const now = Date.now()
  const entry = counts.get(ip)

  if (!entry || now > entry.reset) {
    counts.set(ip, { n: 1, reset: now + WINDOW_MS })
    return NextResponse.next()
  }

  entry.n++

  if (entry.n > MAX_REQUESTS) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil((entry.reset - now) / 1000)),
        'Content-Type': 'text/plain',
      },
    })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/tilbyder/:path*', '/resultater/:path*'],
}
