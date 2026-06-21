import type { Metadata } from 'next';
import Link from 'next/link';
import { container } from '../../lib/ui';

export const metadata: Metadata = {
  title: 'Magasin – FitHub',
  description: 'FitHub Magasin kommer snart — artikler og inspirasjon om trening og friluftsliv.',
};

export default function MagasinPage() {
  return (
    <main className={`${container} py-16`}>
      <h1 className="font-heading text-3xl font-extrabold text-brand-forest">Magasin</h1>
      <p className="mt-4 max-w-2xl text-sm text-slate-600">
        Kommer snart — artikler og inspirasjon om trening, gruppetimer og friluftsliv i Norge.
      </p>

      <Link href="/" className="mt-8 inline-flex text-sm font-semibold text-slate-700 underline">
        Tilbake til forsiden
      </Link>
    </main>
  );
}
