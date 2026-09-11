export type Coordinate = [number, number];
export type TrailBounds = { minLon: number; minLat: number; maxLon: number; maxLat: number };
export type TrailLineString = { type: 'LineString'; coordinates: Coordinate[] };
export type TrailPoint = { type: 'Point'; coordinates: Coordinate };
type GeometryBytes = Pick<Uint8Array, 'buffer' | 'byteOffset' | 'byteLength'>;

const EARTH_RADIUS_KM = 6371.0088;
const radians = (degrees: number) => degrees * Math.PI / 180;
const degrees = (angle: number) => angle * 180 / Math.PI;

function validCoordinate(point: Coordinate): boolean {
  return Number.isFinite(point[0]) && Number.isFinite(point[1]) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90;
}

function decode(bytes: GeometryBytes, expectedType: 1 | 2): Coordinate[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  const requireBytes = (count: number) => {
    if (offset + count > view.byteLength) throw new Error('Truncated EWKB geometry');
  };
  requireBytes(5);
  const byteOrder = view.getUint8(offset++);
  if (byteOrder !== 0 && byteOrder !== 1) throw new Error('Invalid EWKB byte order');
  const littleEndian = byteOrder === 1;
  const readUint = () => { requireBytes(4); const value = view.getUint32(offset, littleEndian); offset += 4; return value; };
  const encodedType = readUint();
  const hasSrid = (encodedType & 0x20000000) !== 0;
  const rawType = encodedType & 0x1fffffff;
  const isoDimension = Math.floor(rawType / 1000);
  if (isoDimension > 3 || rawType % 1000 !== expectedType) throw new Error('Unsupported EWKB geometry type');
  const hasZ = (encodedType & 0x80000000) !== 0 || isoDimension === 1 || isoDimension === 3;
  const hasM = (encodedType & 0x40000000) !== 0 || isoDimension === 2 || isoDimension === 3;
  if (hasSrid && readUint() !== 4326) throw new Error('Expected WGS84 (SRID 4326) geometry');
  const count = expectedType === 1 ? 1 : readUint();
  const stride = (2 + Number(hasZ) + Number(hasM)) * 8;
  requireBytes(count * stride);
  const coordinates: Coordinate[] = [];
  for (let i = 0; i < count; i++) {
    const point: Coordinate = [view.getFloat64(offset, littleEndian), view.getFloat64(offset + 8, littleEndian)];
    if (!validCoordinate(point)) throw new Error('Invalid WGS84 coordinate');
    coordinates.push(point);
    offset += stride;
  }
  if (offset !== view.byteLength) throw new Error('Unexpected trailing EWKB data');
  return coordinates;
}

export function decodeEwkbLineString(bytes: GeometryBytes): TrailLineString {
  return { type: 'LineString', coordinates: decode(bytes, 2) };
}

export function decodeEwkbPoint(bytes: GeometryBytes): TrailPoint {
  return { type: 'Point', coordinates: decode(bytes, 1)[0] };
}

function validateBounds(bounds: TrailBounds): void {
  if (!validCoordinate([bounds.minLon, bounds.minLat]) || !validCoordinate([bounds.maxLon, bounds.maxLat]) || bounds.minLon > bounds.maxLon || bounds.minLat > bounds.maxLat) {
    throw new Error('Invalid non-wrapping bounds');
  }
}

// Clips straight longitude/latitude segments, matching geometry rather than geography intersection.
export function lineIntersectsBounds(coordinates: Coordinate[], bounds: TrailBounds): boolean {
  validateBounds(bounds);
  const inside = ([x, y]: Coordinate) => x >= bounds.minLon && x <= bounds.maxLon && y >= bounds.minLat && y <= bounds.maxLat;
  if (coordinates.some(inside)) return true;
  for (let i = 1; i < coordinates.length; i++) {
    const [x, y] = coordinates[i - 1];
    const dx = coordinates[i][0] - x;
    const dy = coordinates[i][1] - y;
    let enter = 0;
    let exit = 1;
    const edges = [[-dx, x - bounds.minLon], [dx, bounds.maxLon - x], [-dy, y - bounds.minLat], [dy, bounds.maxLat - y]];
    let intersects = true;
    for (const [p, q] of edges) {
      if (p === 0) { if (q < 0) { intersects = false; break; } }
      else {
        const t = q / p;
        if (p < 0) enter = Math.max(enter, t);
        else exit = Math.min(exit, t);
        if (enter > exit) { intersects = false; break; }
      }
    }
    if (intersects) return true;
  }
  return false;
}

// Spherical approximation; not PostGIS geography's default ellipsoidal distance.
export function haversineDistanceKm(a: Coordinate, b: Coordinate): number {
  if (!validCoordinate(a) || !validCoordinate(b)) throw new Error('Invalid WGS84 coordinate');
  const dLat = radians(b[1] - a[1]);
  const dLon = radians(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a[1])) * Math.cos(radians(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function radiusBounds(center: Coordinate, radiusKm: number): TrailBounds {
  if (!validCoordinate(center) || !Number.isFinite(radiusKm) || radiusKm < 0) throw new Error('Invalid radius search');
  const angularRadius = Math.min(Math.PI, radiusKm / EARTH_RADIUS_KM);
  const latitude = radians(center[1]);
  const minLat = Math.max(-90, center[1] - degrees(angularRadius));
  const maxLat = Math.min(90, center[1] + degrees(angularRadius));
  if (minLat === -90 || maxLat === 90) return { minLon: -180, maxLon: 180, minLat, maxLat };
  const deltaLon = degrees(Math.asin(Math.min(1, Math.sin(angularRadius) / Math.cos(latitude))));
  const minLon = center[0] - deltaLon;
  const maxLon = center[0] + deltaLon;
  // A single SQLite RTree window cannot wrap the antimeridian; use a conservative candidate window.
  if (minLon < -180 || maxLon > 180) return { minLon: -180, maxLon: 180, minLat, maxLat };
  return { minLon, maxLon, minLat, maxLat };
}
