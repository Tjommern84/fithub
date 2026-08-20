export function getSafeInternalPath(value: string | null | undefined, fallback = '/') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return fallback;
  }

  try {
    const parsed = new URL(value, 'https://internal.invalid');
    if (parsed.origin !== 'https://internal.invalid') return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function getSafeAdminPath(value: string | null | undefined) {
  const path = getSafeInternalPath(value, '/admin');
  return path === '/admin' || path.startsWith('/admin/') ? path : '/admin';
}
