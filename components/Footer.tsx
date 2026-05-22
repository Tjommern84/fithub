'use client';

import { useState } from 'react';
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
    <footer className="border-t border-slate-200 bg-white">
      <div className={`${container} py-10`}>
        {/* Internal SEO links */}
        <nav aria-label="Populære søk" className="mb-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Populære søk
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {NAV_CATEGORIES.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-sm text-slate-500 hover:text-slate-800 hover:underline"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} fithub.no</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/kontakt" className="text-sm font-semibold text-slate-700 hover:text-slate-900">
              Kontakt oss
            </Link>
            <a href="mailto:post@fithub.no" className="hover:text-slate-900">
              post@fithub.no
            </a>
            <button
              type="button"
              onClick={() => setFeedbackOpen(true)}
              className="hover:text-slate-900"
            >
              Gi feedback
            </button>
            <Link href="/personvern" className="hover:text-slate-900">Personvern</Link>
            <Link href="/vilkar" className="hover:text-slate-900">Vilkår</Link>
            <Link href="/cookies" className="hover:text-slate-900">Cookies</Link>
          </div>
        </div>
      </div>
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </footer>
  );
}
