'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  catKey: string;
  initialQuery: string;
  initialRadius: number;
  currentLat?: number;
  currentLon?: number;
  currentLocation: string | null;
  currentCity?: string;
  currentTags?: string;
  currentSort?: string;
};

const RADIUS_OPTIONS = [5, 10, 20, 30] as const;

export default function FloatingFilterBar({
  catKey,
  initialQuery,
  initialRadius,
  currentLat,
  currentLon,
  currentLocation,
  currentCity,
  currentTags,
  currentSort,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [radius, setRadius] = useState(initialRadius);

  const buildParams = (overrides: Record<string, string | undefined> = {}) => {
    const p = new URLSearchParams();
    if (catKey) p.set('cat', catKey);
    if (currentLocation) p.set('location', currentLocation);
    if (currentCity) p.set('city', currentCity);
    if (currentLat != null) p.set('lat', String(currentLat));
    if (currentLon != null) p.set('lon', String(currentLon));
    if (currentTags) p.set('tags', currentTags);
    if (currentSort) p.set('sort', currentSort);
    p.set('radius', overrides.radius ?? String(radius));
    if (overrides.query ?? query.trim()) p.set('q', overrides.query ?? query.trim());
    return p;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/resultater?${buildParams().toString()}`);
  };

  const handleRadiusChange = (next: number) => {
    setRadius(next);
    const p = buildParams({ radius: String(next) });
    router.push(`/resultater?${p.toString()}`);
  };

  const displayLocation = currentLocation
    ? currentLocation.split(',')[0].trim()
    : null;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-1 rounded-[24px] bg-white p-2 shadow-2xl sm:flex-row sm:items-center sm:gap-0 sm:divide-x sm:divide-slate-200"
    >
      {/* Tekstsøk */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Søk aktivitet, sted eller tilbyder"
        className="min-w-0 flex-1 rounded-xl bg-transparent px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 sm:rounded-none"
      />

      {/* Lokasjon — read-only med Endre-lenke til forsiden */}
      {displayLocation && (
        <div className="flex items-center gap-1.5 px-4 py-3 shrink-0">
          <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="max-w-[100px] truncate text-sm font-medium text-slate-700">
            {displayLocation}
          </span>
          <a
            href="/"
            className="shrink-0 text-[11px] text-slate-400 transition-colors hover:text-brand-forest"
          >
            Endre
          </a>
        </div>
      )}

      {/* Radius */}
      <div className="flex items-center gap-2 px-4 py-3">
        <select
          value={radius}
          onChange={(e) => handleRadiusChange(Number(e.target.value))}
          className="cursor-pointer border-0 bg-transparent py-1 text-sm font-medium text-slate-700 outline-none"
        >
          {RADIUS_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r} km
            </option>
          ))}
        </select>
      </div>

      {/* Søk-knapp */}
      <div className="px-1 py-1">
        <button
          type="submit"
          aria-label="Søk"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-copper text-white transition hover:bg-brand-copperHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-copper focus-visible:ring-offset-2"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </button>
      </div>
    </form>
  );
}
