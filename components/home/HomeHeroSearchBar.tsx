'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useLocation } from '../../lib/locationContext';
import { CATEGORIES } from '../../lib/categoryConfig';

function firstPart(label: string): string {
  return label.split(',')[0]?.trim() || label;
}

export default function HomeHeroSearchBar() {
  const router = useRouter();
  const { location, setLocation } = useLocation();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          label: 'Min posisjon',
          city: null,
          lat: Number(pos.coords.latitude.toFixed(6)),
          lon: Number(pos.coords.longitude.toFixed(6)),
          source: 'gps',
          radius: location?.radius ?? 10,
        });
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    const q = query.trim();
    if (q) params.set('q', q);
    if (cat) params.set('cat', cat);
    if (location) {
      params.set('location', location.label);
      if (location.city) params.set('city', location.city);
      params.set('lat', String(location.lat));
      params.set('lon', String(location.lon));
      if (location.radius !== null) params.set('radius', String(location.radius));
    }
    router.push(`/resultater?${params.toString()}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Finn aktiviteter"
      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_52px] gap-1.5 rounded-[22px] border border-white/70 bg-white/95 p-2 shadow-[0_24px_70px_rgba(10,26,14,0.24)] backdrop-blur sm:grid-cols-[minmax(0,1.65fr)_minmax(170px,0.75fr)_minmax(180px,0.8fr)_56px] sm:items-stretch sm:gap-0 sm:divide-x sm:divide-slate-200 sm:rounded-[26px] sm:p-2.5"
    >
      <label className="col-span-3 flex min-w-0 items-center gap-3 rounded-2xl px-3 py-2.5 transition focus-within:bg-brand-cream/60 sm:col-span-1 sm:rounded-none sm:px-4 sm:py-3">
        <svg className="h-5 w-5 shrink-0 text-brand-forest/55" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="m20 20-3.7-3.7" />
        </svg>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Hva ser du etter?
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Aktivitet, sted eller tilbyder"
            className="mt-0.5 w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
          />
        </span>
      </label>

      <button
        type="button"
        onClick={handleUseMyLocation}
        disabled={geoLoading}
        className="flex min-w-0 items-center gap-2 rounded-2xl px-3 py-2.5 text-left transition hover:bg-brand-cream/60 disabled:opacity-60 sm:rounded-none sm:px-4 sm:py-3"
        aria-label="Bruk min posisjon"
      >
        <svg className="h-5 w-5 shrink-0 text-brand-copper" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Sted</span>
          <span className="block truncate text-sm font-medium text-slate-800">
            {geoLoading ? 'Henter…' : location ? firstPart(location.label) : 'Min posisjon'}
          </span>
        </span>
      </button>

      <label className="flex min-w-0 items-center gap-2 rounded-2xl px-3 py-2.5 transition hover:bg-brand-cream/60 sm:rounded-none sm:px-4 sm:py-3">
        <svg className="h-5 w-5 shrink-0 text-brand-copper" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <circle cx="8" cy="8" r="3" />
          <circle cx="17" cy="9" r="2.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 20c0-3 2.5-5 5-5s5 2 5 5m1.5 0c0-2.2 1.4-4 3.5-4.5" />
        </svg>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Kategori</span>
          <select
            value={cat}
            onChange={(event) => setCat(event.target.value)}
            aria-label="Velg aktivitetstype"
            className="block w-full cursor-pointer appearance-none bg-transparent text-sm font-medium text-slate-800 outline-none"
          >
            <option value="">Alle aktiviteter</option>
            {CATEGORIES.map((category) => (
              <option key={category.key} value={category.key}>
                {category.label}
              </option>
            ))}
          </select>
        </span>
      </label>

      <button
        type="submit"
        aria-label="Søk"
        className="flex h-12 w-12 shrink-0 items-center justify-center self-center justify-self-end rounded-full bg-brand-copper text-white shadow-sm transition hover:bg-brand-copperHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-copper focus-visible:ring-offset-2 sm:h-14 sm:w-14"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="m20 20-3.7-3.7" />
        </svg>
      </button>
    </form>
  );
}
