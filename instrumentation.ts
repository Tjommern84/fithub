import * as Sentry from '@sentry/nextjs';

export function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (process.env.NODE_ENV === 'production' && !dsn) {
    console.warn('[monitoring] NEXT_PUBLIC_SENTRY_DSN mangler; Sentry er deaktivert.');
  }

  Sentry.init({
    dsn,
    enabled: process.env.NODE_ENV === 'production' && Boolean(dsn),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}

export const onRequestError = Sentry.captureRequestError;
