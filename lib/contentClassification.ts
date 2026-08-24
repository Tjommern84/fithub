import { createHash } from 'node:crypto';

export const HOME_CATEGORY_KEYS = [
  'trene-selv',
  'trene-sammen',
  'oppfolging',
  'helse',
  'aktivitet-sport',
  'paraidrett',
  'utendors',
] as const;

export type HomeCategoryKey = (typeof HOME_CATEGORY_KEYS)[number];

export type LegacyServiceContent = {
  id: string;
  name: string;
  type: string | null;
  main_category: string | null;
  provider_type: string | null;
  tags: string[] | null;
  goals: string[] | null;
  venues: string[] | null;
  orgnr: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  lat: number | null;
  lon: number | null;
  price_level: string | null;
  is_active: boolean | null;
};

export type ProviderKind =
  | 'company'
  | 'chain'
  | 'association'
  | 'municipality'
  | 'independent'
  | 'other';

export type VenueKind =
  | 'gym'
  | 'pool'
  | 'climbing_gym'
  | 'sports_hall'
  | 'ice_rink'
  | 'studio'
  | 'martial_arts_studio'
  | 'racket_centre'
  | 'outdoor_gym'
  | 'sports_facility'
  | 'clinic'
  | 'other';

export type PlannedProvider = {
  id: string;
  identityKey: string;
  name: string;
  legalName: string | null;
  orgnr: string | null;
  providerKind: ProviderKind;
  confidence: number;
};

export type PlannedVenue = {
  id: string;
  name: string;
  venueKind: VenueKind;
  confidence: number;
};

export type ContentMigrationPlanItem = {
  serviceId: string;
  source: string;
  sourceExternalId: string;
  categories: HomeCategoryKey[];
  provider: PlannedProvider | null;
  venue: PlannedVenue | null;
  offeringId: string | null;
  confidence: number;
  status: 'ready' | 'review';
  reasons: string[];
};

export function needsContentReview(plan: ContentMigrationPlanItem): boolean {
  if (plan.status === 'review') return true;

  // City is useful for labels and text filters, but coordinates are the
  // authoritative location for distance search. Do not flood the manual
  // queue with otherwise usable OSM venues that only lack a city label.
  return plan.reasons.some((reason) => reason !== 'missing_city');
}

const CATEGORY_ALIASES: Record<string, HomeCategoryKey> = {
  'trene-selv': 'trene-selv',
  'trene-sammen': 'trene-sammen',
  'trene-samen': 'trene-sammen',
  oppfolging: 'oppfolging',
  helse: 'helse',
  'aktivitet-sport': 'aktivitet-sport',
  paraidrett: 'paraidrett',
  utendors: 'utendors',
};

const CATEGORY_RULES: Record<HomeCategoryKey, string[]> = {
  'trene-selv': [
    'styrke', 'kondisjon', 'teknologi', 'treningssenter', 'styrketrening',
    'klatring', 'klatresenter', 'svømming', 'svommehall', 'svømmehall', 'crossfit',
  ],
  'trene-sammen': [
    'gruppe', 'gruppetime', 'gruppetimer', 'yoga', 'mindbody', 'bootcamp',
    'løpegruppe', 'lopegruppe', 'spinning', 'aerobic', 'fellestimer',
  ],
  oppfolging: [
    'pt', 'personligtrener', 'personaltrainer', 'coaching', 'livsstil',
    'kosthold', 'ernæring', 'ernaering', 'spesialisert',
  ],
  helse: [
    'helse', 'rehab', 'rehabilitering', 'fysioterapi', 'fysioterapeut',
    'kiropraktikk', 'kiropraktor', 'naprapat', 'osteopati', 'ernæring', 'ernaering',
  ],
  'aktivitet-sport': [
    'sport', 'idrettslag', 'idrettshall', 'sportsanlegg', 'fotball', 'ski',
    'langrenn', 'tennis', 'padel', 'golf', 'ishockey', 'friidrett', 'orientering',
    'kampsport', 'turn', 'riding', 'hest', 'bowling',
  ],
  paraidrett: ['paraidrett', 'tilrettelagt', 'rullestol', 'sittevolleyball'],
  utendors: [
    'outdoor', 'utendørs', 'utendors', 'utetrening', 'tuftepark', 'friluft',
    'aktivitetspark', 'hinderløype', 'hinderloype', 'pumptrack', 'diskgolf',
  ],
};

