import Image from 'next/image';
import ExploreActivitiesLink from '../ExploreActivitiesLink';
import HeroTopNav from '../HeroTopNav';
import HomeHeroSearchBar from './HomeHeroSearchBar';
import { container, buttonForest } from '../../lib/ui';

export default function HomeHero() {
  return (
    <section className="relative isolate min-h-[720px] bg-brand-forest sm:min-h-[760px] lg:min-h-[820px]">
      <div className="absolute inset-0 z-0 overflow-hidden">
        <Image
          src="/images/utsikt-tur-pp.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[56%_center] sm:object-center"
        />
      </div>

      <div className="absolute inset-0 z-[1] bg-gradient-to-r from-brand-forest/90 via-brand-forest/48 to-brand-forest/10" />
      <div className="absolute inset-0 z-[1] bg-gradient-to-t from-brand-forest/50 via-transparent to-brand-forest/20" />

      <div className="absolute inset-x-0 top-0 z-30">
        <HeroTopNav />
      </div>

      <div className={`${container} relative z-10 flex min-h-[720px] flex-col justify-center pb-44 pt-24 sm:min-h-[760px] sm:pb-44 sm:pt-28 lg:min-h-[820px] lg:pb-40`}>
        <div className="max-w-[650px]">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-white/70 sm:text-sm">
            Aktiviteter for hele Norge
          </p>
          <h1 className="font-serif text-[3.25rem] font-normal leading-[0.96] tracking-[-0.035em] text-white sm:text-[4.25rem] lg:text-[5.2rem]">
            <span className="block">Oppdag aktiviteter.</span>
            <span className="block">Finn fellesskap.</span>
            <span className="block text-brand-copper">Beveg deg mer.</span>
          </h1>
          <p className="mt-6 max-w-[520px] text-base leading-relaxed text-white/85 sm:text-lg">
            Finn trening, turer og aktiviteter nær deg – ute, inne og sammen med andre.
          </p>
          <div className="mt-8 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
            <ExploreActivitiesLink className={buttonForest}>
              Utforsk aktiviteter
            </ExploreActivitiesLink>
            <a
              href="#hvordan-funker-det"
              className="group inline-flex min-h-[44px] items-center justify-center gap-3 text-sm font-semibold text-white transition hover:text-white/80"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/45 transition group-hover:bg-white/10" aria-hidden="true">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                </svg>
              </span>
              Se hvordan det fungerer
            </a>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 translate-y-1/2">
        <div className={container}>
          <HomeHeroSearchBar />
        </div>
      </div>
    </section>
  );
}
