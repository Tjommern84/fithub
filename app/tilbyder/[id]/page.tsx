import type { Metadata } from 'next';
export const revalidate = 3600;
import ProviderClient from './ProviderClient';
import type { Service } from '../../../lib/domain';
import { services as staticServices } from '../../../lib/providers';
import { supabase } from '../../../lib/supabaseClient';
import { getServiceCache, setServiceCache } from '../../../lib/serviceCache';
import { searchServices } from '../../../lib/matchingDb';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const ogImageUrl = `${appUrl}/og-default.svg`;

const typeLabels: Record<Service['type'], string> = {
  styrke: 'Treningssenter',
  pt: 'Personlig trener',
  yoga: 'Yoga & Bevegelighet',
  gruppe: 'Gruppetimer',
  kondisjon: 'Kondisjon',
  outdoor: 'Outdoor',
  sport: 'Idrettslag & Sport',
  mindbody: 'Mind-body',
  spesialisert: 'Klinisk & Rehab',
  livsstil: 'Livsstil & Helse',
  teknologi: 'Digital trening',
  rehab: 'Rehabilitering',
  ernæring: 'Ernæring',
  helse: 'Helse & velvære',
};

const SERVICE_SELECT =
  'id, name, type, description, coverage, price_level, rating_avg, rating_count, tags, goals, venues, is_active, cover_image_url, logo_image_url, phone, email, website, address, provider_type';

// lat/lon er nye, genererte kolonner (fra base_location) — migrasjonen er ikke nødvendigvis
// kjørt i alle miljøer ennå. Et `.select()` på en ikke-eksisterende kolonne feiler HELE
// spørringen i PostgREST (ikke bare de to feltene), så disse hentes i et eget select med
// retry-uten-dem ved feil — samme mønster som searchServices() sin p_borough-retry.
const SERVICE_SELECT_WITH_LOCATION = `${SERVICE_SELECT}, lat, lon`;

const mapServiceRow = (row: Record<string, unknown>): Service => ({
  id: String(row.id ?? ''),
  name: String(row.name ?? ''),
  type: (row.type as Service['type']) ?? 'pt',
  description: String(row.description ?? ''),
  coverage: Array.isArray(row.coverage) ? (row.coverage as Service['coverage']) : [],
  price_level: (row.price_level as Service['price_level']) ?? 'medium',
  rating_avg: typeof row.rating_avg === 'number' ? row.rating_avg : 0,
  rating_count: typeof row.rating_count === 'number' ? row.rating_count : 0,
  tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
  goals: Array.isArray(row.goals) ? (row.goals as Service['goals']) : [],
  venues: Array.isArray(row.venues) ? (row.venues as Service['venues']) : [],
  is_active: row.is_active !== false,
  cover_image_url: row.cover_image_url ? String(row.cover_image_url) : null,
  logo_image_url: row.logo_image_url ? String(row.logo_image_url) : null,
  phone: row.phone ? String(row.phone) : null,
  email: row.email ? String(row.email) : null,
  website: row.website ? String(row.website) : null,
  address: row.address ? String(row.address) : null,
  provider_type: row.provider_type === 'facility' ? 'facility' : 'business',
  lat: typeof row.lat === 'number' ? row.lat : null,
  lon: typeof row.lon === 'number' ? row.lon : null,
});

const normalizeServiceId = (rawId: string): string => {
  // Next.js sin App Router-rute (params.id) leverer IKKE alltid en dekodet streng for
  // ikke-ASCII path-segmenter — bekreftet empirisk: en URL med %C3%B8 ankommer som den
  // literale 6-tegns-sekvensen "%C3%B8", ikke tegnet "ø". decodeURIComponent løser dette;
  // .normalize('NFC') er et harmløst sikkerhetsnett for andre tegn enn "ø" (som selv ikke
  // har en NFD-form) i tilfelle id senere inneholder bokstaver med kombinerende aksenter.
  try {
    return decodeURIComponent(rawId).normalize('NFC');
  } catch {
    return rawId;
  }
};

