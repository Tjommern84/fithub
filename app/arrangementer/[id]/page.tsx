import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getGroupSession } from '../../../lib/groupSessions';
import { containerNarrow } from '../../../lib/ui';
import SessionDetail from './SessionDetail';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params: paramsPromise }: Props): Promise<Metadata> {
  const params = await paramsPromise;
  const session = await getGroupSession(params.id);
  return { title: session ? `${session.title} – FitHub` : 'Arrangement – FitHub' };
}

export default async function ArrangementPage({ params: paramsPromise }: Props) {
  const params = await paramsPromise;
  const session = await getGroupSession(params.id);
  if (!session) notFound();

  return (
    <main className="min-h-screen bg-slate-50 py-8">
      <div className={containerNarrow}>
        <Link
          href="/resultater?cat=trene-sammen"
          className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 mb-6"
        >
          ← Tilbake til Trene sammen
        </Link>

        <SessionDetail session={session} />
      </div>
    </main>
  );
}
