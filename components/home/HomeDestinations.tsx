'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocation } from '../../lib/locationContext';
import { getNearestDestinations } from '../../lib/destinationsDb';
import type { DestinationWithDistance, DestinationType } from '../../lib/destinationsDb';

const DESTINATION_ICONS: Record<DestinationType, string> = {
  peak:      '🏔',
  lake:      '🌊',
  viewpoint: '👁',
  shelter:   '⛺',
  hut:       '🏠',
  parking:   'P',
};

const DESTINATION_LABELS: Record<DestinationType, string> = {
  peak:      'Fjelltopp',
  lake:      'Tjern / vann',
  viewpoint: 'Utsiktspunkt',
  shelter:   'Gapahuk',
  hut:       'Hytte',
  parking:   'Parkering',
};

export default function HomeDestinations() {
  const { location } = useLocation();
  const locationKey = location ? `${location.lat}:${location.lon}` : '';
  const [result, setResult] = useState<{
    locationKey: string;
    destinations: DestinationWithDistance[];
    hasError: boolean;
  }>({ locationKey: '', destinations: [], hasError: false });
  const destinations = result.locationKey === locationKey ? result.destinations : null;
  const hasError = result.locationKey === locationKey && result.hasError;

  useEffect(() => {
    if (!location) return;
    let cancelled = false;
    getNearestDestinations(
      location.lat,
      location.lon,
      30,
      ['peak', 'lake', 'viewpoint', 'shelter', 'hut'],
      8,
    )
      .then((destinations) => {
        if (!cancelled) setResult({ locationKey, destinations, hasError: false });
      })
      .catch(() => {
        if (!cancelled) setResult({ locationKey, destinations: [], hasError: true });
      });
    return () => { cancelled = true; };
  }, [location, locationKey]);

  if (!location || hasError) return null;

  if (destinations === null) {
    return (
      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-copper">Ut på tur</p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-brand-forest">Turmål nær deg</h2>
          <div className="mt-5 flex gap-4 overflow-x-auto pb-2">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-36 w-56 shrink-0 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (destinations.length === 0) return null;

  return (
    <section className="bg-white py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-copper">Ut på tur</p>
            <h2 className="mt-2 font-heading text-3xl font-bold text-brand-forest">Turmål nær deg</h2>
            <p className="mt-2 text-sm text-slate-500">Oppdag utsiktspunkter, topper og fine turmål i nærheten.</p>
          </div>
          <Link href="/tur" className="hidden shrink-0 text-sm font-semibold text-brand-forest transition hover:text-brand-copper sm:inline-flex">
            Åpne turplanleggeren <span aria-hidden="true" className="ml-2">→</span>
          </Link>
        </div>
        <div className="mt-6 flex gap-4 overflow-x-auto pb-3">
          {destinations.map(dest => (
            <Link
              key={dest.id}
              href={`/tur?dest=${dest.id}`}
              className="group block h-36 w-56 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex h-14 items-center justify-center bg-gradient-to-br from-brand-cream to-white text-2xl transition group-hover:from-amber-50">
                {DESTINATION_ICONS[dest.destinationType] ?? '📍'}
              </div>
              <div className="p-3">
                <p className="line-clamp-1 text-sm font-semibold text-slate-900">{dest.name}</p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                  <span>{dest.distanceKm.toFixed(1)} km</span>
                  {dest.elevationM != null && <span>· {dest.elevationM} moh</span>}
                </div>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {DESTINATION_LABELS[dest.destinationType]}
                </p>
              </div>
            </Link>
          ))}
        </div>
        <Link href="/tur" className="mt-3 inline-flex text-sm font-semibold text-brand-forest sm:hidden">
          Åpne turplanleggeren <span aria-hidden="true" className="ml-2">→</span>
        </Link>
      </div>
    </section>
  );
}
