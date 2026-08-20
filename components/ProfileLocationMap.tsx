'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { configureLeafletIcons } from '../lib/leafletIcons';
import 'leaflet/dist/leaflet.css';

configureLeafletIcons();

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
