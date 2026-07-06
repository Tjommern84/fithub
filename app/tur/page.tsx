import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

const TrailMap = dynamic(() => import('../../components/TrailMap'), { ssr: false });

// /tur?dest=<uuid> lar forsiden pre-velge en destinasjon (klikk på turmål-kort)


export const metadata: Metadata = {
  title: 'Tur, ski og sykkelruter | FitHub',
  description: 'Utforsk fotruter, skiløyper og sykkelruter fra Geonorge sin Turrutebase.',
};

export default function TurPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const initialDestId = typeof searchParams.dest === 'string' ? searchParams.dest : undefined;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Tur, ski og sykkelruter</h1>
      <p className="text-slate-600 mt-1 mb-6">
        Ruter fra Geonorge sin Turrutebase. Panorer og zoom for å se ruter i andre områder.
      </p>
      <TrailMap initialDestId={initialDestId} />
    </main>
  );
}
