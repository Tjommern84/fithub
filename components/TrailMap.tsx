'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import type { Trail, TrailType } from '../lib/trailsDb';
import type { Settlement } from '../lib/settlementsDb';
import type { Destination, DestinationType } from '../lib/destinationsDb';
import type { WalkingRoute } from '../lib/orsClient';
import DestinationPanel from './DestinationPanel';
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

const DESTINATION_COLORS: Record<DestinationType, string> = {
  peak:      '#f59e0b',   // amber — fjelltoppar
  lake:      '#3b82f6',   // blue — tjern/vann
  viewpoint: '#8b5cf6',   // violet — utsikt
  shelter:   '#10b981',   // emerald — gapahuk
  hut:       '#ef4444',   // red — hytter
};

const DESTINATION_ICONS: Record<DestinationType, string> = {
  peak:      '🏔',
  lake:      '🌊',
  viewpoint: '👁',
  shelter:   '⛺',
  hut:       '🏠',
};

const ROUTE_COLOR = '#f97316'; // oransje — bereknet rute til destinasjon

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

function isRealName(name: string | null | undefined): boolean {
  const trimmed = name?.trim();
  return !!trimmed && trimmed !== 'Ukjent';
}

type ChainedGroup = GroupSummary & { key: string };
type ChainedGroupsResult = { groups: ChainedGroup[]; trailIdToKey: Map<string, string> };

