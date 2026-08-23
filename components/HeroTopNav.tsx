'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import AuthButton from './AuthButton';
import ExploreActivitiesLink from './ExploreActivitiesLink';
import { container } from '../lib/ui';

// Transparent navigasjon som flyter over hero-bildet på forsiden — ingen bakgrunn,
// skygge, border eller blur, jf. forside-spesifikasjonen. Brukes KUN inni HomeHero,
// ikke den vanlige (mørke, sticky) TopNav som resten av sidene bruker.
export default function HeroTopNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className={`${container} relative grid h-16 grid-cols-[auto_1fr_auto] items-center gap-3 sm:h-[72px] lg:h-20`}>
      <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Fithub forside">
        <Image src="/images/fithublogo.png" alt="" width={38} height={38} className="rounded-md sm:h-[42px] sm:w-[42px]" />
        <span className="whitespace-nowrap font-heading text-2xl font-bold tracking-wide text-white sm:text-3xl">fithub.no</span>
      </Link>
      <nav aria-label="Hovednavigasjon" className="hidden items-center justify-center gap-7 lg:flex">
        <ExploreActivitiesLink className="text-sm font-medium text-white/90 transition hover:text-white">
          Utforsk aktiviteter
        </ExploreActivitiesLink>
        <Link href="/tilbydere" className="text-sm font-medium text-white/90 transition hover:text-white">
          Tilbydere
        </Link>
        <Link href="/magasin" className="text-sm font-medium text-white/90 transition hover:text-white">
          Magasin
        </Link>
        <Link href="/om-oss" className="text-sm font-medium text-white/90 transition hover:text-white">
          Om oss
        </Link>
      </nav>
      <div className="flex shrink-0 items-center justify-self-end gap-2">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="hero-mobile-menu"
          aria-label={menuOpen ? 'Lukk meny' : 'Åpne meny'}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 text-white transition hover:bg-white/10 lg:hidden"
        >
          {menuOpen ? (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" />
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" d="M5 7h14M5 12h14M5 17h14" />
            </svg>
          )}
        </button>
        <AuthButton
          ctaLabel="Kom i gang"
          ctaVariant="forest"
          textSizeClassName=""
          loginClassName="hidden whitespace-nowrap sm:inline-flex"
          ctaClassName="!min-h-10 whitespace-nowrap !px-4 text-xs sm:text-sm"
        />
      </div>

      {menuOpen && (
        <nav
          id="hero-mobile-menu"
          aria-label="Mobilnavigasjon"
          className="absolute inset-x-4 top-[58px] z-dropdown grid gap-1 rounded-2xl border border-white/15 bg-brand-forest/95 p-3 shadow-2xl backdrop-blur sm:inset-x-6 sm:top-[66px] lg:hidden"
        >
          <ExploreActivitiesLink className="rounded-xl px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
            Utforsk aktiviteter
          </ExploreActivitiesLink>
          <Link href="/tilbydere" onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
            Tilbydere
          </Link>
          <Link href="/magasin" onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
            Magasin
          </Link>
          <Link href="/om-oss" onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
            Om oss
          </Link>
        </nav>
      )}
    </header>
  );
}