const CHAIN_NAMES = [
  'fresh fitness',
  'family sports club',
  'fitnesspoint',
  'aktiv365',
  'sky fitness',
  'feel24',
  'sporty',
  'mova',
  'evo',
  'sats',
  'impulse',
  'spenst',
  '3t',
] as const;

const PHYSICAL_SOURCE_FAMILIES = new Set([
  'osm', 'anleggsregisteret', 'tufteparker', 'google_places', 'group_fitness',
  'sport_club', 'pt_search', 'nutrition_search', 'paraidrett', 'chain_import',
]);

function normalizeText(value: string | null | undefined): string {
  return String(value ?? '')
    .toLocaleLowerCase('nb-NO')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9æøå]+/g, ' ')
    .trim();
}

function normalizeToken(value: string): string {
  return normalizeText(value).replace(/\s+/g, '');
}

export function normalizeOrganizationNumber(value: string | null | undefined): string | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length === 9 ? digits : null;
}

export function stableContentId(prefix: 'provider' | 'venue' | 'offering', key: string): string {
  const digest = createHash('sha256').update(`${prefix}:${key}`).digest('hex').slice(0, 24);
  return `${prefix}_${digest}`;
}

export function identifySource(service: Pick<LegacyServiceContent, 'id' | 'orgnr' | 'tags'>): string {
  const id = service.id.toLowerCase();
  const orgnr = normalizeOrganizationNumber(service.orgnr)
    ?? service.tags?.map((tag) => tag.match(/^orgnr:(\d{9})$/i)?.[1]).find(Boolean)
    ?? null;

  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id) && orgnr) return 'brreg';
  if (id.startsWith('osm_')) return 'osm';
  if (id.startsWith('anl_')) return 'anleggsregisteret';
  if (id.startsWith('tp_')) return 'tufteparker';
  if (id.startsWith('gp_')) return 'google_places';
  if (id.startsWith('gf_')) return 'group_fitness';
  if (id.startsWith('sc_')) return 'sport_club';
  if (id.startsWith('pt_')) return 'pt_search';
  if (id.startsWith('ern_')) return 'nutrition_search';
  if (id.startsWith('para_')) return 'paraidrett';
  if (id.startsWith('bg_pt_')) return 'pt_search';
  if (id.startsWith('bg_ern_')) return 'nutrition_search';
  if (id.startsWith('bg_sc_')) return 'sport_club';
  if (/^(feel24|sporty|mova|evo|impulse|sats|3t)_/.test(id)) return 'chain_import';
  return orgnr ? 'brreg' : 'legacy';
}

export function categoriesForService(service: LegacyServiceContent): HomeCategoryKey[] {
  const categories = new Set<HomeCategoryKey>();
  const primary = service.main_category ? CATEGORY_ALIASES[service.main_category] : undefined;
  if (primary) categories.add(primary);

  const values = [service.type ?? '', ...(service.tags ?? [])].map(normalizeToken);
  for (const category of HOME_CATEGORY_KEYS) {
    const rules = CATEGORY_RULES[category].map(normalizeToken);
    if (values.some((value) => rules.some((rule) => value === rule || value.includes(rule)))) {
      categories.add(category);
    }
  }

  return HOME_CATEGORY_KEYS.filter((category) => categories.has(category));
}

function findBrand(service: LegacyServiceContent): string | null {
  const haystack = normalizeText([service.name, ...(service.tags ?? [])].join(' '));
  return CHAIN_NAMES.find((brand) => haystack.includes(normalizeText(brand))) ?? null;
}

function providerKind(service: LegacyServiceContent, brand: string | null): ProviderKind {
  const haystack = normalizeText([service.name, ...(service.tags ?? [])].join(' '));
  const source = identifySource(service);
  if (brand) return 'chain';
  if (source === 'sport_club') return 'association';
  if (source === 'pt_search' || source === 'nutrition_search') return 'independent';
  if (haystack.includes('idrettslag') || haystack.includes('klubb') || haystack.includes('forening')) {
    return 'association';
  }
  if (haystack.includes('kommune') || haystack.includes('kommunal')) return 'municipality';
  if (normalizeOrganizationNumber(service.orgnr)) return 'company';
  return 'other';
}