const fetchServiceById = async (id: string): Promise<Service | null> => {
  if (!id || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from('services')
      .select(SERVICE_SELECT_WITH_LOCATION)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      // Backward compatibility: lat/lon-migrasjonen er ikke kjørt ennå i dette miljøet —
      // retry uten dem i stedet for å la HELE tilbyder-siden vise "ingen tilbyder".
      const legacy = await supabase
        .from('services')
        .select(SERVICE_SELECT)
        .eq('id', id)
        .maybeSingle();
      if (!legacy.data) return null;
      return mapServiceRow(legacy.data as Record<string, unknown>);
    }

    if (!data) return null;
    return mapServiceRow(data as Record<string, unknown>);
  } catch {
    return null;
  }
};

const resolveService = async (rawId: string): Promise<Service | null> => {
  const id = normalizeServiceId(rawId);
  const cached = await getServiceCache(id);
  if (cached) return cached;

  const fetched = await fetchServiceById(id);
  if (fetched) {
    await setServiceCache(id, fetched);
    return fetched;
  }

  return staticServices.find((item) => item.id === id) ?? null;
};

const buildDescription = (text: string) => {
  const trimmed = text.trim();
  if (trimmed.length <= 160) return trimmed;
  return `${trimmed.slice(0, 157)}...`;
};

export async function generateMetadata({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const params = await paramsPromise;
  const service = await resolveService(params.id);

  if (!service) {
    return {
      title: 'Tilbyder ikke funnet – fithub.no',
      description: 'Vi fant ikke tilbyderen du leter etter.',
    };
  }

  const pageTitle = `${service.name} – ${typeLabels[service.type]}`;
  const pageUrl = `${appUrl}/tilbyder/${encodeURIComponent(service.id)}`;
  const description = buildDescription(service.description);
  const ogImage = service.cover_image_url ?? ogImageUrl;

  return {
    title: pageTitle,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title: pageTitle,
      description,
      url: pageUrl,
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630, alt: service.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description,
      images: [ogImage],
    },
  };
}

const fetchRelated = async (service: Service): Promise<Service[]> => {
  try {
    const radiusRule = service.coverage.find((r) => r.type === 'radius');
    const citiesRule = service.coverage.find((r) => r.type === 'cities');
    const lat = radiusRule ? radiusRule.center.lat : undefined;
    const lon = radiusRule ? radiusRule.center.lon : undefined;
    const city = !radiusRule && citiesRule ? citiesRule.cities[0] : undefined;
    const ranked = await searchServices({
      type: service.type,
      lat,
      lon,
      city,
      sort: 'best_match',
      limit: 6,
    });
    return ranked
      .map((r) => r.service)
      .filter((s) => s.id !== service.id)
      .slice(0, 4);
  } catch {
    return [];
  }
};

export default async function ProviderPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = await paramsPromise;
  const service = await resolveService(params.id);

  const [relatedServices] = await Promise.all([
    service ? fetchRelated(service) : Promise.resolve([]),
  ]);

  const localBusinessLd = service
    ? {
        '@context': 'https://schema.org',
        '@type': service.provider_type === 'facility' ? 'Place' : 'LocalBusiness',
        name: service.name,
        description: service.description || undefined,
        url: service.website
          ? service.website.startsWith('http') ? service.website : `https://${service.website}`
          : `${appUrl}/tilbyder/${encodeURIComponent(service.id)}`,
        telephone: service.phone ? `+47${service.phone}` : undefined,
        email: service.email || undefined,
        image: service.cover_image_url || undefined,
        address: service.address
          ? { '@type': 'PostalAddress', streetAddress: service.address, addressCountry: 'NO' }
          : undefined,
        aggregateRating:
          service.rating_avg > 0
            ? { '@type': 'AggregateRating', ratingValue: service.rating_avg, ratingCount: service.rating_count }
            : undefined,
      }
    : null;

  return (
    <>
      {localBusinessLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessLd) }}
        />
      )}
      <ProviderClient params={params} service={service} relatedServices={relatedServices} />
    </>
  );
}
