const store = new Map<string, number[]>();

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown';
  return request.headers.get('cf-connecting-ip') ?? 'unknown';
}

export function isRateLimited(
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const timestamps = store.get(key) ?? [];
  const windowed = timestamps.filter((ts) => now - ts < windowMs);
  if (windowed.length >= maxRequests) return true;
  windowed.push(now);
  store.set(key, windowed);
  return false;
}
