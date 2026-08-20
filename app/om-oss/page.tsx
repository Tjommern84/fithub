import type { Metadata } from 'next';
import Link from 'next/link';
import { container } from '../../lib/ui';

export const metadata: Metadata = {
  title: 'Om oss – FitHub',
  description: 'FitHub hjelper deg finne trening og aktivitet i nærheten.',
};

export default function OmOssPage() {
  return (
    <main className={`${container} py-16`}>
      <h1 className="font-heading text-3xl font-extrabold text-brand-forest">Om FitHub</h1>

      <p className="mt-6 max-w-2xl text-base text-slate-700">
        FitHub er en søketjeneste som hjelper deg finne trening og aktivitet i nærheten — treningssentre,
        idrettslag, personlige trenere, gruppetrening og turruter over hele Norge.
      </p>

      <p className="mt-4 max-w-2xl text-base text-slate-600">
        Tjenesten er under utvikling. Vi legger fortløpende til nye tilbydere og forbedrer
        søkeresultatene.
      </p>

      <div className="mt-8 border-t border-slate-200 pt-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Kontakt</p>
        <a
          href="mailto:tjommern@gmail.com"
          className="mt-2 inline-block text-base font-semibold text-brand-copper hover:underline"
        >
          tjommern@gmail.com
        </a>
      </div>

      <Link href="/" className="mt-10 inline-flex text-sm font-semibold text-slate-600 hover:underline">
        ← Tilbake til forsiden
      </Link>
    </main>
  );
}
