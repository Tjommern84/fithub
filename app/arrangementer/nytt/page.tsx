import type { Metadata } from 'next';
import { containerNarrow } from '../../../lib/ui';
import CreateSessionForm from './CreateSessionForm';

export const metadata: Metadata = { title: 'Opprett arrangement – FitHub' };

export default function NyttArrangementPage() {
  return (
    <main className="min-h-screen bg-slate-50 py-10">
      <div className={containerNarrow}>
        <div className="mb-8">
          <p className="text-xs uppercase tracking-wide text-violet-600 font-semibold mb-1">
            Trene sammen
          </p>
          <h1 className="text-3xl font-bold text-slate-900">Opprett arrangement</h1>
          <p className="mt-1 text-sm text-slate-500">
            Samle andre til løpegruppe, gåtur, utetrening eller annen felles aktivitet.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <CreateSessionForm />
        </div>
      </div>
    </main>
  );
}
