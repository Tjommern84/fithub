'use client';

import { useEffect, useRef, useState, useCallback, type FormEvent } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  useLocation,
  type LocationState,
  type RadiusKm,
} from '../lib/locationContext';

type Suggestion = {
  label: string;
  city?: string | null;
  lat: number;
  lon: number;
};

const RADIUS_OPTIONS: { value: RadiusKm; label: string }[] = [
  { value: 5,    label: '5 km' },
  { value: 10,   label: '10 km' },
  { value: 20,   label: '20 km' },
  { value: 30,   label: '30 km' },
  { value: null, label: 'Fri' },
];

const SMART_SEARCH_KEY = 'sdem_smart_search_v1';

function firstPart(label: string): string {
  return label.split(',')[0]?.trim() || label;
}

export default function SearchLocationBar() {
  const { location, setLocation, geoPromptVisible, dismissGeoPrompt } = useLocation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [smartSearch, setSmartSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isEditing, setIsEditing] = useState(true);
  const [radiusOpen, setRadiusOpen] = useState(false);
  const [pendingRadius, setPendingRadius] = useState<RadiusKm>(10);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const radiusRef = useRef<HTMLDivElement | null>(null);

  // Smart-søk-toggle: lest fra localStorage etter mount (unngår SSR/client-mismatch)
  useEffect(() => {
    if (localStorage.getItem(SMART_SEARCH_KEY) === '1') setSmartSearch(true);
  }, []);

  const toggleSmartSearch = useCallback(() => {
    setSmartSearch((prev) => {
      const next = !prev;
      localStorage.setItem(SMART_SEARCH_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  // Sync compact/edit mode when context location loads (e.g. from localStorage restore)
  const locationWasNull = useRef(true);
  useEffect(() => {
    if (location !== null && locationWasNull.current) {
      locationWasNull.current = false;
      setQuery(location.label);
      setPendingRadius(location.radius ?? 10);
      setIsEditing(false);
    } else if (location === null) {
      locationWasNull.current = true;
    }
  }, [location]);

  useEffect(() => {
    if (!radiusOpen) return;
    const handler = (e: MouseEvent) => {
      if (radiusRef.current && !radiusRef.current.contains(e.target as Node)) {
        setRadiusOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [radiusOpen]);

  // Debounced suggestions — kun i adressemodus (smartSearch av)
  useEffect(() => {
    if (smartSearch) { setSuggestions([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed || (location && trimmed === location.label)) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) setSuggestions((await res.json()) as Suggestion[]);
      } catch { /* noop */ } finally { setLoadingSuggestions(false); }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, location, smartSearch]);

  const persist = useCallback((next: LocationState | null) => {
    setLocation(next);
    setIsEditing(!next);
  }, [setLocation]);

  const applySuggestion = (item: Suggestion) => {
    const next: LocationState = {
      label: item.label,
      city: item.city ?? null,
      lat: item.lat, lon: item.lon,
      source: 'search', radius: pendingRadius,
    };
    persist(next);
    setQuery(next.label);
    setSuggestions([]);
    setShowSuggestions(false);
    setGeoError(null);
  };

  const reverseGeocode = async (lat: number, lon: number): Promise<{ label: string; city: string | null } | null> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
        { headers: { 'Accept-Language': 'nb-NO,no,en' } }
      );
      if (!res.ok) return null;
      const d = await res.json() as { display_name?: string; address?: Record<string, string> };
      const addr = d.address ?? {};
      const city = addr.city || addr.town || addr.municipality || addr.village || null;
      const road = addr.road;
      const houseNr = addr.house_number;
      const streetPart = [road, houseNr].filter(Boolean).join(' ');
      const label = streetPart
        ? `${streetPart}, ${city ?? ''}`.replace(/,\s*$/, '')
        : (city ?? d.display_name ?? 'Min lokasjon');
      return { label, city };
    } catch { return null; }
  };

  const useGPS = () => {
    if (!navigator.geolocation) { setGeoError('GPS ikke støttet.'); return; }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lon = Number(pos.coords.longitude.toFixed(6));
        const result = await reverseGeocode(lat, lon);
        const label = result?.label || 'Min lokasjon';
        const city = result?.city ?? null;
        persist({ label, city, lat, lon, source: 'gps', radius: pendingRadius });
        setQuery(label);
        setGeoLoading(false);
      },
      (err) => {
        setGeoLoading(false);
        setGeoError(err.code === 1 ? 'Posisjon avvist.' : 'Kunne ikke hente posisjon.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  };

  const handleGeoPromptSkip = () => {
    dismissGeoPrompt();
  };

  const submitSmartSearch = useCallback(() => {
    const q = query.trim();
    if (!q) return;
    if (pathname === '/resultater') {
      const params = new URLSearchParams(searchParams.toString());
      params.set('q', q);
      params.delete('page');
      router.push(`/resultater?${params.toString()}`);
    } else {
      const p = new URLSearchParams();
      p.set('q', q);
      if (location) {
        p.set('location', location.label);
        if (location.city) p.set('city', location.city);
        p.set('lat', String(location.lat));
        p.set('lon', String(location.lon));
        if (location.radius !== null) p.set('radius', String(location.radius));
      }
      router.push(`/resultater?${p.toString()}`);
    }
  }, [query, pathname, searchParams, location, router]);

  const handleSmartSearchSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      submitSmartSearch();
    },
    [submitSmartSearch]
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      {geoPromptVisible && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs text-amber-800">
            📍 Tillat stedstjenester for å bruke din posisjon i stedet for Oslo
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={useGPS}
              disabled={geoLoading}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
            >
              {geoLoading ? 'Henter…' : 'Tillat'}
            </button>
            <button
              type="button"
              onClick={handleGeoPromptSkip}
              className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
            >
              Hopp over
            </button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 items-center gap-3">
        {location && !isEditing ? (
          <>
            <button
              type="button"
              onClick={() => { setIsEditing(true); setTimeout(() => inputRef.current?.focus(), 0); }}
              className="flex items-center gap-2 rounded-lg px-1 py-0.5 text-left transition hover:bg-slate-100"
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-green-400" />
              <span className="text-sm font-medium text-slate-800">
                {firstPart(location.label)}
              </span>
            </button>

            {/* Radius picker — alltid klikkbart, uavhengig av Smart søk */}
            <div ref={radiusRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setRadiusOpen((o) => !o)}
                className="text-xs text-slate-500 hover:text-slate-700 transition"
              >
                {location.radius === null ? 'Fri' : `${location.radius} km`}
              </button>
              {radiusOpen && (
                <div className="absolute left-0 top-full z-dropdown mt-1.5 w-28 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                  {RADIUS_OPTIONS.map(({ value, label }) => (
                    <button
                      key={String(value)}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setPendingRadius(value);
                        setRadiusOpen(false);
                        persist({ ...location, radius: value });
                      }}
                      className={[
                        'block w-full px-4 py-2.5 text-left text-xs font-medium transition',
                        location.radius === value
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-700 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => { persist(null); setQuery(''); }}
              className="text-xs text-slate-300 hover:text-slate-500 transition"
              aria-label="Nullstill lokasjon"
            >
              ✕
            </button>

            <label
              className="ml-auto flex shrink-0 items-center gap-1.5 text-xs text-slate-500 cursor-pointer"
              title="Søk fritt på navn, sted eller type i stedet for kun adresse"
            >
              <input
                type="checkbox"
                checked={smartSearch}
                onChange={toggleSmartSearch}
                className="h-3.5 w-3.5"
              />
              Smart søk
            </label>
          </>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <form onSubmit={smartSearch ? handleSmartSearchSubmit : (e) => e.preventDefault()} className="relative min-w-0 flex-1">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={(e) => {
                  if (smartSearch) return; // Enter håndteres av <form onSubmit>
                  if (e.key === 'Enter' && suggestions[0]) {
                    e.preventDefault();
                    applySuggestion(suggestions[0]);
                  }
                }}
                placeholder={smartSearch ? 'Søk på navn, sted eller type…' : 'Adresse, sted eller postnummer…'}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-amber-300 focus:ring-2 focus:ring-amber-200 transition"
                autoComplete="off"
              />
              {!smartSearch && showSuggestions && (loadingSuggestions || suggestions.length > 0) && (
                <div className="absolute left-0 top-full z-dropdown mt-1.5 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                  {loadingSuggestions && (
                    <p className="px-4 py-3 text-sm text-slate-400">Søker…</p>
                  )}
                  {!loadingSuggestions && suggestions.map((s) => (
                    <button
                      key={`${s.lat}-${s.lon}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applySuggestion(s)}
                      className="block w-full border-t border-slate-100 px-4 py-3 text-left first:border-t-0 hover:bg-amber-50 transition"
                    >
                      <span className="block text-sm font-medium text-slate-900">{s.label}</span>
                      {s.city && s.city.toLowerCase() !== firstPart(s.label).toLowerCase() && (
                        <span className="block text-xs text-slate-400">{s.city}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </form>

            {smartSearch && (
              <button
                type="button"
                onClick={submitSmartSearch}
                className="shrink-0 rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700"
              >
                Søk
              </button>
            )}

            {/* Radius picker */}
            <div ref={radiusRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setRadiusOpen((o) => !o)}
                className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300"
              >
                <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" />
                </svg>
                {pendingRadius === null ? 'Fri' : `${pendingRadius} km`}
                <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {radiusOpen && (
                <div className="absolute left-0 top-full z-dropdown mt-1.5 w-28 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                  {RADIUS_OPTIONS.map(({ value, label }) => (
                    <button
                      key={String(value)}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setPendingRadius(value); setRadiusOpen(false); }}
                      className={[
                        'block w-full px-4 py-2.5 text-left text-xs font-medium transition',
                        pendingRadius === value
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-700 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* GPS button */}
            <button
              type="button"
              onClick={useGPS}
              disabled={geoLoading}
              className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 transition hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60"
              aria-label="Finn min posisjon"
            >
              {geoLoading ? (
                'Henter…'
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                  <circle cx="12" cy="9" r="2.5" fill="currentColor" stroke="none" />
                </svg>
              )}
            </button>

            {geoError && (
              <span className="text-xs text-rose-600">{geoError}</span>
            )}

            <label
              className="ml-auto flex shrink-0 items-center gap-1.5 text-xs text-slate-500 cursor-pointer"
              title="Søk fritt på navn, sted eller type i stedet for kun adresse"
            >
              <input
                type="checkbox"
                checked={smartSearch}
                onChange={toggleSmartSearch}
                className="h-3.5 w-3.5"
              />
              Smart søk
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