// Koblings-basert kjeding (Tillegg 2): navne-gruppering (over) løser ~70% av tilfellene —
// fysisk sammenhengende segmenter med FORSKJELLIG navn (kommunegrense-artefakt i Geonorge
// sin kildedata, bekreftet empirisk: 26% av tilstøtende segmentpar) eller "Ukjent" (egen
// id-basert gruppe pr. segment) grupperes fortsatt ikke av navne-passet alene. Dette legger
// et kjede-pass PÅ TOPP: to navne-grupper av samme trailType slås sammen hvis et segment i
// den ene deler et endepunkt (innenfor ~30m ekte avstand) med et segment i den andre.
//
// Rutenett-bucket for ytelse (ikke O(n²)): cellestørrelse 0,0005° er ~55m i breddegrad-
// retning — alltid det STØRSTE av lat/lon-celle-arealet uansett breddegrad (lengdegrad-celler
// krymper mot polene, aldri motsatt) — så en 3×3-nabolagssjekk dekker komfortabelt 30m-
// terskelen selv for endepunkt nær en cellegrense.
//
// Sikkerhetsregel mot feilaktig sammenslåing ved ekte kryss: tell DISTINKTE navne-grupper
// (ikke rå segment-antall) som møtes i et punkt. Eksakt 2 → kjed sammen. 3+ → sannsynlig
// reelt trekryss (f.eks. knutepunkt i en marka) — la stå ugruppert, bevisst konservativt.
function buildChainedGroups(inputTrails: Trail[]): ChainedGroupsResult {
  const nameGroups = new Map<string, Trail[]>();
  for (const trail of inputTrails) {
    const key = getGroupKey(trail);
    const existing = nameGroups.get(key);
    if (existing) existing.push(trail);
    else nameGroups.set(key, [trail]);
  }

  // Union-find over navne-gruppe-nøkler
  const parent = new Map<string, string>();
  for (const key of nameGroups.keys()) parent.set(key, key);
  const find = (k: string): string => {
    let root = k;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = k;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const CELL_DEG = 0.0005;
  const THRESHOLD_M = 30;
  const cellOf = (v: number) => Math.round(v / CELL_DEG);

  type EndpointRef = { trailId: string; groupKey: string; trailType: TrailType; point: [number, number] };
  const buckets = new Map<string, EndpointRef[]>();
  const endpoints: EndpointRef[] = [];

  for (const [groupKey, groupTrails] of nameGroups) {
    for (const trail of groupTrails) {
      if (trail.coordinates.length === 0) continue;
      const start = trail.coordinates[0];
      const end = trail.coordinates[trail.coordinates.length - 1];
      endpoints.push({ trailId: trail.id, groupKey, trailType: trail.trailType, point: start });
      endpoints.push({ trailId: trail.id, groupKey, trailType: trail.trailType, point: end });
    }
  }
  for (const ep of endpoints) {
    const bucketKey = `${ep.trailType}::${cellOf(ep.point[0])}_${cellOf(ep.point[1])}`;
    const arr = buckets.get(bucketKey);
    if (arr) arr.push(ep);
    else buckets.set(bucketKey, [ep]);
  }

  for (const ep of endpoints) {
    const latC = cellOf(ep.point[0]);
    const lonC = cellOf(ep.point[1]);
    const nearbyGroupKeys = new Set<string>([ep.groupKey]);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const candidates = buckets.get(`${ep.trailType}::${latC + dx}_${lonC + dy}`);
        if (!candidates) continue;
        for (const other of candidates) {
          if (other.trailId === ep.trailId) continue;
          if (L.latLng(ep.point).distanceTo(L.latLng(other.point)) <= THRESHOLD_M) {
            nearbyGroupKeys.add(other.groupKey);
          }
        }
      }
    }
    // Eksakt 2 distinkte grupper møtes → trygg kobling. 1 = ingen nabo. 3+ = reelt kryss, hopp over.
    if (nearbyGroupKeys.size === 2) {
      const [a, b] = Array.from(nearbyGroupKeys);
      union(a, b);
    }
  }

  const rootToKeys = new Map<string, string[]>();
  for (const key of nameGroups.keys()) {
    const root = find(key);
    const arr = rootToKeys.get(root);
    if (arr) arr.push(key);
    else rootToKeys.set(root, [key]);
  }

  const groups: ChainedGroup[] = [];
  const trailIdToKey = new Map<string, string>();
  for (const memberKeys of rootToKeys.values()) {
    const sortedKeys = [...memberKeys].sort();
    // Sortert kombinasjon av underliggende nøkler — stabil/deterministisk uavhengig av
    // beregningsrekkefølge (union-find sin root kan variere mellom kjøringer).
    const chainKey = sortedKeys.length === 1 ? sortedKeys[0] : `chain::${sortedKeys.join('|')}`;
    const allTrails = sortedKeys.flatMap((k) => nameGroups.get(k)!);

    // Representant-navn: største navngitte undergruppe vinner over "Ukjent" uavhengig av
    // størrelse; blant grupper med samme navngitt-status, størst segment-antall vinner.
    let bestKey = sortedKeys[0];
    for (const k of sortedKeys.slice(1)) {
      const candidate = nameGroups.get(k)!;
      const best = nameGroups.get(bestKey)!;
      const candidateNamed = isRealName(candidate[0].name);
      const bestNamed = isRealName(best[0].name);
      if (candidateNamed && !bestNamed) { bestKey = k; continue; }
      if (!candidateNamed && bestNamed) continue;
      if (candidate.length > best.length) bestKey = k;
    }
    const representative = summarizeGroup(nameGroups.get(bestKey)!)!;
    const full = summarizeGroup(allTrails)!;

    groups.push({
      key: chainKey,
      name: representative.name,
      trailType: representative.trailType,
      maintainer: representative.maintainer,
      totalLengthKm: full.totalLengthKm,
      trails: allTrails,
    });
    for (const t of allTrails) trailIdToKey.set(t.id, chainKey);
  }

  return { groups, trailIdToKey };
}

