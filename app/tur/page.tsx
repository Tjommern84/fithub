import type { Metadata } from 'next';
import Image from 'next/image';
import ScrollAwareTopNav from '../../components/ScrollAwareTopNav';
import TrailMap from '../../components/TrailMapClient';

export const metadata: Metadata = {
  title: 'Tur, ski og sykkelruter | FitHub',
  description: 'Utforsk fotruter, skiløyper og sykkelruter fra Geonorge sin Turrutebase.',
};

export default async function TurPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await searchParamsPromise;
  const initialDestId = typeof searchParams.dest === 'string' ? searchParams.dest : undefined;

  return (
    <main className="min-h-screen bg-brand-beige">

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden min-h-[260px] sm:min-h-[340px]">
        <ScrollAwareTopNav />

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

        <div className="absolute inset-0 z-[1] bg-gradient-to-r from-brand-forest/85 via-brand-forest/50 to-brand-forest/10" />

        <div
          className="relative z-10 mx-auto w-full max-w-[1440px] px-8 lg:px-12 flex flex-col justify-end pb-10 pt-32 min-h-[260px] sm:min-h-[340px]"
        >
          <div className="max-w-[560px]">
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
      <div className="mx-auto max-w-[1440px] px-8 lg:px-12 py-8">
        <TrailMap initialDestId={initialDestId} />
      </div>
    </main>
  );
}
