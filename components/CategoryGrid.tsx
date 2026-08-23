'use client';

import { useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { CATEGORIES, type CategoryConfig, type MainCategory } from '../lib/categoryConfig';
import { useLocation } from '../lib/locationContext';

// ─── Constants ───────────────────────────────────────────────────────────────

const ACCENT: Record<MainCategory | 'tur', {
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
  'utendors': {
    gradient: 'from-green-500/70 via-emerald-400/40 to-transparent',
    activeChip: 'bg-green-600 border-green-600 text-white',
    ring: 'ring-green-400',
  },
  'tur': {
    gradient: 'from-stone-500/70 via-amber-700/30 to-transparent',
    activeChip: 'bg-stone-600 border-stone-600 text-white',
    ring: 'ring-stone-400',
  },
};

const TUR_TILE = {
  key: 'tur' as const,
  label: 'Turruter',
  description: 'Fotruter, skiløyper og sykkelruter i hele Norge',
  tags: [
    { label: 'Fotrute', value: 'fotrute' },
    { label: 'Skiløype', value: 'skiloype' },
    { label: 'Sykkelrute', value: 'sykkelrute' },
  ],
  images: [
    '/bilder/tur/pexels-424fotograf-169879395-14500356.webp',
    '/bilder/tur/pexels-imagevain-2346018.webp',
    '/bilder/tur/pexels-orlando-s-197680330-11518760.webp',
    '/bilder/tur/pexels-simon73-29749447.webp',
  ],
};

function firstPart(label: string): string {
  return label.split(',')[0]?.trim() || label;
}

// ─── CategoryCard ─────────────────────────────────────────────────────────────

type CardConfig = Pick<CategoryConfig, 'label' | 'description' | 'tags' | 'images'> & {
  key: MainCategory | 'tur';
};

function CategoryCard({
  config,
  selected,
  disabled,
  onClick,
  className = '',
}: {
  config: CardConfig;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  className?: string;
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
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 288px"
          className="object-cover will-change-[opacity,transform] group-hover:scale-105"
          style={{ transition: 'opacity 0.4s ease, transform 0.7s ease', opacity: 0 }}
        />
      )}
      <Image
        src={config.images[imgIdx]}
        alt=""
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 288px"
        className="object-cover will-change-[opacity,transform] group-hover:scale-105"
        style={{ transition: 'opacity 0.4s ease, transform 0.7s ease', opacity: 1 }}
      />
      {/* Gradient overlays */}
      <div className={`absolute inset-0 bg-gradient-to-br ${accent.gradient}`} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

      {/* Content */}
      <div className="relative z-card flex h-full flex-col justify-between p-4 sm:p-5">
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
          <p className="mt-1 line-clamp-2 text-xs font-light leading-relaxed text-white/85 sm:text-sm">
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

export default function CategoryGrid() {
  const router = useRouter();
  const { location } = useLocation();

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
    <section className="bg-brand-beige">

      {/* ── Page content ─────────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">

        {/* Heading */}
        <div className="mb-7 sm:mb-9">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-copper">
            Utforsk tilbud
          </p>
          <h2 className="mt-2 font-heading text-3xl font-extrabold tracking-tight text-brand-forest sm:text-4xl">
            Finn noe som passer deg
          </h2>
          <p className="mt-2 max-w-xl text-base font-light text-slate-500">
            {location
              ? `Aktiviteter, trening og tilbud nær ${firstPart(location.label)}`
              : 'Sett lokasjon i toppen for å låse opp kategoriene'}
          </p>
        </div>

        {/* ── Category grid ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {[...CATEGORIES, TUR_TILE].map((cat, idx, all) => (
            <CategoryCard
              key={cat.key}
              config={cat}
              selected={false}
              disabled={cat.key === 'tur' ? false : !location}
              onClick={() => (cat.key === 'tur' ? router.push('/tur') : handleCardClick(cat.key))}
              className={[
                'h-52 sm:h-60 lg:h-64',
                idx === all.length - 1 && all.length % 2 !== 0
                  ? 'col-span-2 lg:col-span-1'
                  : '',
              ].filter(Boolean).join(' ')}
            />
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-xl text-center text-sm font-light leading-relaxed text-slate-500">
          Velg en kategori for å se aktiviteter og tilbydere nær deg.
        </p>
      </div>
    </section>
  );
}
