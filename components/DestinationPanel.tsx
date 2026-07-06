'use client';

import { useEffect, useState } from 'react';
import type { Destination, DestinationType } from '../lib/destinationsDb';
import type { WalkingRoute } from '../lib/orsClient';
import type { TransitStop } from '../app/api/transit/route';

const ICONS: Record<DestinationType, string> = {
  peak: '🏔', lake: '🌊', viewpoint: '👁', shelter: '⛺', hut: '🏠',
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

type Props = {
  destination: Destination;
  userLat: number;
  userLon: number;
  footRoute: WalkingRoute | null;
  footLoading: boolean;
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
  activeMode,
  onModeChange,
  onClose,
}: Props) {
  const [cyclingRoute, setCyclingRoute] = useState<WalkingRoute | null>(null);
  const [cyclingLoading, setCyclingLoading] = useState(false);
  const [transitStops, setTransitStops] = useState<TransitStop[]>([]);
  const [transitLoading, setTransitLoading] = useState(false);
  const [parkingLoading, setParkingLoading] = useState(false);
  const [nearestParking, setNearestParking] = useState<Destination | null>(null);
  const [parkingRoute, setParkingRoute] = useState<WalkingRoute | null>(null);

  // Hent sykkelrute og kollektiv parallelt når panel åpnes
  useEffect(() => {
    setCyclingRoute(null);
    setTransitStops([]);
    setNearestParking(null);
    setParkingRoute(null);

    // Sykkel
    setCyclingLoading(true);
    fetch(`/api/route?dest_id=${destination.id}&user_lat=${userLat}&user_lon=${userLon}&profile=cycling-regular`)
      .then(r => r.ok ? r.json() : null)
      .then((d: WalkingRoute | null) => setCyclingRoute(d))
      .catch(() => {})
      .finally(() => setCyclingLoading(false));

    // Kollektiv (Entur) — fra destinasjonen (avreise der)
    setTransitLoading(true);
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
    setParkingLoading(true);
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
        // Gå-rute fra parkering til destinasjon
        const r = await fetch(`/api/route?dest_id=${destination.id}&user_lat=${p.lat}&user_lon=${p.lon}&profile=foot-walking`);
        if (r.ok) setParkingRoute(await r.json());
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
      onClick={() => onModeChange(mode, coords)}
      className={[
        'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition',
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
    <div className="relative border-b border-slate-200 bg-white">
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
              : 'Ingen rute funnet',
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
                  {parkingRoute && ` · ${parkingRoute.distanceKm.toFixed(1)} km å gå derfra`}</>
              : parkingLoading ? null : 'Ingen navngitt parkering funnet i nærheten',
            parkingLoading,
            parkingRoute?.coordinates
          )}

          {modeButton(
            'transit', '🚌', 'Kollektivt',
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
