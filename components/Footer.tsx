'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import FeedbackModal from './FeedbackModal';
import { container } from '../lib/ui';

const NAV_CATEGORIES = [
  { href: '/trene-selv/oslo',          label: 'Treningssenter Oslo' },
  { href: '/trene-selv/bergen',        label: 'Treningssenter Bergen' },
  { href: '/trene-selv/trondheim',     label: 'Treningssenter Trondheim' },
  { href: '/oppfolging/oslo',          label: 'Personlig trener Oslo' },
  { href: '/oppfolging/bergen',        label: 'Personlig trener Bergen' },
  { href: '/trene-sammen/oslo',        label: 'Gruppetimer Oslo' },
  { href: '/aktivitet-sport/oslo',     label: 'Idrettslag Oslo' },
  { href: '/aktivitet-sport/bergen',   label: 'Idrettslag Bergen' },
  { href: '/helse/oslo',               label: 'Fysioterapi Oslo' },
  { href: '/helse/trondheim',          label: 'Fysioterapi Trondheim' },
];

export default function Footer() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <footer className="border-t border-white/10 bg-brand-forest">
      <div className={`${container} py-10`}>
        <div className="mb-6 flex items-center gap-2">
          <Image src="/images/fithublogo.png" alt="" width={32} height={32} className="rounded-md" />
          <span className="font-heading text-sm font-bold tracking-wide text-white">fithub.no</span>
        </div>

        {/* Internal SEO links */}
        <nav aria-label="Populære søk" className="mb-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/50">
            Populære søk
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {NAV_CATEGORIES.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-sm text-white/70 hover:text-white hover:underline"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-4 text-sm text-white/70 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/50">© {new Date().getFullYear()} fithub.no</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/kontakt" className="text-sm font-semibold text-white hover:text-white/80">
              Kontakt oss
            </Link>
            <a href="mailto:post@fithub.no" className="hover:text-white">
              post@fithub.no
            </a>
            <button
              type="button"
              onClick={() => setFeedbackOpen(true)}
              className="hover:text-white"
            >
              Gi feedback
            </button>
            <Link href="/personvern" className="hover:text-white">Personvern</Link>
            <Link href="/vilkar" className="hover:text-white">Vilkår</Link>
            <Link href="/cookies" className="hover:text-white">Cookies</Link>
          </div>
        </div>
      </div>
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </footer>
  );
}
