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

  // Enkel, frittstående geolocation — IKKE full adresse-geokoding/forslagsliste.
  // Det er allerede SearchLocationBar (toppmeny) sin jobb; duplisert ikke her.
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
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
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
      className="flex flex-col gap-1 rounded-[24px] bg-white p-2 shadow-2xl sm:flex-row sm:items-center sm:gap-0 sm:divide-x sm:divide-slate-200"
    >
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Søk aktivitet, sted eller tilbyder"
        className="min-w-0 flex-1 rounded-xl bg-transparent px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 sm:rounded-none"
      />

      <button
        type="button"
        onClick={handleUseMyLocation}
        disabled={geoLoading}
        className="shrink-0 px-4 py-3 text-left text-sm text-slate-700 transition hover:text-brand-forest disabled:opacity-60"
      >
        📍 {geoLoading ? 'Henter…' : location ? firstPart(location.label) : 'Velg posisjon'}
      </button>

      <select
        value={cat}
        onChange={(e) => setCat(e.target.value)}
        aria-label="Velg aktivitetstype"
        className="shrink-0 bg-transparent px-4 py-3 text-sm text-slate-700 outline-none"
      >
        <option value="">Alle aktiviteter</option>
        {CATEGORIES.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </select>

      {/* TODO (fremtidig fase): bevisst dekorativ/ikke-funksjonell denne runden —
          search_services() har ingen dato-/tidsfiltrering ennå. */}
      <span
        className="shrink-0 px-4 py-3 text-sm text-slate-400"
        title="Kommer i en fremtidig versjon"
      >
        🕐 Når som helst
      </span>

      <button
        type="submit"
        aria-label="Søk"
        className="flex h-12 w-12 shrink-0 items-center justify-center self-end rounded-full bg-brand-copper text-white transition hover:bg-brand-copperHover sm:self-center"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
        </svg>
      </button>
    </form>
  );
}
