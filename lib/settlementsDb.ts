import { supabase } from './supabaseClient';

export type Settlement = {
  id: string;
  name: string | null;
  municipality: string | null;
  population: number | null;
  lat: number;
  lon: number;
};

type SettlementRow = {
  id: string;
  name: string | null;
  municipality: string | null;
  population: number | null;
  geojson: string;
};

function rowToSettlement(row: SettlementRow): Settlement | null {
  try {
    const geometry = JSON.parse(row.geojson) as { type: string; coordinates: [number, number] };
    if (geometry.type !== 'Point') return null;
    const [lon, lat] = geometry.coordinates;
    return {
      id: row.id,
      name: row.name,
      municipality: row.municipality,
      population: row.population,
      lat,
      lon,
    };
  } catch {
    return null;
  }
}

export type BoundingBox = {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
};

export async function getSettlementsInBounds(bbox: BoundingBox, limit = 2000): Promise<Settlement[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_settlements_in_bbox', {
    p_min_lon: bbox.minLon,
    p_min_lat: bbox.minLat,
    p_max_lon: bbox.maxLon,
    p_max_lat: bbox.maxLat,
    p_limit: limit,
  });
  if (error || !data) return [];
  return (data as SettlementRow[])
    .map(rowToSettlement)
    .filter((s): s is Settlement => s !== null);
}

// Dekker fastlands-Norge + Lofoten/Finnmark. Brukes for navneoppslag på tvers av
// hele landet — ikke et kart-viewport. Gjenbruker eksisterende get_settlements_in_bbox()
// RPC i stedet for en ny SQL-funksjon (ingen Tier-2-spesifikk migrasjon krevd).
const NORWAY_BBOX: BoundingBox = { minLon: 3, minLat: 57, maxLon: 32, maxLat: 71.5 };

export type SettlementMatch = {
  name: string;
  lat: number;
  lon: number;
  remainder: string;
};

// Tokeniserer søketeksten og matcher hvert ord mot settlements.name (case-insensitivt).
// Forskjellig fra /api/geocode (LocationBar): den geokoder en HEL streng som én adresse,
// denne plukker ETT stedsnavn ut av en blandet søkestreng som "yoga drammen".
export async function findSettlementInQuery(query: string): Promise<SettlementMatch | null> {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const settlements = await getSettlementsInBounds(NORWAY_BBOX, 2000);
  if (settlements.length === 0) return null;

  const byLowerName = new Map<string, { name: string; lat: number; lon: number }>();
  for (const s of settlements) {
    if (s.name) byLowerName.set(s.name.toLowerCase(), { name: s.name, lat: s.lat, lon: s.lon });
  }

  for (const token of tokens) {
    const match = byLowerName.get(token.toLowerCase());
    if (match) {
      const remainder = tokens.filter((t) => t !== token).join(' ').trim();
      return { ...match, remainder };
    }
  }
  return null;
}
