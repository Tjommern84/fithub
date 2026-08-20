import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const assetUrl = (asset: string | { src: string }) =>
  typeof asset === 'string' ? asset : asset.src;

export const leafletMarkerUrls = {
  iconRetinaUrl: assetUrl(markerIcon2x),
  iconUrl: assetUrl(markerIcon),
  shadowUrl: assetUrl(markerShadow),
};

export function configureLeafletIcons() {
  delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
  L.Icon.Default.mergeOptions(leafletMarkerUrls);
}
