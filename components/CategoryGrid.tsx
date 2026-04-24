'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORIES, type CategoryConfig, type MainCategory } from '../lib/categoryConfig';

// ─── Types ──────────────────────────────────────────────────────────────────

type Suggestion = {
  label: string;
  city?: string | null;
  lat: number;
  lon: number;
};

type RadiusKm = 5 | 10 | 20 | 30 | null; // null = ubegrenset

type LocationState = {
  label: string;
  lat: number;
  lon: number;
  source: 'gps' | 'search' | 'saved';
  radius: RadiusKm;
  bydel?: string | null;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'sdem_location_v1';
const RADIUS_OPTIONS: { value: RadiusKm; label: string }[] = [
  { value: 5,    label: '5 km' },
  { value: 10,   label: '10 km' },
  { value: 20,   label: '20 km' },
  { value: 30,   label: '30 km' },
  { value: null, label: 'Fri' },
];

const OSLO_BOROUGHS = [
  'Alna', 'Bjerke', 'Frogner', 'Gamle Oslo', 'Grorud', 'Grünerløkka',
  'Nordre Aker', 'Nordstrand', 'Sagene', 'St. Hanshaugen', 'Stovner',
  'Søndre Nordstrand', 'Ullern', 'Vestre Aker', 'Østensjø',
] as const;

const ICONS: Record<MainCategory, React.ReactElement> = {
  'trene-selv': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 12h12"/><path d="M6 8v8"/><path d="M18 8v8"/><path d="M4 10v4"/><path d="M20 10v4"/>
    </svg>
  ),
  'trene-sammen': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  'oppfolging': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  'aktivitet-sport': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
    </svg>
  ),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function firstPart(label: string): string {
  return label.split(',')[0]?.trim() || label;
}

function isOsloLabel(label: string): boolean {
  return firstPart(label).toLowerCase() === 'oslo';
}

// ─── LocationBar ─────────────────────────────────────────────────────────────
// Compact horizontal bar: search/GPS when no location, status chip when set

