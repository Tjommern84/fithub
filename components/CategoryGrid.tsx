'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { CATEGORIES, type CategoryConfig, type MainCategory } from '../lib/categoryConfig';
import { useLocation } from '../lib/locationContext';

// ─── Constants ───────────────────────────────────────────────────────────────

const ACCENT: Record<MainCategory, {
  gradient: string;
  activeChip: string;
  ring: string;
}> = {
  'trene-selv': {
    gradient: 'from-amber-500/70 via-orange-400/40 to-transparent',
    activeChip: 'bg-amber-500 border-amber-500 text-white',
    ring: 'ring-amber-400',
  },
  'trene-sammen': {
    gradient: 'from-fuchsia-500/70 via-pink-400/40 to-transparent',
    activeChip: 'bg-fuchsia-500 border-fuchsia-500 text-white',
    ring: 'ring-fuchsia-400',
  },
  'oppfolging': {
    gradient: 'from-sky-500/70 via-cyan-400/40 to-transparent',
    activeChip: 'bg-sky-500 border-sky-500 text-white',
    ring: 'ring-sky-400',
  },
  'aktivitet-sport': {
    gradient: 'from-emerald-500/70 via-teal-400/40 to-transparent',
    activeChip: 'bg-emerald-500 border-emerald-500 text-white',
    ring: 'ring-emerald-400',
  },
  'helse': {
    gradient: 'from-rose-500/70 via-pink-400/40 to-transparent',
    activeChip: 'bg-rose-500 border-rose-500 text-white',
    ring: 'ring-rose-400',
  },
  'paraidrett': {
    gradient: 'from-blue-500/70 via-sky-400/40 to-transparent',
    activeChip: 'bg-blue-500 border-blue-500 text-white',
    ring: 'ring-blue-400',
  },
};

function firstPart(label: string): string {
  return label.split(',')[0]?.trim() || label;
}

// ─── CategoryCard ─────────────────────────────────────────────────────────────

