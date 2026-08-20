'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="no">
      <body className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
        <main className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Noe gikk galt</h1>
          <p className="mt-3 text-sm text-slate-600">
            Feilen er registrert. Prøv å laste inn siden på nytt.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Prøv igjen
          </button>
        </main>
      </body>
    </html>
  );
}
