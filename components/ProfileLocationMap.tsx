'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icons broken by webpack — kopiert fra ServiceMap.tsx (ikke importert,
// siden den filen har en annen prop-kontrakt bygget for søkeresultater med flere markører +
// brukerposisjon + radius-sirkel + FitBounds — ikke relevant for et enkelt profil-kartutsnitt).
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

type Props = {
  lat: number;
  lon: number;
  name?: string;
};

// Drop-in-erstatning for gradient-plassholderen i ProviderClient.tsx sin bilde-seksjon —
// rendres som `absolute inset-0`, samme mønster som <Image fill /> og gradienten den ellers
// viser. Ingen radius-sirkel, ingen brukerposisjon — kun én markør på anleggets posisjon.
export default function ProfileLocationMap({ lat, lon, name }: Props) {
  const position: [number, number] = [lat, lon];

  return (
    <div className="absolute inset-0">
      <MapContainer
        center={position}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position}>
          {name && <Popup>{name}</Popup>}
        </Marker>
      </MapContainer>
    </div>
  );
}