function CategoryCard({
  config,
  selected,
  disabled,
  onClick,
  className = '',
  priority = false,
}: {
  config: CategoryConfig;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  className?: string;
  priority?: boolean;
}) {
  const [imgIdx, setImgIdx] = useState(0);
  const [prevIdx, setPrevIdx] = useState<number | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef<number | null>(null);
  const accent = ACCENT[config.key];

  const cycleImg = () => {
    if (config.images.length <= 1) return;
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    setImgIdx((cur) => {
      const next = (cur + 1) % config.images.length;
      setPrevIdx(cur);
      fadeTimer.current = setTimeout(() => setPrevIdx(null), 450);
      return next;
    });
  };

  const cycleTouch = (dir: 1 | -1) =>
    setImgIdx((p) => (p + dir + config.images.length) % config.images.length);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={cycleImg}
      onMouseLeave={cycleImg}
      onTouchStart={(e) => { touchStartX.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => {
        if (touchStartX.current == null) return;
        const delta = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
        if (Math.abs(delta) > 30) cycleTouch(delta < 0 ? 1 : -1);
        touchStartX.current = null;
      }}
      className={[
        'group relative block w-full overflow-hidden rounded-2xl text-left',
        'border border-black/[0.08]',
        'shadow-[0_2px_24px_rgba(0,0,0,0.07)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.14)]',
        'transition-all duration-300 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        selected
          ? `ring-2 ${accent.ring} ring-offset-2 scale-[1.02]`
          : 'hover:-translate-y-1 hover:scale-[1.015]',
        disabled ? 'pointer-events-none opacity-40 grayscale' : 'cursor-pointer',
        className,
      ].join(' ')}
    >
      {/* Background images — crossfade on hover-cycle */}
      {prevIdx !== null && (
        <Image
          src={config.images[prevIdx]}
          alt=""
          fill
          sizes="(max-width: 640px) 50vw, 576px"
          className="object-cover will-change-[opacity,transform] group-hover:scale-105"
          style={{ transition: 'opacity 0.4s ease, transform 0.7s ease', opacity: 0 }}
        />
      )}
      <Image
        src={config.images[imgIdx]}
        alt=""
        fill
        sizes="(max-width: 640px) 50vw, 576px"
        className="object-cover will-change-[opacity,transform] group-hover:scale-105"
        style={{ transition: 'opacity 0.4s ease, transform 0.7s ease', opacity: 1 }}
        priority={priority && imgIdx === 0}
      />
      {/* Gradient overlays */}
      <div className={`absolute inset-0 bg-gradient-to-br ${accent.gradient}`} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

      {/* Content */}
      <div className="relative z-card flex h-full flex-col justify-between p-5">
        <div className="flex flex-wrap gap-1.5">
          {config.tags.slice(0, 3).map((t) => (
            <span
              key={t.value}
              className="rounded-full border border-white/25 bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm"
            >
              {t.label}
            </span>
          ))}
        </div>

        <div>
          {selected && (
            <span className="mb-1.5 inline-block rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-bold text-slate-900">
              Valgt
            </span>
          )}
          <h2 className="font-heading text-lg font-bold leading-tight text-white sm:text-xl">
            {config.label}
          </h2>
          <p className="mt-1 line-clamp-1 text-sm font-light text-white/85">
            {config.description}
          </p>
        </div>
      </div>

      {/* Image progress dots */}
      {config.images.length > 1 && (
        <div className="absolute bottom-4 right-4 flex items-center gap-1">
          {config.images.map((_, i) => (
            <span
              key={`${config.key}-dot-${i}`}
              className={[
                'h-1 rounded-full transition-all duration-300',
                i === imgIdx ? 'w-4 bg-white' : 'w-1 bg-white/40',
              ].join(' ')}
            />
          ))}
        </div>
      )}
    </button>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

const GEO_PROMPT_KEY = 'sdem_geo_prompt_dismissed';

export default function CategoryGrid() {
  const router = useRouter();
  const { location, setLocation } = useLocation();
  const [geoPrompt, setGeoPrompt] = useState<'hidden' | 'asking' | 'visible'>('hidden');
  const [geoLoading, setGeoLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
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
  }, [searchQuery, location, router]);

  // Show geolocation prompt on first load if no saved location and not dismissed
  useEffect(() => {
    const dismissed = localStorage.getItem(GEO_PROMPT_KEY);
    const saved = localStorage.getItem('sdem_location_v1');
    if (!dismissed && !saved && 'geolocation' in navigator) {
      setGeoPrompt('visible');
    }
  }, []);

  const reverseGeocodeTop = async (lat: number, lon: number): Promise<{ label: string; city: string | null }> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
        { headers: { 'Accept-Language': 'no' } }
      );
      const json = await res.json();
      const addr = json.address ?? {};
      const city = addr.city ?? addr.town ?? addr.municipality ?? addr.village ?? null;
      const road = addr.road as string | undefined;
      const houseNr = addr.house_number as string | undefined;
      const streetPart = [road, houseNr].filter(Boolean).join(' ');
      const label = streetPart
        ? `${streetPart}, ${city ?? ''}`.replace(/,\s*$/, '')
        : (city ?? 'Min lokasjon');
      return { label, city };
    } catch {
      return { label: 'Min lokasjon', city: null };
    }
  };

  const handleGeoAccept = () => {
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lon = Number(pos.coords.longitude.toFixed(6));
        const result = await reverseGeocodeTop(lat, lon);
        setLocation({ label: result.label, city: result.city, lat, lon, source: 'gps', radius: 10, bydel: null });
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
    if (location.city) p.set('city', location.city);
    p.set('lat', String(location.lat));
    p.set('lon', String(location.lon));
    if (location.radius !== null) p.set('radius', String(location.radius));
    if (location.bydel) p.set('bydel', location.bydel);
    router.push(`/resultater?${p.toString()}`);
  }, [location, router]);

  const handleCardClick = useCallback((key: MainCategory) => {
    if (!location) return;
    if (key === 'paraidrett') {
      doNavigate('aktivitet-sport', ['paraidrett']);
    } else {
      doNavigate(key, []);
    }
  }, [location, doNavigate]);

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

      {/* ── Page content ─────────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-4 py-8">

        {/* Heading */}
        <div className="mb-6">
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Finn lokale treningsmuligheter
          </h1>
          <p className="mt-2 max-w-xl text-base font-light text-slate-500">
            {location
              ? `Viser tilbud nær ${firstPart(location.label)}`
              : 'Sett lokasjon i toppen for å låse opp kategoriene'}
          </p>
        </div>

        {/* Search bar */}
        <form className="mb-8" onSubmit={handleSearch}>
          <div className="relative max-w-lg">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Søk på treningssted, PT, yoga…"
              className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-4 pr-28 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
            <button
              type="submit"
              disabled={!searchQuery.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-40"
            >
              Søk
            </button>
          </div>
        </form>

        {/* ── Category grid ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 sm:gap-5">
          {CATEGORIES.map((cat, idx) => (
            <CategoryCard
              key={cat.key}
              config={cat}
              selected={false}
              disabled={!location}
              onClick={() => handleCardClick(cat.key)}
              priority={idx < 4}
              className={[
                'h-56 sm:h-64 lg:h-72',
                idx === CATEGORIES.length - 1 && CATEGORIES.length % 2 !== 0
                  ? 'col-span-2'
                  : '',
              ].filter(Boolean).join(' ')}
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
