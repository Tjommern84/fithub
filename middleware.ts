import { NextRequest, NextResponse } from 'next/server'

const BAD_UA_PATTERNS = [
  'python', 'curl/', 'wget/', 'go-http-client', 'java/', 'jakarta',
  'okhttp', 'scrapy', 'libwww-perl', 'ruby/', 'php/',
  'node-fetch', 'axios/', 'got/', 'undici', 'httpx', 'aiohttp',
  'colly', 'mechanize', 'httpclient', 'pycurl', 'perl/',
]

export function middleware(req: NextRequest) {
  const ua = (req.headers.get('user-agent') ?? '').toLowerCase()

  if (!ua) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  if (BAD_UA_PATTERNS.some(p => ua.includes(p))) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/tilbyder/:path*', '/resultater/:path*', '/api/:path*'],
}