function venueKind(service: LegacyServiceContent): VenueKind {
  const haystack = normalizeText([service.name, service.type, ...(service.tags ?? [])].join(' '));
  if (/treningssenter|fitness|\bgym\b/.test(haystack)) return 'gym';
  if (/sv[oø]mm|basseng|badeland/.test(haystack)) return 'pool';
  if (/klatr|buldr/.test(haystack)) return 'climbing_gym';
  if (/idrettshall|sportsanlegg|flerbrukshall/.test(haystack)) return 'sports_hall';
  if (/ishall|ishockey|skoyte/.test(haystack)) return 'ice_rink';
  if (/kampsport|martial/.test(haystack)) return 'martial_arts_studio';
  if (/padel|tennis|racket/.test(haystack)) return 'racket_centre';
  if (/tuftepark|utetrening|outdoor|aktivitetspark/.test(haystack)) return 'outdoor_gym';
  if (/fysio|kiro|rehab|klinikk/.test(haystack)) return 'clinic';
  if (/yoga|pilates|dans|studio|gruppe/.test(haystack)) return 'studio';
  if (service.provider_type === 'facility' || service.type === 'sport') return 'sports_facility';
  return 'other';
}

export function contentQualityScore(service: LegacyServiceContent): number {
  let score = 0;
  if (service.lat !== null && service.lon !== null) score += 25;
  if (service.address) score += 20;
  if (service.city) score += 15;
  if (service.website || service.phone || service.email) score += 20;
  if ((service.description?.trim().length ?? 0) >= 40) score += 10;
  if ((service.tags?.length ?? 0) >= 2) score += 10;
  return score;
}

export function buildContentPlanItem(service: LegacyServiceContent): ContentMigrationPlanItem {
  const source = identifySource(service);
  const categories = categoriesForService(service);
  const orgnr = normalizeOrganizationNumber(service.orgnr)
    ?? service.tags?.map((tag) => tag.match(/^orgnr:(\d{9})$/i)?.[1]).find(Boolean)
    ?? null;
  const brand = findBrand(service);
  const hasPhysicalLocation = Boolean(
    PHYSICAL_SOURCE_FAMILIES.has(source)
    && (service.address || (service.lat !== null && service.lon !== null)),
  );

  let provider: PlannedProvider | null = null;
  if (orgnr || brand || ['sport_club', 'pt_search', 'nutrition_search', 'group_fitness', 'paraidrett'].includes(source)) {
    const identityKey = orgnr ? `orgnr:${orgnr}` : brand ? `brand:${normalizeToken(brand)}` : `legacy:${service.id}`;
    provider = {
      id: stableContentId('provider', identityKey),
      identityKey,
      name: brand ? brand.replace(/\b\w/g, (letter) => letter.toUpperCase()) : service.name,
      legalName: orgnr ? service.name : null,
      orgnr,
      providerKind: providerKind(service, brand),
      confidence: orgnr ? 1 : brand ? 0.9 : 0.78,
    };
  }

  const venue: PlannedVenue | null = hasPhysicalLocation
    ? {
        id: stableContentId('venue', `${source}:${service.id}`),
        name: service.name,
        venueKind: venueKind(service),
        confidence: service.lat !== null && service.lon !== null ? 0.95 : 0.82,
      }
    : null;

  const reasons: string[] = [];
  if (categories.length === 0) reasons.push('missing_category');
  if (!provider && !venue) reasons.push('missing_entity_target');
  if (venue && !service.city) reasons.push('missing_city');
  if (venue && !service.address && (service.lat === null || service.lon === null)) reasons.push('missing_location');

  const offeringId = provider || venue
    ? stableContentId('offering', `legacy:${service.id}`)
    : null;
  const confidence = Math.min(
    provider?.confidence ?? 1,
    venue?.confidence ?? 1,
    categories.length > 0 ? 1 : 0.5,
  );

  return {
    serviceId: service.id,
    source,
    sourceExternalId: service.id,
    categories,
    provider,
    venue,
    offeringId,
    confidence,
    status: offeringId && categories.length > 0 ? 'ready' : 'review',
    reasons,
  };
}
