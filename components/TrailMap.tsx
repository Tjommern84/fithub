'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, CircleMarker, Popup, useMap } from 'react-leaflet';
import type { Trail, TrailType } from '../lib/trailsDb';
import type { Settlement } from '../lib/settlementsDb';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DRAMMEN: [number, number] = [59.7440, 10.2045];

const TRAIL_COLORS: Record<TrailType, string> = {
  fotrute: '#16a34a',
  skiloype: '#2563eb',
  sykkelrute: '#f97316',
  annet: '#6b7280',
};

const TRAIL_LABELS: Record<TrailType, string> = {
  fotrute: 'Fotrute',
  skiloype: 'Skiløype',
  sykkelrute: 'Sykkelrute',
  annet: 'Annet',
};

const SETTLEMENT_COLOR = '#a855f7';

function formatDistance(distanceM: number): string {
  if (distanceM < 1000) return '< 1 km';
  return `${(distanceM / 1000).toFixed(1)} km`;
}

// Turrutebasen deler hver rute i mange korte segmenter mellom kryss/knutepunkter —
// samme `name` går over flere `trails`-rader. Grupper på (type, navn) for listevisning.
// Usignerte segmenter får en id-basert nøkkel slik at de ALDRI slås sammen med andre
// usignerte segmenter de ikke faktisk hører til. Kildedata bruker literalen "Ukjent"
// (ikke null/tom streng) for navnløse rader — se scripts/parse-geonorge-trails.ts linje 58 —
// så det må sjekkes eksplisitt her, ikke bare falsy-name.
function getGroupKey(trail: Trail): string {
  const name = trail.name?.trim();
  return name && name !== 'Ukjent' ? `${trail.trailType}::${name}` : `id::${trail.id}`;
}

type GroupSummary = {
  name: string | null;
  trailType: TrailType;
  maintainer: string | null;
  totalLengthKm: number | null;
  trails: Trail[];
};

function summarizeGroup(groupTrails: Trail[]): GroupSummary | null {
  if (groupTrails.length === 0) return null;
  let totalLengthKm: number | null = null;
  for (const t of groupTrails) {
    if (t.lengthKm != null) totalLengthKm = (totalLengthKm ?? 0) + t.lengthKm;
  }
  return {
    name: groupTrails[0].name,
    trailType: groupTrails[0].trailType,
    maintainer: groupTrails[0].maintainer,
    totalLengthKm,
    trails: groupTrails,
  };
}

function BoundsWatcher({ onChange }: { onChange: (bounds: L.LatLngBounds) => void }) {
  const map = useMap();

  useEffect(() => {
    const fire = () => onChange(map.getBounds());
    fire();
    map.on('moveend', fire);
    return () => {
      map.off('moveend', fire);
    };
  }, [map, onChange]);

  return null;
}

