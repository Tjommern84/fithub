import Link from 'next/link';
import { container } from '../lib/ui';

export default function NotFound() {
  return (
    <main className={`${container} flex min-h-[60vh] flex-col items-center justify-center py-20 text-center`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">404</p>
      <h1 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">
        Siden finnes ikke
      </h1>
      <p className="mt-4 max-w-sm text-base text-slate-500">
        Vi fant ikke siden du leter etter. Den kan ha blitt flyttet eller slettet.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Gå til forsiden
        </Link>
        <Link
          href="/resultater"
          className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Søk etter tilbydere
        </Link>
      </div>
    </main>
  );
}
