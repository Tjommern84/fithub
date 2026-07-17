'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import FeedbackModal from './FeedbackModal';
import { container } from '../lib/ui';

const CATEGORIES_NAV = [
  { href: '/resultater?cat=trene-selv',      label: 'Egentrening' },
  { href: '/resultater?cat=trene-sammen',    label: 'Gruppetime' },
  { href: '/resultater?cat=oppfolging',      label: 'Oppfølging & coaching' },
  { href: '/resultater?cat=helse',           label: 'Helse & behandling' },
  { href: '/resultater?cat=aktivitet-sport', label: 'Sport' },
  { href: '/resultater?cat=paraidrett',      label: 'Paraidrett' },
  { href: '/resultater?cat=utendors',        label: 'Utendørs' },
  { href: '/tur',                            label: 'Turruter' },
];

const POPULAR_SEARCHES = [
  { href: '/resultater?cat=trene-selv&location=Oslo',       label: 'Treningssenter Oslo' },
  { href: '/resultater?cat=trene-selv&location=Bergen',     label: 'Treningssenter Bergen' },
  { href: '/resultater?cat=trene-selv&location=Trondheim',  label: 'Treningssenter Trondheim' },
  { href: '/resultater?cat=oppfolging&location=Oslo',       label: 'Personlig trener Oslo' },
  { href: '/resultater?cat=oppfolging&location=Bergen',     label: 'Personlig trener Bergen' },
  { href: '/resultater?cat=trene-sammen&location=Oslo',     label: 'Gruppetimer Oslo' },
  { href: '/resultater?cat=aktivitet-sport&location=Oslo',  label: 'Idrettslag Oslo' },
  { href: '/resultater?cat=helse&location=Oslo',            label: 'Fysioterapi Oslo' },
  { href: '/resultater?cat=helse&location=Trondheim',       label: 'Fysioterapi Trondheim' },
];

export default function Footer() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <footer className="border-t border-white/10 bg-brand-forest">
      <div className={`${container} py-12 sm:py-16`}>

        {/* ── Topp: 3-kolonne grid ─────────────────────────────────────── */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">

          {/* Brand */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Image src="/images/fithublogo.png" alt="" width={36} height={36} className="rounded-md" />
              <span className="font-heading text-lg font-bold tracking-wide text-white">fithub.no</span>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-white/60">
              Oppdag aktiviteter. Finn fellesskap. Beveg deg mer.
            </p>
            <p className="mt-4 text-sm text-white/50">
              Norges aktivitetsplattform for alle aldre og nivåer.
            </p>
          </div>

          {/* Kategorier */}
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-white/40">
              Kategorier
            </p>
            <ul className="space-y-2">
              {CATEGORIES_NAV.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-white/70 transition hover:text-white hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Kontakt & info */}
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-white/40">
              Kontakt & info
            </p>
            <ul className="space-y-2">
              <li>
                <Link href="/om-oss" className="text-sm text-white/70 transition hover:text-white hover:underline">
                  Om oss
                </Link>
              </li>
              <li>
                <Link href="/tilbydere" className="text-sm text-white/70 transition hover:text-white hover:underline">
                  For tilbydere
                </Link>
              </li>
              <li>
                <Link href="/kontakt" className="text-sm text-white/70 transition hover:text-white hover:underline">
                  Kontakt oss
                </Link>
              </li>
              <li>
                <a href="mailto:post@fithub.no" className="text-sm text-white/70 transition hover:text-white hover:underline">
                  post@fithub.no
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setFeedbackOpen(true)}
                  className="text-sm text-white/70 transition hover:text-white hover:underline"
                >
                  Gi feedback
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* ── Populære søk ─────────────────────────────────────────────── */}
        <div className="mt-10 border-t border-white/10 pt-8">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-white/40">
            Populære søk
          </p>
          <nav aria-label="Populære søk">
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {POPULAR_SEARCHES.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-white/60 transition hover:text-white hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* ── Bunn: copyright + juridisk ───────────────────────────────── */}
        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/40">© {new Date().getFullYear()} fithub.no</p>
          <div className="flex flex-wrap gap-4 text-xs text-white/50">
            <Link href="/personvern" className="transition hover:text-white">Personvern</Link>
            <Link href="/vilkar"     className="transition hover:text-white">Vilkår</Link>
            <Link href="/cookies"    className="transition hover:text-white">Cookies</Link>
          </div>
        </div>
      </div>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </footer>
  );
}
