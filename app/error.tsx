'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { container } from '../lib/ui';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={`${container} flex min-h-[60vh] flex-col items-center justify-center py-20 text-center`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">Feil</p>
      <h1 className="mt-3 text-3xl font-bold text-slate-900">Noe gikk galt</h1>
      <p className="mt-4 max-w-sm text-base text-slate-500">
        En uventet feil oppstod. Prøv igjen eller gå tilbake til forsiden.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Prøv igjen
        </button>
        <Link
          href="/"
          className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Gå til forsiden
        </Link>
      </div>
      {error.digest && (
        <p className="mt-6 text-xs text-slate-300">Referanse: {error.digest}</p>
      )}
    </main>
  );
}