function SelectionWatcher({ groupKey, trails }: { groupKey: string | null; trails: Trail[] }) {
  const map = useMap();

  useEffect(() => {
    if (!groupKey || trails.length === 0) return;
    const bounds = L.latLngBounds([]);
    for (const t of trails) {
      for (const point of t.coordinates) bounds.extend(point);
    }
    if (bounds.isValid()) map.fitBounds(bounds, { maxZoom: 16 });
    // Kjør kun når valgt gruppe-nøkkel endres, ikke ved hver refetch av samme gruppe
    // (en ny `trails`-array pr. viewport-fetch ville ellers re-trigget fitBounds
    // og kjempet mot brukerens pan/zoom).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, groupKey]);

  return null;
}

export default function TrailMap() {
  const [center, setCenter] = useState<[number, number]>(DRAMMEN);
  const [trails, setTrails] = useState<Trail[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [showSettlements, setShowSettlements] = useState(true);
  const [visibleTypes, setVisibleTypes] = useState<Record<TrailType, boolean>>({
    fotrute: true,
    skiloype: true,
    sykkelrute: true,
    annet: true,
  });
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const fetchSeq = useRef(0);

  const visibleTrails = useMemo(
    () => trails.filter((t) => visibleTypes[t.trailType]),
    [trails, visibleTypes]
  );

  const groupedTrailList = useMemo(() => {
    const byKey = new Map<string, Trail[]>();
    for (const trail of visibleTrails) {
      const key = getGroupKey(trail);
      const existing = byKey.get(key);
      if (existing) existing.push(trail);
      else byKey.set(key, [trail]);
    }
    const origin = L.latLng(center);
    return Array.from(byKey.entries())
      .map(([key, groupTrails]) => ({
        key,
        ...(summarizeGroup(groupTrails) as GroupSummary),
        distanceM: groupTrails.reduce(
          (min, t) =>
            Math.min(
              min,
              t.coordinates.reduce((m, p) => Math.min(m, origin.distanceTo(L.latLng(p))), Infinity)
            ),
          Infinity
        ),
      }))
      .sort((a, b) => a.distanceM - b.distanceM);
  }, [visibleTrails, center]);

  // Bevisst slått opp fra full `trails` (ikke `visibleTrails`) — samme presedens som
  // tidligere `selectedTrail`: valget skal ikke forsvinne bare fordi brukeren skrur av
  // typen i legend, kun hvis segmentene faller helt utenfor viewport ved panorering.
  const selectedGroup = useMemo(() => {
    if (!selectedGroupKey) return null;
    return summarizeGroup(trails.filter((t) => getGroupKey(t) === selectedGroupKey));
  }, [trails, selectedGroupKey]);

  const allTypesHidden = (Object.keys(visibleTypes) as TrailType[]).every(
    (t) => !visibleTypes[t]
  );

  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter([pos.coords.latitude, pos.coords.longitude]),
      () => {
        /* behold Drammen som fallback */
      },
      { timeout: 8000 }
    );
  }, []);

  const handleBoundsChange = useCallback((bounds: L.LatLngBounds) => {
    const seq = ++fetchSeq.current;
    const params = new URLSearchParams({
      minLon: String(bounds.getWest()),
      minLat: String(bounds.getSouth()),
      maxLon: String(bounds.getEast()),
      maxLat: String(bounds.getNorth()),
    });
    fetch(`/api/trails?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Trail[]) => {
        if (seq === fetchSeq.current) setTrails(data);
      })
      .catch(() => {
        /* ignorer feilede henting, behold forrige resultat */
      });

    fetch(`/api/settlements?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Settlement[]) => {
        if (seq === fetchSeq.current) setSettlements(data);
      })
      .catch(() => {
        /* ignorer feilede henting, behold forrige resultat */
      });
  }, []);

  return (
    <div className="w-full">
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm lg:flex-1" style={{ height: 560 }}>
          <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <BoundsWatcher onChange={handleBoundsChange} />
            <SelectionWatcher groupKey={selectedGroupKey} trails={selectedGroup?.trails ?? []} />

            <Marker position={center}>
              <Popup>Din posisjon</Popup>
            </Marker>

            {visibleTrails.map((trail) => {
              const key = getGroupKey(trail);
              const isSelected = selectedGroupKey !== null && key === selectedGroupKey;
              const isDimmed = selectedGroupKey !== null && !isSelected;
              return (
                <Polyline
                  key={trail.id}
                  positions={trail.coordinates}
                  pathOptions={{
                    color: TRAIL_COLORS[trail.trailType],
                    weight: isSelected ? 6 : 3,
                    opacity: isSelected ? 1 : isDimmed ? 0.4 : 0.8,
                  }}
                  eventHandlers={{ click: () => setSelectedGroupKey(key) }}
                >
                  <Popup>
                    <div className="min-w-[160px]">
                      <p className="font-semibold text-sm leading-snug">{trail.name ?? 'Ukjent rute'}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{TRAIL_LABELS[trail.trailType]}</p>
                      {trail.maintainer && (
                        <p className="text-xs text-slate-500">{trail.maintainer}</p>
                      )}
                      {trail.lengthKm != null && (
                        <p className="text-xs text-slate-400 mt-1">{trail.lengthKm.toFixed(1)} km</p>
                      )}
                    </div>
                  </Popup>
                </Polyline>
              );
            })}

            {showSettlements && settlements.map((settlement) => (
              <CircleMarker
                key={settlement.id}
                center={[settlement.lat, settlement.lon]}
                radius={5}
                pathOptions={{ color: SETTLEMENT_COLOR, fillColor: SETTLEMENT_COLOR, fillOpacity: 0.7, weight: 1 }}
              >
                <Popup>
                  <div className="min-w-[160px]">
                    <p className="font-semibold text-sm leading-snug">{settlement.name ?? 'Ukjent tettsted'}</p>
                    {settlement.municipality && (
                      <p className="text-xs text-slate-500 mt-0.5">{settlement.municipality}</p>
                    )}
                    {settlement.population != null && (
                      <p className="text-xs text-slate-400 mt-1">{settlement.population.toLocaleString('nb-NO')} innbyggere</p>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        <div
          className="w-full overflow-y-auto rounded-xl border border-slate-200 shadow-sm lg:w-80 lg:shrink-0"
          style={{ maxHeight: 560 }}
        >
          {selectedGroup && (
            <div className="relative border-b border-slate-200 bg-slate-50 p-4">
              <button
                type="button"
                onClick={() => setSelectedGroupKey(null)}
                aria-label="Lukk"
                className="absolute right-3 top-3 text-slate-400 transition hover:text-slate-600"
              >
                ✕
              </button>
              <p className="pr-6 font-semibold text-sm leading-snug">{selectedGroup.name ?? 'Ukjent rute'}</p>
              <p className="mt-0.5 text-xs text-slate-500">{TRAIL_LABELS[selectedGroup.trailType]}</p>
              {selectedGroup.maintainer && (
                <p className="text-xs text-slate-500">{selectedGroup.maintainer}</p>
              )}
              {selectedGroup.totalLengthKm != null && (
                <p className="mt-1 text-xs text-slate-400">{selectedGroup.totalLengthKm.toFixed(1)} km</p>
              )}
            </div>
          )}

          {allTypesHidden ? (
            <p className="p-4 text-sm text-slate-500">
              Alle rutetyper er skjult — slå på en type for å se ruter.
            </p>
          ) : groupedTrailList.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Ingen ruter i dette området.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {groupedTrailList.map((group) => (
                <li key={group.key}>
                  <button
                    type="button"
                    onClick={() => setSelectedGroupKey(group.key)}
                    className={[
                      'w-full px-4 py-3 text-left transition hover:bg-slate-50',
                      group.key === selectedGroupKey ? 'bg-slate-100' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: TRAIL_COLORS[group.trailType] }}
                      />
                      <span className="truncate text-sm font-medium text-slate-900">
                        {group.name ?? 'Ukjent rute'}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                      <span>{TRAIL_LABELS[group.trailType]}</span>
                      {group.totalLengthKm != null && <span>· {group.totalLengthKm.toFixed(1)} km</span>}
                      <span>· {formatDistance(group.distanceM)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-slate-600">
        {(Object.keys(TRAIL_LABELS) as TrailType[]).map((type) => (
          <label key={type} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={visibleTypes[type]}
              onChange={(e) =>
                setVisibleTypes((prev) => ({ ...prev, [type]: e.target.checked }))
              }
              className="h-3.5 w-3.5"
            />
            <span className="inline-block w-4 h-1.5 rounded" style={{ backgroundColor: TRAIL_COLORS[type] }} />
            {TRAIL_LABELS[type]}
          </label>
        ))}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showSettlements}
            onChange={(e) => setShowSettlements(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: SETTLEMENT_COLOR }} />
          Tettsteder
        </label>
      </div>
    </div>
  );
}
