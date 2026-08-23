'use client';

import { useEffect, useState } from 'react';
import type { Destination, DestinationType, RouteDestination } from '../lib/destinationsDb';
import type { WalkingRoute } from '../lib/orsClient';
import type { TransitStop } from '../app/api/transit/route';

const ICONS: Record<DestinationType, string> = {
  peak: '🏔', lake: '🌊', viewpoint: '👁', shelter: '⛺', hut: '🏠',
  parking: 'P',
};

function fmt(min: number): string {
  return min >= 60 ? `${Math.floor(min / 60)}t ${min % 60}min` : `${min}min`;
}

function fmtDep(expectedTime: string): string {
  const diff = (new Date(expectedTime).getTime() - Date.now()) / 60000;
  if (diff < 1) return 'Nå';
  if (diff < 60) return `Om ${Math.round(diff)} min`;
  return new Date(expectedTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

type ActiveMode = 'foot' | 'cycling' | 'car' | 'transit';

function routeUrl(
  destination: RouteDestination,
  fromLat: number,
  fromLon: number,
  profile: 'foot-walking' | 'cycling-regular' | 'driving-car',
): string {
  const params = new URLSearchParams({
    user_lat: String(fromLat),
    user_lon: String(fromLon),
    profile,
  });
  if (destination.routeByCoordinates) {
    params.set('dest_lat', String(destination.lat));
    params.set('dest_lon', String(destination.lon));
  } else {
    params.set('dest_id', destination.id);
  }
  return `/api/route?${params.toString()}`;
}

type Props = {
  destination: RouteDestination;
  userLat: number;
  userLon: number;
  footRoute: WalkingRoute | null;
  footLoading: boolean;
  footError?: string | null;
  activeMode: ActiveMode;
  onModeChange: (mode: ActiveMode, coords?: [number, number][]) => void;
  onClose: () => void;
};

export default function DestinationPanel({
  destination,
  userLat,
  userLon,
  footRoute,
  footLoading,
  footError,
  activeMode,
  onModeChange,
  onClose,
}: Props) {
  const [cyclingRoute, setCyclingRoute] = useState<WalkingRoute | null>(null);
  const [cyclingLoading, setCyclingLoading] = useState(true);
  const [transitStops, setTransitStops] = useState<TransitStop[]>([]);
  const [transitLoading, setTransitLoading] = useState(true);
  const [parkingLoading, setParkingLoading] = useState(true);
  const [nearestParking, setNearestParking] = useState<Destination | null>(null);
  const [drivingRoute, setDrivingRoute] = useState<WalkingRoute | null>(null);
  const [parkingRoute, setParkingRoute] = useState<WalkingRoute | null>(null);

  // Hent sykkelrute og kollektiv parallelt når panel åpnes
  useEffect(() => {
    // Sykkel
    fetch(routeUrl(destination, userLat, userLon, 'cycling-regular'))
      .then(r => r.ok ? r.json() : null)
      .then((d: WalkingRoute | null) => setCyclingRoute(d))
      .catch(() => {})
      .finally(() => setCyclingLoading(false));

    // Kollektiv (Entur) — fra destinasjonen (avreise der)
    fetch('/api/transit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: destination.lat, lon: destination.lon }),
    })
      .then(r => r.ok ? r.json() : [])
      .then((d: TransitStop[]) => setTransitStops(d))
      .catch(() => {})
      .finally(() => setTransitLoading(false));

    // Nærmeste parkering → gå derfra til destinasjon
    const bbox = 0.02; // ~2km
    fetch(`/api/destinations?minLon=${destination.lon - bbox}&minLat=${destination.lat - bbox}&maxLon=${destination.lon + bbox}&maxLat=${destination.lat + bbox}&types=parking`)
      .then(r => r.ok ? r.json() : [])
      .then(async (places: Destination[]) => {
        if (!places.length) return;
        // Sorter på avstand til destinasjon
        const sorted = places.sort((a, b) => {
          const da = Math.hypot(a.lat - destination.lat, a.lon - destination.lon);
          const db = Math.hypot(b.lat - destination.lat, b.lon - destination.lon);
          return da - db;
        });
        const p = sorted[0];
        setNearestParking(p);
        // Bilrute til parkeringen + gå-rute videre til turmålet.
        const [driveResponse, walkResponse] = await Promise.all([
          fetch(routeUrl(p, userLat, userLon, 'driving-car')),
          fetch(routeUrl(destination, p.lat, p.lon, 'foot-walking')),
        ]);
        if (driveResponse.ok) setDrivingRoute(await driveResponse.json());
        if (walkResponse.ok) setParkingRoute(await walkResponse.json());
      })
      .catch(() => {})
      .finally(() => setParkingLoading(false));
  }, [destination, userLat, userLon]);

  const modeButton = (
    mode: ActiveMode,
    icon: string,
    label: string,
    detail: React.ReactNode,
    loading: boolean,
    coords?: [number, number][]
  ) => (
    <button
      type="button"
      disabled={loading}
      onClick={() => onModeChange(mode, coords)}
      className={[
        'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition',
        loading ? 'cursor-wait opacity-70' : '',
        activeMode === mode ? 'bg-brand-cream ring-1 ring-brand-copper' : 'hover:bg-slate-50',
      ].join(' ')}
    >
      <span className="mt-0.5 text-lg">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        {loading ? (
          <p className="text-xs text-slate-400">Beregner…</p>
        ) : (
          <div className="text-xs text-slate-500">{detail}</div>
        )}
      </div>
      {activeMode === mode && (
        <span className="mt-0.5 shrink-0 text-brand-copper">✓</span>
      )}
    </button>
  );

  return (
    <div data-testid="destination-panel" className="relative border-b border-slate-200 bg-white">
      <button
        type="button"
        onClick={onClose}
        aria-label="Lukk"
        className="absolute right-3 top-3 text-slate-400 transition hover:text-slate-600"
      >
        ✕
      </button>

      {/* Destinasjonsheader */}
      <div className="border-b border-slate-100 bg-amber-50 px-4 py-3">
        <p className="pr-6 font-semibold text-sm text-slate-900">
          {ICONS[destination.destinationType] ?? '📍'} {destination.name}
        </p>
        {destination.elevationM != null && (
          <p className="mt-0.5 text-xs text-slate-500">{destination.elevationM} moh</p>
        )}
      </div>

      {/* Reisemåter */}
      <div className="px-3 py-2">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Hvordan vil du komme deg dit?
        </p>
        <div className="space-y-1">

          {modeButton(
            'foot', '🚶', 'Til fots',
            footRoute
              ? <>{footRoute.distanceKm.toFixed(1)} km · {fmt(footRoute.durationMin)}
                  {footRoute.elevationGainM != null && ` · +${footRoute.elevationGainM} hm`}</>
              : <span className={footError ? 'text-red-600' : undefined}>
                  {footError ?? 'Ingen rute funnet'}
                </span>,
            footLoading,
            footRoute?.coordinates
          )}

          {modeButton(
            'cycling', '🚲', 'Sykkel',
            cyclingRoute
              ? <>{cyclingRoute.distanceKm.toFixed(1)} km · {fmt(cyclingRoute.durationMin)}</>
              : cyclingLoading ? null : 'Ingen sykkelrute funnet',
            cyclingLoading,
            cyclingRoute?.coordinates
          )}

          {modeButton(
            'car', '🚗', 'Med bil',
            nearestParking
              ? <>Parkering: <span className="font-medium">{nearestParking.name}</span>
                  {drivingRoute && ` · ${fmt(drivingRoute.durationMin)} med bil`}
                  {parkingRoute && ` · ${parkingRoute.distanceKm.toFixed(1)} km å gå derfra`}</>
              : parkingLoading ? null : 'Ingen navngitt parkering funnet i nærheten',
            parkingLoading,
            drivingRoute && parkingRoute
              ? [...drivingRoute.coordinates, ...parkingRoute.coordinates]
              : drivingRoute?.coordinates ?? parkingRoute?.coordinates
          )}

          {modeButton(
            'transit', '🚌', 'Kollektiv nær målet',
            transitStops.length > 0
              ? <>
                  {transitStops.slice(0, 2).map(s => (
                    <span key={s.id} className="block">
                      {s.name}:{' '}
                      {s.departures.slice(0, 2).map((d, i) => (
                        <span key={i}>
                          {i > 0 && ', '}
                          {d.line} → {d.destination} {fmtDep(d.expectedTime)}
                        </span>
                      ))}
                    </span>
                  ))}
                </>
              : transitLoading ? null : 'Ingen holdeplasser funnet i nærheten',
            transitLoading
          )}

        </div>
      </div>
    </div>
  );
}
