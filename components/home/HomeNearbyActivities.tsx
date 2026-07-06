'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocation } from '../../lib/locationContext';
import { searchServices } from '../../lib/matchingDb';
import type { RankedService } from '../../lib/matching';
import { getNearestTrails, type NearestTrail } from '../../lib/trailsDb';
import { getServiceIllustration } from '../../lib/serviceIllustrations';

const TRAIL_TYPE_LABELS: Record<NearestTrail['trailType'], string> = {
  fotrute: 'Fotrute',
  skiloype: 'Skiløype',
  sykkelrute: 'Sykkelrute',
  annet: 'Annet',
};

// get_nearest_trails() returnerer rå, ufragmenterte Geonorge-segmenter — samme rute kan derfor
// dukke opp som flere kort (bekreftet: "Gulskgen – Konnerudkollen" ×3). Gruppér på (name,
// trailType) som /tur sin "Tillegg 1"-fiks (getGroupKey() i TrailMap.tsx) — enklere her siden
// RPC-en kun returnerer id/name/trailType/lengthKm/distanceKm, ingen koordinater. Det betyr vi
// IKKE kan gjøre /tur sin koblings-baserte kjeding (Tillegg 2, krever segment-endepunkter).
//
// "Ukjent"-rader (RPC-en filtrerer på name IS NOT NULL, men literalen "Ukjent" er en streng,
// ikke NULL, og slipper gjennom) grupperes BEVISST IKKE — uten geometri har vi ingen måte å
// vite om to "Ukjent"-rader er fysisk samme rute, og en feilaktig sammenslåing er verre enn
// ingen sammenslåing. Hver "Ukjent"-rad vises derfor som i dag, én rad pr. id.
function groupNearestTrails(trails: NearestTrail[]): NearestTrail[] {
  const groups = new Map<string, NearestTrail[]>();
  for (const trail of trails) {
    const name = trail.name?.trim();
    const isReal = !!name && name !== 'Ukjent';
    const key = isReal ? `${trail.trailType}::${name}` : `id::${trail.id}`;
    const existing = groups.get(key);
    if (existing) existing.push(trail);
    else groups.set(key, [trail]);
  }

  const result: NearestTrail[] = [];
  for (const groupTrails of groups.values()) {
    if (groupTrails.length === 1) {
      result.push(groupTrails[0]);
      continue;
    }
    // Nærmeste segment sin avstand representerer gruppen. Lengde summeres — null bidrar ikke
    // til summen, men resultatet forblir null (ikke 0) hvis ALLE segmenter mangler lengdedata.
    let totalLengthKm: number | null = null;
    let minDistanceKm = Infinity;
    for (const t of groupTrails) {
      if (t.lengthKm != null) totalLengthKm = (totalLengthKm ?? 0) + t.lengthKm;
      if (t.distanceKm < minDistanceKm) minDistanceKm = t.distanceKm;
    }
    result.push({
      id: groupTrails[0].id,
      name: groupTrails[0].name,
      trailType: groupTrails[0].trailType,
      lengthKm: totalLengthKm,
      distanceKm: minDistanceKm,
    });
  }
  return result;
}

type NearbyCard =
  | { kind: 'facility'; distanceKm: number | undefined; item: RankedService }
  | { kind: 'trail'; distanceKm: number; trail: NearestTrail };

export default function HomeNearbyActivities() {
  const { location } = useLocation();
  const [cards, setCards] = useState<NearbyCard[] | null>(null);
  const [hasError, setHasError] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!location) {
      setCards(null);
      setHasError(false);
      return;
    }
    let cancelled = false;
    setHasError(false);
    setCards(null);

    // searchServices() kaster ved RPC-feil — fanget her, ikke latt boble til en error boundary.
    // getNearestTrails() feiler gracefully til [] internt (RPC ikke kjørt mot DB ennå) —
    // ingen try/catch nødvendig for den her.
    Promise.all([
      searchServices({ lat: location.lat, lon: location.lon, sort: 'nearest', radiusKm: 30, limit: 50 })
        .then((results) => results.filter((item) => item.service.provider_type === 'facility'))
        .catch(() => {
          if (!cancelled) setHasError(true);
          return [] as RankedService[];
        }),
      getNearestTrails(location.lat, location.lon, 30, 10),
    ]).then(([facilities, trails]) => {
      if (cancelled) return;
      const facilityCards: NearbyCard[] = facilities.map((item) => ({
        kind: 'facility',
        distanceKm: item.distanceKm,
        item,
      }));
      const trailCards: NearbyCard[] = groupNearestTrails(trails).map((trail) => ({
        kind: 'trail',
        distanceKm: trail.distanceKm,
        trail,
      }));
      const merged = [...facilityCards, ...trailCards].sort((a, b) => {
        const aDist = a.distanceKm ?? Number.POSITIVE_INFINITY;
        const bDist = b.distanceKm ?? Number.POSITIVE_INFINITY;
        return aDist - bDist;
      });
      setCards(merged.slice(0, 10));
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

  if (cards === null) {
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

  if (cards.length === 0) return null;

  return (
    <section className="bg-brand-beige py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="font-heading text-2xl font-bold text-brand-forest">
          Aktiviteter nær deg
        </h2>
        <div className="mt-6 flex gap-4 overflow-x-auto pb-2">
          {cards.map((card) => {
            if (card.kind === 'trail') {
              const { trail } = card;
              return (
                <Link
                  key={`trail-${trail.id}`}
                  href="/tur"
                  className="relative block h-56 w-64 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                >
                  <div className="flex h-32 w-full items-center justify-center bg-brand-cream text-brand-copper">
                    <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 19l5-14 4 10 3-6 6 10H3z" />
                    </svg>
                    <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                      {TRAIL_TYPE_LABELS[trail.trailType]}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {trail.name ?? 'Turrute'}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span>{trail.distanceKm.toFixed(1)} km unna</span>
                      {typeof trail.lengthKm === 'number' && <span>· {trail.lengthKm.toFixed(1)} km lang</span>}
                    </div>
                  </div>
                </Link>
              );
            }

            const { item } = card;
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
                    Offentlig anlegg
                  </span>
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {item.service.name}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    {typeof item.distanceKm === 'number' && <span>{item.distanceKm.toFixed(1)} km</span>}
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
