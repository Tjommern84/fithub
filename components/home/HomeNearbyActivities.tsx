'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocation } from '../../lib/locationContext';
import { searchServices } from '../../lib/matchingDb';
import type { RankedService } from '../../lib/matching';
import { serviceTypeLabels } from '../../lib/resultFilters';
import { getServiceIllustration } from '../../lib/serviceIllustrations';

export default function HomeNearbyActivities() {
  const { location } = useLocation();
  const [items, setItems] = useState<RankedService[] | null>(null);
  const [hasError, setHasError] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!location) {
      setItems(null);
      setHasError(false);
      return;
    }
    let cancelled = false;
    setHasError(false);
    setItems(null);
    // searchServices() kaster ved RPC-feil — fanget her, ikke latt boble til en error boundary
    searchServices({ lat: location.lat, lon: location.lon, sort: 'nearest', limit: 10 })
      .then((results) => {
        if (!cancelled) setItems(results);
      })
      .catch(() => {
        if (!cancelled) setHasError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [location]);

  // Lokal placeholder — ingen backend-lagring av favoritter ennå
  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!location) return null;

  if (hasError) {
    return (
      <section className="bg-brand-beige py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-heading text-2xl font-bold text-brand-forest">
            Aktiviteter nær deg
          </h2>
          <p className="mt-4 text-sm text-slate-500">
            Kunne ikke hente aktiviteter nær deg akkurat nå. Prøv igjen senere.
          </p>
        </div>
      </section>
    );
  }

  if (items === null) {
    return (
      <section className="bg-brand-beige py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-heading text-2xl font-bold text-brand-forest">
            Aktiviteter nær deg
          </h2>
          <div className="mt-6 flex gap-4 overflow-x-auto pb-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-56 w-64 shrink-0 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="bg-brand-beige py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="font-heading text-2xl font-bold text-brand-forest">
          Aktiviteter nær deg
        </h2>
        <div className="mt-6 flex gap-4 overflow-x-auto pb-2">
          {items.map((item) => {
            const typeLabel =
              (serviceTypeLabels as Record<string, string>)[item.service.type] ?? item.service.type;
            const isFavorite = favorites.has(item.service.id);
            return (
              <Link
                key={item.service.id}
                href={`/tilbyder/${encodeURIComponent(item.service.id)}`}
                className="relative block h-56 w-64 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="relative h-32 w-full bg-slate-100">
                  {item.service.cover_image_url ? (
                    <Image
                      src={item.service.cover_image_url}
                      alt=""
                      fill
                      sizes="256px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-brand-cream text-brand-copper">
                      {getServiceIllustration(item.service)}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      toggleFavorite(item.service.id);
                    }}
                    aria-label={isFavorite ? 'Fjern fra favoritter' : 'Legg til i favoritter'}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-rose-500 shadow"
                  >
                    {isFavorite ? '♥' : '♡'}
                  </button>
                  <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                    {typeLabel}
                  </span>
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {item.service.name}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    {typeof item.distanceKm === 'number' && <span>{item.distanceKm.toFixed(1)} km</span>}
                    {item.service.provider_type === 'facility' ? (
                      <span className="font-medium text-emerald-700">Offentlig anlegg</span>
                    ) : (
                      item.service.rating_avg > 0 && <span>★ {item.service.rating_avg.toFixed(1)}</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
