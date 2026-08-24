import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildContentResultsSearchArgs,
  canUseContentResultsSearch,
  mapRowToRankedService,
  type SearchServicesRow,
} from '../lib/matchingDb';

function structuredRow(overrides: Partial<SearchServicesRow> = {}): SearchServicesRow {
  return {
    service_id: 'legacy_service_1',
    name: 'Eksempel Treningssenter',
    type: 'styrke',
    description: 'Et strukturert treningstilbud.',
    coverage: [],
    price_level: 'medium',
    rating_avg: 4.5,
    rating_count: 12,
    tags: ['styrke', 'treningssenter'],
    goals: ['strength'],
    venues: ['gym'],
    is_active: true,
    distance_km: 2.75,
    score: 80,
    reasons: ['Strukturert kategori'],
    match_reason: 'Strukturert innholdsmodell',
    address: 'Testveien 1',
    phone: '12345678',
    email: 'test@example.no',
    website: 'https://example.no',
    orgnr: '999888777',
    lat: 59.91,
    lon: 10.75,
    cover_image_url: null,
    logo_image_url: null,
    provider_type: 'business',
    ...overrides,
  };
}

test('maps structured category RPC rows to the existing result contract', () => {
  const result = mapRowToRankedService(structuredRow());

  assert.equal(result.service.id, 'legacy_service_1');
  assert.equal(result.service.name, 'Eksempel Treningssenter');
  assert.equal(result.service.address, 'Testveien 1');
  assert.equal(result.distanceKm, 2.75);
  assert.equal(result.score, 80);
  assert.deepEqual(result.reasons, ['Strukturert kategori']);
});

test('normalizes nullable structured fields before rendering', () => {
  const result = mapRowToRankedService(structuredRow({
    reasons: null,
    match_reason: null,
    address: null,
    lat: null,
    lon: null,
  }));

  assert.deepEqual(result.reasons, []);
  assert.equal(result.matchReason, '');
  assert.equal(result.service.address, null);
  assert.equal(result.lat, undefined);
  assert.equal(result.lon, undefined);
});

test('builds a bounded SQL 45 request with filters and pagination', () => {
  const args = buildContentResultsSearchArgs({
    mainCategory: 'trene-selv',
    lat: 59.9139,
    lon: 10.7522,
    radiusKm: 500,
    type: 'styrke',
    venue: 'gym',
    query: '  treningssenter  ',
    tags: ['styrke'],
    sort: 'rating',
    limit: 250,
    page: 3,
  });

  assert.deepEqual(args, {
    p_main_category: 'trene-selv',
    p_lat: 59.9139,
    p_lon: 10.7522,
    p_radius_km: 200,
    p_service_type: 'styrke',
    p_venue: 'gym',
    p_query: 'treningssenter',
    p_tags: ['styrke'],
    p_sort: 'rating',
    p_limit: 100,
    p_offset: 200,
  });
});

test('uses the structured results search only with a safe location shape', () => {
  assert.equal(canUseContentResultsSearch({ mainCategory: 'helse' }), true);
  assert.equal(canUseContentResultsSearch({ city: 'oslo' }), false);
  assert.equal(canUseContentResultsSearch({ city: 'oslo', lat: 59.91, lon: 10.75 }), true);
  assert.equal(canUseContentResultsSearch({ lat: 59.91 }), false);
  assert.equal(canUseContentResultsSearch({ lat: 59.91, lon: 10.75, borough: 'sagene' }), false);
});