function MapClickHandler({ enabled, onMapClick }: {
  enabled: boolean;
  onMapClick: (pos: [number, number]) => void;
}) {
  useMapEvents({
    click(e) {
      if (enabled) onMapClick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
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

export default function TrailMap({ initialDestId }: { initialDestId?: string }) {
  const [center, setCenter] = useState<[number, number]>(DRAMMEN);
  const [trails, setTrails] = useState<Trail[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [showSettlements, setShowSettlements] = useState(true);
  const [showDestinations, setShowDestinations] = useState(true);
  const [selectedDestId, setSelectedDestId] = useState<string | null>(initialDestId ?? null);
  const [footRoute, setFootRoute] = useState<WalkingRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  // Hvilken rute som faktisk vises på kartet (kan overstyres av panel-modusen)
  const [activeRouteCoords, setActiveRouteCoords] = useState<[number, number][]>([]);
  const [activeRouteColor, setActiveRouteColor] = useState(ROUTE_COLOR);
  const [activeMode, setActiveMode] = useState<'foot' | 'cycling' | 'car' | 'transit'>('foot');
  const [pinMode, setPinMode] = useState(false);
  const [pinPosition, setPinPosition] = useState<[number, number] | null>(null);
  const [pinKey, setPinKey] = useState(0);
  const startPoint: [number, number] = pinPosition ?? center;
  const [visibleTypes, setVisibleTypes] = useState<Record<TrailType, boolean>>({
    fotrute: true,
    skiloype: true,
    sykkelrute: true,
    annet: true,
  });
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  // Skjul ferdig-kjedede grupper der SAMLET lengde er under 1 km — standard PÅ (skjult),
  // siden motivasjonen ("rotete kart, vanskelig å finne lange ruter") gjelder de fleste
  // brukstilfeller. Reversibel checkbox i stedet for en hardkodet regel, siden det gir
  // brukeren en vei tilbake uten kodeendring (samme filosofi som type-/Tettsteder-toggles).
  const [hideShortTrails, setHideShortTrails] = useState(true);
  const fetchSeq = useRef(0);

  const visibleTrails = useMemo(
    () => trails.filter((t) => visibleTypes[t.trailType]),
    [trails, visibleTypes]
  );

  const chainedVisible = useMemo(() => buildChainedGroups(visibleTrails), [visibleTrails]);

  // Filtreres på gruppens TOTALE lengde etter kjeding, ikke enkeltsegmenter — en lang rute
  // bygget av mange korte Geonorge-segmenter (f.eks. "Gulskogen – Konnerudkollen" sine
  // 24×~0,1 km) skal IKKE brytes opp eller skjules siden den TOTALT er over 1 km.
  // `totalLengthKm === null` betyr at INGEN segmenter i gruppen har lengdedata i kildedata —
  // usikker lengde er ikke det samme som bekreftet kort, så disse vises uansett.
  const visibleGroups = useMemo(() => {
    if (!hideShortTrails) return chainedVisible.groups;
    return chainedVisible.groups.filter(
      (g) => g.totalLengthKm === null || g.totalLengthKm >= 1
    );
  }, [chainedVisible, hideShortTrails]);

  // Samme filtrerte sett brukes til BÅDE kart-Polyline-rendering og listepanelet under —
  // ett sannhetssted, som resten av filen allerede er bygget opp etter.
  const keptTrailIds = useMemo(
    () => new Set(visibleGroups.flatMap((g) => g.trails.map((t) => t.id))),
    [visibleGroups]
  );

  const sortedDestinationList = useMemo(() => {
    if (!showDestinations) return [];
    const origin = L.latLng(startPoint);
    return [...destinations]
      .map(d => ({ ...d, distanceM: origin.distanceTo(L.latLng([d.lat, d.lon])) }))
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, 20);
  }, [destinations, center, showDestinations]);

  const groupedTrailList = useMemo(() => {
    const origin = L.latLng(startPoint);
    return visibleGroups
      .map((group) => ({
        ...group,
        distanceM: group.trails.reduce(
          (min, t) =>
            Math.min(
              min,
              t.coordinates.reduce((m, p) => Math.min(m, origin.distanceTo(L.latLng(p))), Infinity)
            ),
          Infinity
        ),
      }))
      .sort((a, b) => a.distanceM - b.distanceM);
  }, [visibleGroups, center]);

  // Bevisst kjedet fra full `trails` (ikke `visibleTrails`) — samme presedens som tidligere
  // (kun navne-basert) selectedGroup: valget skal ikke forsvinne bare fordi brukeren skrur av
  // typen i legend, kun hvis segmentene faller helt utenfor viewport ved panorering.
  const chainedFull = useMemo(() => buildChainedGroups(trails), [trails]);
  const selectedGroup = useMemo(() => {
    if (!selectedGroupKey) return null;
    return chainedFull.groups.find((g) => g.key === selectedGroupKey) ?? null;
  }, [chainedFull, selectedGroupKey]);

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
      .then((res) => res.ok ? res.json() : null)
      .then((data: Trail[] | null) => {
        if (data !== null && seq === fetchSeq.current) setTrails(data);
      })
      .catch(() => {});

    fetch(`/api/settlements?${params.toString()}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data: Settlement[] | null) => {
        if (data !== null && seq === fetchSeq.current) setSettlements(data);
      })
      .catch(() => {});

    fetch(`/api/destinations?${params.toString()}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data: Destination[] | null) => {
        if (data !== null && seq === fetchSeq.current) setDestinations(data);
      })
      .catch(() => {});
  }, []);

  const selectedDestination = useMemo(
    () => destinations.find(d => d.id === selectedDestId) ?? null,
    [destinations, selectedDestId]
  );

  const handleSelectDestination = useCallback((dest: Destination) => {
    setSelectedDestId(dest.id);
    setFootRoute(null);
    setActiveRouteCoords([]);
    setActiveMode('foot');
    setActiveRouteColor(ROUTE_COLOR);
    setRouteLoading(true);
    const [userLat, userLon] = startPoint;
    fetch(`/api/route?dest_id=${dest.id}&user_lat=${userLat}&user_lon=${userLon}&profile=foot-walking`)
      .then(res => res.ok ? res.json() : null)
      .then((data: WalkingRoute | null) => {
        if (data) {
          setFootRoute(data);
          setActiveRouteCoords(data.coordinates);
        }
      })
      .catch(() => {})
      .finally(() => setRouteLoading(false));
  }, [center]);

  const handleModeChange = useCallback((
    mode: 'foot' | 'cycling' | 'car' | 'transit',
    coords?: [number, number][]
  ) => {
    setActiveMode(mode);
    const colors: Record<string, string> = {
      foot: ROUTE_COLOR,
      cycling: '#16a34a',
      car: '#3b82f6',
      transit: '#8b5cf6',
    };
    setActiveRouteColor(colors[mode] ?? ROUTE_COLOR);
    setActiveRouteCoords(coords ?? []);
  }, []);

  return (
    <div className="w-full">
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm lg:flex-1" style={{ height: 560 }}>
          <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxZoom={19}
            />

            <BoundsWatcher onChange={handleBoundsChange} />
            <SelectionWatcher groupKey={selectedGroupKey} trails={selectedGroup?.trails ?? []} />
            <MapClickHandler
              enabled={pinMode}
              onMapClick={(pos) => {
                setPinPosition(pos);
                setPinKey(k => k + 1);
                setActiveRouteCoords([]);
                setFootRoute(null);
                setSelectedDestId(null);
              }}
            />

            {pinPosition && (
              <Marker
                key={`startpin-${pinKey}`}
                position={pinPosition}
                draggable
                icon={L.divIcon({
                  html: `<div style="background:#f97316;width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,.4)"></div>`,
                  className: '',
                  iconSize: [26, 26],
                  iconAnchor: [13, 26],
                })}
                eventHandlers={{
                  dragend(e) {
                    const { lat, lng } = e.target.getLatLng();
                    setPinPosition([lat, lng]);
                  },
                }}
              >
                <Popup>Startpunkt for turen</Popup>
              </Marker>
            )}

            <Marker position={center}>
              <Popup>Din posisjon</Popup>
            </Marker>

            {visibleTrails.filter((trail) => keptTrailIds.has(trail.id)).map((trail) => {
              const key = chainedVisible.trailIdToKey.get(trail.id) ?? getGroupKey(trail);
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

            {showDestinations && (
              <MarkerClusterGroup chunkedLoading>
                {destinations.map((dest) => {
                  const color = DESTINATION_COLORS[dest.destinationType] ?? '#f59e0b';
                  const icon = L.divIcon({
                    html: `<div style="background:${color};width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.3);${dest.id === selectedDestId ? 'outline:2px solid ' + color + ';outline-offset:2px' : ''}">${DESTINATION_ICONS[dest.destinationType] ?? '📍'}</div>`,
                    className: '',
                    iconSize: [22, 22],
                    iconAnchor: [11, 11],
                  });
                  return (
                    <Marker
                      key={dest.id}
                      position={[dest.lat, dest.lon]}
                      icon={icon}
                      eventHandlers={{ click: () => handleSelectDestination(dest) }}
                    >
                      <Popup>
                        <div className="min-w-[140px]">
                          <p className="font-semibold text-sm">{DESTINATION_ICONS[dest.destinationType]} {dest.name}</p>
                          {dest.elevationM != null && (
                            <p className="text-xs text-slate-500 mt-0.5">{dest.elevationM} moh</p>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MarkerClusterGroup>
            )}

            {/* Aktiv rute til valgt destinasjon */}
            {activeRouteCoords.length > 0 && (
              <Polyline
                positions={activeRouteCoords.map(([lon, lat]) => [lat, lon])}
                pathOptions={{ color: activeRouteColor, weight: 5, opacity: 0.9 }}
              />
            )}

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
          className="w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-sm lg:w-80 lg:shrink-0"
          style={{ maxHeight: 560 }}
        >
          {selectedDestination && (
            <DestinationPanel
              destination={selectedDestination}
              userLat={startPoint[0]}
              userLon={startPoint[1]}
              footRoute={footRoute}
              footLoading={routeLoading}
              activeMode={activeMode}
              onModeChange={handleModeChange}
              onClose={() => {
                setSelectedDestId(null);
                setActiveRouteCoords([]);
                setFootRoute(null);
              }}
            />
          )}

          {selectedGroup && (
            <div className="relative border-b border-slate-100 bg-brand-cream p-4">
              <button
                type="button"
                onClick={() => setSelectedGroupKey(null)}
                aria-label="Lukk"
                className="absolute right-3 top-3 text-slate-400 transition hover:text-slate-600"
              >
                ✕
              </button>
              <p className="pr-6 font-heading text-sm font-bold leading-snug text-slate-900">
                {selectedGroup.name ?? 'Ukjent rute'}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                  style={{ backgroundColor: TRAIL_COLORS[selectedGroup.trailType] }}
                >
                  {TRAIL_LABELS[selectedGroup.trailType]}
                </span>
                {selectedGroup.totalLengthKm != null && (
                  <span className="text-xs text-slate-500">{selectedGroup.totalLengthKm.toFixed(1)} km</span>
                )}
              </div>
              {selectedGroup.maintainer && (
                <p className="mt-1 text-xs text-slate-400">{selectedGroup.maintainer}</p>
              )}
            </div>
          )}

          {sortedDestinationList.length > 0 && (
            <div className="border-b border-slate-200">
              <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Turmål i nærheten
              </p>
              <ul className="divide-y divide-slate-100">
                {sortedDestinationList.map(dest => (
                  <li key={dest.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectDestination(dest)}
                      className={[
                        'w-full px-4 py-2.5 text-left transition hover:bg-amber-50',
                        dest.id === selectedDestId ? 'bg-amber-50' : '',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 text-sm">{DESTINATION_ICONS[dest.destinationType]}</span>
                        <span className="truncate text-sm font-medium text-slate-900">{dest.name}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 pl-6 text-xs text-slate-500">
                        {dest.elevationM != null && <span>{dest.elevationM} moh</span>}
                        <span>· {formatDistance(dest.distanceM)}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {allTypesHidden ? (
            <p className="p-4 text-sm text-slate-500">
              Alle rutetyper er skjult — slå på en type for å se ruter.
            </p>
          ) : groupedTrailList.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Ingen ruter i dette området.</p>
          ) : (
            <ul className="space-y-1.5 p-2">
              {groupedTrailList.map((group) => {
                const isSelected = group.key === selectedGroupKey;
                return (
                  <li key={group.key}>
                    <button
                      type="button"
                      onClick={() => setSelectedGroupKey(group.key)}
                      className={[
                        'w-full rounded-xl border p-3 text-left transition-all',
                        isSelected
                          ? 'border-brand-copper bg-brand-cream ring-1 ring-brand-copper'
                          : 'border-slate-100 bg-white shadow-sm hover:border-slate-200 hover:shadow',
                      ].join(' ')}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: TRAIL_COLORS[group.trailType] }}
                        />
                        <span className="truncate text-sm font-medium text-slate-900">
                          {group.name ?? 'Ukjent rute'}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-4">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                          style={{ backgroundColor: TRAIL_COLORS[group.trailType] }}
                        >
                          {TRAIL_LABELS[group.trailType]}
                        </span>
                        {group.totalLengthKm != null && (
                          <span className="text-[11px] text-slate-500">{group.totalLengthKm.toFixed(1)} km</span>
                        )}
                        <span className="text-[11px] text-slate-400">{formatDistance(group.distanceM)}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
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
            checked={showDestinations}
            onChange={(e) => setShowDestinations(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: DESTINATION_COLORS.peak }} />
          Turmål
        </label>
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
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={hideShortTrails}
            onChange={(e) => setHideShortTrails(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          Skjul korte ruter (&lt;1 km)
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={pinMode}
            onChange={(e) => {
              setPinMode(e.target.checked);
              if (!e.target.checked) setPinPosition(null);
            }}
            className="h-3.5 w-3.5"
          />
          📍 Sett startpunkt
        </label>
        {pinMode && !pinPosition && (
          <span className="text-xs text-slate-500 italic">Klikk på kartet for å plassere startpunktet</span>
        )}
      </div>
    </div>
  );
}
