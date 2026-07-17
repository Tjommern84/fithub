import type { Metadata } from 'next';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import ScrollAwareTopNav from '../../components/ScrollAwareTopNav';
import { container } from '../../lib/ui';

const TrailMap = dynamic(() => import('../../components/TrailMap'), { ssr: false });

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
    <main className="min-h-screen bg-brand-beige">

      {/* ── Hero-strip ────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden" style={{ minHeight: 280 }}>
        <ScrollAwareTopNav />

        {/* Bakgrunnsbilde */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/bilder/tur/pexels-imagevain-2346018.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
        </div>

        {/* Mørk overlay */}
        <div className="absolute inset-0 z-[1] bg-gradient-to-r from-brand-forest/80 via-brand-forest/45 to-brand-forest/10" />

        {/* Innhold */}
        <div
          className={`${container} relative z-10 flex flex-col justify-end pb-10 pt-32`}
          style={{ minHeight: 280 }}
        >
          <div className="max-w-[520px]">
            <h1 className="font-heading text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              Tur, ski og sykkelruter
            </h1>
            <p className="mt-2 text-base text-white/80">
              Utforsk ruter, turmål og uteaktivitet nær deg.
            </p>
          </div>
        </div>
      </section>

      {/* ── Kart ─────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-4 py-8">
        <TrailMap initialDestId={initialDestId} />
      </div>
    </main>
  );
}
