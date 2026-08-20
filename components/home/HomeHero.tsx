import { Suspense } from 'react';
import Image from 'next/image';
import ExploreActivitiesLink from '../ExploreActivitiesLink';
import HeroTopNav from '../HeroTopNav';
import SearchLocationBar from '../SearchLocationBar';
import { container, buttonForest } from '../../lib/ui';

export default function HomeHero() {
  return (
    <section className="relative isolate min-h-[85vh] overflow-hidden sm:min-h-[90vh]">
      {/* Bakgrunnsbilde — z-0, dekker hele heroen, starter helt øverst */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/utsikt-tur-pp.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>

      {/* Overlay — z-1, mørkest til venstre, lysner mot høyre */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-r from-brand-forest/70 via-brand-forest/35 to-brand-forest/5" />

      {/* Navigasjon — z-30, helt transparent, flyter over bildet */}
      <div className="absolute inset-x-0 top-0 z-30">
        <HeroTopNav />
        <div className={`${container} pb-3`}>
          <Suspense fallback={<div className="h-10" />}>
            <SearchLocationBar />
          </Suspense>
        </div>
      </div>

      {/* Hero-tekst + CTA — z-10 */}
      <div className={`${container} relative z-10 flex min-h-[85vh] flex-col justify-center pb-16 pt-32 sm:min-h-[90vh] sm:pb-20 sm:pt-36`}>
        <div className="max-w-[620px]">
          <h1 className="font-heading text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
            <span className="block">Oppdag aktiviteter.</span>
            <span className="block">Finn fellesskap.</span>
            <span className="block text-brand-copper">Beveg deg mer.</span>
          </h1>
          <p className="mt-4 max-w-[450px] text-base text-white/85 sm:text-lg">
            Fithub er Norges aktivitetsplattform for alle aldre og nivåer.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ExploreActivitiesLink className={buttonForest}>
              Utforsk aktiviteter
            </ExploreActivitiesLink>
            <a
              href="#hvordan-funker-det"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/30 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Se hvordan Fithub fungerer
            </a>
          </div>
        </div>
      </div>

    </section>
  );
}