function LocationBar({
  location,
  setLocation,
}: {
  location: LocationState | null;
  setLocation: (v: LocationState | null) => void;
}) {
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

  // Restore from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as LocationState;
      if (parsed && typeof parsed.label === 'string' && typeof parsed.lat === 'number') {
        const bydel = isOsloLabel(parsed.label) ? parsed.bydel ?? null : null;
        const radius: RadiusKm = parsed.radius ?? 10;
        setLocation({ ...parsed, source: 'saved', radius, bydel });
        setPendingRadius(radius);
        setQuery(parsed.label);
        setIsEditing(false);
      }
    } catch { /* ignore */ }
  }, [setLocation]);

  // Debounced suggestions
  useEffect(() => {
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
  }, [query, location]);

  const persist = useCallback((next: LocationState | null) => {
    setLocation(next);
    if (!next) {
      localStorage.removeItem(STORAGE_KEY);
      setIsEditing(true);
      return;
    }
    setIsEditing(false);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, [setLocation]);

  const applySuggestion = (item: Suggestion) => {
    const label = item.city ?? firstPart(item.label);
    const next: LocationState = {
      label, lat: item.lat, lon: item.lon, source: 'search', radius: pendingRadius,
      bydel: isOsloLabel(label) ? location?.bydel ?? null : null,
    };
    persist(next);
    setQuery(next.label);
    setSuggestions([]);
    setShowSuggestions(false);
    setGeoError(null);
  };

  const reverseGeocode = async (lat: number, lon: number): Promise<string | null> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
        { headers: { 'Accept-Language': 'nb-NO,no,en' } }
      );
      if (!res.ok) return null;
      const d = await res.json() as { display_name?: string; address?: Record<string, string> };
      return d.address?.city || d.address?.town || d.address?.municipality ||
        d.address?.village || d.display_name || null;
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
        const label = (await reverseGeocode(lat, lon)) || 'Min lokasjon';
        persist({ label, lat, lon, source: 'gps', radius: pendingRadius, bydel: null });
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

  const isOsloSelected = !!(location && isOsloLabel(location.label));

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      {location && !isEditing ? (
        // ── Compact location display ──────────────────────────────────────
        <>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-green-400" />
            <span className="text-sm font-medium text-slate-800">
              {firstPart(location.label)}
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500">
              {location.radius === null ? 'Fri' : `${location.radius} km`}
            </span>
          </div>

          {isOsloSelected && (
            <select
              value={location.bydel ?? ''}
              onChange={(e) => persist({ ...location, bydel: e.target.value || null })}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-200"
            >
              <option value="">Alle bydeler</option>
              {OSLO_BOROUGHS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => { setIsEditing(true); setTimeout(() => inputRef.current?.focus(), 0); }}
            className="text-xs font-medium text-slate-400 underline underline-offset-2 hover:text-slate-700 transition"
          >
            Endre
          </button>
          <button
            type="button"
            onClick={() => { persist(null); setQuery(''); }}
            className="text-xs text-slate-300 hover:text-slate-500 transition"
            aria-label="Nullstill lokasjon"
          >
            ✕
          </button>
        </>
      ) : (
        // ── Search mode ───────────────────────────────────────────────────
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="relative min-w-0 flex-1 max-w-xs">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && suggestions[0]) {
                  e.preventDefault();
                  applySuggestion(suggestions[0]);
                }
              }}
              placeholder="Sted eller postnummer…"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-amber-300 focus:ring-2 focus:ring-amber-200 transition"
              autoComplete="off"
            />
            {showSuggestions && (loadingSuggestions || suggestions.length > 0) && (
              <div className="absolute left-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
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
                    <span className="block text-sm font-medium text-slate-900">
                      {s.city || firstPart(s.label)}
                    </span>
                    <span className="block line-clamp-1 text-xs text-slate-400">{s.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

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
              <div className="absolute left-0 top-full z-50 mt-1.5 w-28 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
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

          <button
            type="button"
            onClick={useGPS}
            disabled={geoLoading}
            className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 transition hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60"
          >
            {geoLoading ? 'Henter…' : 'Finn min posisjon'}
          </button>

          {geoError && (
            <span className="text-xs text-rose-600">{geoError}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CategoryCard ─────────────────────────────────────────────────────────────

function CategoryCard({
  config,
  disabled,
  onClick,
  className = '',
}: {
  config: CategoryConfig;
  disabled: boolean;
  onClick: () => void;
  className?: string;
}) {
  const { theme } = config;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={`${config.label} – ${config.description}`}
      className={[
        'block w-full overflow-hidden rounded-[14px] text-left',
        'border border-black/[0.08]',
        'shadow-[0_2px_24px_rgba(0,0,0,0.07)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.14)]',
        'hover:-translate-y-[3px] transition-all duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        disabled ? 'pointer-events-none opacity-40 grayscale' : 'cursor-pointer',
        className,
      ].join(' ')}
      style={{ ['--focus-ring' as string]: theme.accent }}
    >
      {/* Header zone */}
      <div
        className="relative"
        style={{ background: theme.headerBg, minHeight: '110px', padding: '18px 18px 14px' }}
      >
        {/* Accent bar */}
        <div
          className="absolute left-0 right-0 top-0 h-[3px]"
          style={{ background: `linear-gradient(90deg, ${theme.barStart}, ${theme.barEnd})` }}
        />

        {/* Icon box */}
        <div
          className="mb-3 flex items-center justify-center rounded-[10px]"
          style={{
            width: '38px', height: '38px',
            background: `${theme.accent}33`,
            color: theme.accent,
          }}
        >
          {ICONS[config.key]}
        </div>

        {/* Title */}
        <h2
          className="font-barlow text-xl font-bold leading-tight"
          style={{ color: theme.titleColor, letterSpacing: '-0.01em' }}
        >
          {config.label}
        </h2>

        {/* Chip tags */}
        <div className="mt-2.5 flex flex-wrap gap-[5px]">
          {config.tags.slice(0, 3).map((t) => (
            <span
              key={t.value}
              className="rounded-full text-[10px] font-medium"
              style={{
                padding: '3px 8px',
                background: `${theme.accent}40`,
                color: theme.titleColor,
                letterSpacing: '0.03em',
              }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {/* Body zone */}
      <div style={{ background: '#fff', borderTop: '0.5px solid #E5E5E5', padding: '14px 18px' }}>
        {config.tags.slice(0, 3).map((t, i) => (
          <div
            key={t.value}
            className="flex items-center gap-2"
            style={{
              padding: '5px 0',
              borderBottom: i < 2 ? '0.5px solid #E5E5E5' : 'none',
            }}
          >
            <span
              className="shrink-0 rounded-full"
              style={{ width: '6px', height: '6px', background: theme.accent }}
            />
            <span style={{ fontSize: '13px', color: '#555' }}>{t.label}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

const GEO_PROMPT_KEY = 'sdem_geo_prompt_dismissed';

export default function CategoryGrid() {
  const router = useRouter();
  const [location, setLocation] = useState<LocationState | null>(null);
  const [geoPrompt, setGeoPrompt] = useState<'hidden' | 'asking' | 'visible'>('hidden');
  const [geoLoading, setGeoLoading] = useState(false);

  // Show geolocation prompt on first load if no saved location and not dismissed
  useEffect(() => {
    const dismissed = localStorage.getItem(GEO_PROMPT_KEY);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!dismissed && !saved && 'geolocation' in navigator) {
      setGeoPrompt('visible');
    }
  }, []);

  const reverseGeocodeTop = async (lat: number, lon: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
        { headers: { 'Accept-Language': 'no' } }
      );
      const json = await res.json();
      const addr = json.address ?? {};
      return addr.city ?? addr.town ?? addr.municipality ?? addr.village ?? 'Min lokasjon';
    } catch {
      return 'Min lokasjon';
    }
  };

  const handleGeoAccept = () => {
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lon = Number(pos.coords.longitude.toFixed(6));
        const label = await reverseGeocodeTop(lat, lon);
        const newLoc: LocationState = { label, lat, lon, source: 'gps', radius: 10, bydel: null };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newLoc));
        setLocation(newLoc);
        setGeoPrompt('hidden');
        setGeoLoading(false);
      },
      () => {
        setGeoPrompt('hidden');
        setGeoLoading(false);
        localStorage.setItem(GEO_PROMPT_KEY, '1');
      },
      { timeout: 8000 }
    );
  };

  const handleGeoSkip = () => {
    localStorage.setItem(GEO_PROMPT_KEY, '1');
    setGeoPrompt('hidden');
  };

  const doNavigate = useCallback((cat: MainCategory, tags: string[]) => {
    if (!location) return;
    const p = new URLSearchParams();
    p.set('cat', cat);
    if (tags.length > 0) p.set('tags', tags.join(','));
    p.set('location', location.label);
    p.set('lat', String(location.lat));
    p.set('lon', String(location.lon));
    if (location.radius !== null) p.set('radius', String(location.radius));
    if (location.bydel) p.set('bydel', location.bydel);
    router.push(`/resultater?${p.toString()}`);
  }, [location, router]);

  const handleCardClick = useCallback((key: MainCategory) => {
    if (!location) return;
    doNavigate(key, []);
  }, [location, doNavigate]);

  const updateRadius = useCallback((r: RadiusKm) => {
    setLocation((prev) => {
      if (!prev) return prev;
      const next = { ...prev, radius: r };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section>

      {/* ── Geolocation prompt ──────────────────────────────────────── */}
      {geoPrompt === 'visible' && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <p className="text-sm text-amber-800">
              📍 Tillat stedstjenester for å finne tilbud nær deg automatisk
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={handleGeoAccept}
                disabled={geoLoading}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
              >
                {geoLoading ? 'Henter…' : 'Tillat'}
              </button>
              <button
                type="button"
                onClick={handleGeoSkip}
                className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
              >
                Hopp over
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-black/[0.06] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          {/* Brand label */}
          <div className="shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Område
            </p>
          </div>

          {/* Divider */}
          <div className="h-5 w-px shrink-0 bg-slate-200" />

          {/* Location bar */}
          <LocationBar location={location} setLocation={setLocation} />
        </div>
      </div>


      {/* ── Page content ─────────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-4 py-8">

        {/* Heading */}
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Finn lokale treningsmuligheter
          </h1>
          <p className="mt-2 max-w-xl text-base font-light text-slate-500">
            {location
              ? `Viser tilbud nær ${firstPart(location.label)}`
              : 'Sett lokasjon i toppen for å låse opp kategoriene'}
          </p>
        </div>

        {/* ── 2×2 category grid ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
          {CATEGORIES.map((cat) => (
            <CategoryCard
              key={cat.key}
              config={cat}
              disabled={!location}
              onClick={() => handleCardClick(cat.key)}
              className=""
            />
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-xl text-center text-sm font-light leading-relaxed text-slate-400">
          Velg lokasjon, velg kategori og filtrer. Ingen generiske treff.
        </p>
      </div>
    </section>
  );
}
