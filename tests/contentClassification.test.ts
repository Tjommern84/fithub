import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildContentPlanItem,
  categoriesForService,
  identifySource,
  needsContentReview,
  normalizeOrganizationNumber,
  type LegacyServiceContent,
} from '../lib/contentClassification';

function service(overrides: Partial<LegacyServiceContent> = {}): LegacyServiceContent {
  return {
    id: 'legacy_test',
    name: 'Testtilbyder',
    type: 'styrke',
    main_category: 'trene-selv',
    provider_type: 'business',
    tags: ['styrke'],
    goals: [],
    venues: ['gym'],
    orgnr: null,
    description: 'Et testtilbud med en utfyllende beskrivelse av tjenesten.',
    address: null,
    city: null,
    phone: null,
    email: null,
    website: null,
    lat: null,
    lon: null,
    price_level: 'medium',
    is_active: true,
    ...overrides,
  };
}

test('normalizes valid Norwegian organization numbers', () => {
  assert.equal(normalizeOrganizationNumber('Org.nr. 999 888 777'), '999888777');
  assert.equal(normalizeOrganizationNumber('123'), null);
});

test('maps the legacy category typo to Gruppetime', () => {
  assert.deepEqual(
    categoriesForService(service({
      type: 'gruppe',
      main_category: 'trene-samen',
      tags: ['gruppetime'],
    })),
    ['trene-sammen'],
  );
});

test('allows one offering to populate several homepage categories', () => {
  assert.deepEqual(
    categoriesForService(service({
      name: 'SATS Test',
      tags: ['treningssenter', 'styrke', 'gruppetimer', 'pt'],
    })),
    ['trene-selv', 'trene-sammen', 'oppfolging'],
  );
});

test('separates a BRREG provider from a physical venue', () => {
  const plan = buildContentPlanItem(service({
    id: '8de14d26-6064-4918-9573-cea4bed675c1',
    name: 'EKSEMPEL TRENING AS',
    orgnr: '999888777',
    address: 'Forretningsveien 1, 0123 Oslo',
    city: 'oslo',
    lat: 59.9,
    lon: 10.7,
  }));

  assert.equal(plan.source, 'brreg');
  assert.equal(plan.provider?.orgnr, '999888777');
  assert.equal(plan.provider?.providerKind, 'company');
  assert.equal(plan.venue, null);
  assert.equal(plan.status, 'ready');
});

test('creates a chain provider, venue and multi-category offering', () => {
  const plan = buildContentPlanItem(service({
    id: 'sats_sats_storo',
    name: 'SATS Storo',
    tags: ['treningssenter', 'styrke', 'gruppetimer', 'pt', 'sats'],
    address: 'Vitaminveien 1, Oslo',
    city: 'oslo',
    lat: 59.95,
    lon: 10.77,
  }));

  assert.equal(plan.source, 'chain_import');
  assert.equal(plan.provider?.providerKind, 'chain');
  assert.equal(plan.venue?.venueKind, 'gym');
  assert.deepEqual(plan.categories, ['trene-selv', 'trene-sammen', 'oppfolging']);
  assert.equal(plan.status, 'ready');
});

test('keeps paraidrett visible under both sport and paraidrett', () => {
  const plan = buildContentPlanItem(service({
    id: 'para_testklubb_oslo',
    type: 'sport',
    main_category: 'aktivitet-sport',
    tags: ['sport', 'paraidrett', 'sittevolleyball'],
    lat: 59.9,
    lon: 10.7,
  }));

  assert.deepEqual(plan.categories, ['aktivitet-sport', 'paraidrett']);
});

test('maps outdoor facilities to both their activity and outdoor categories', () => {
  const plan = buildContentPlanItem(service({
    id: 'anl_123_testparken',
    type: 'outdoor',
    main_category: 'aktivitet-sport',
    provider_type: 'facility',
    tags: ['tuftepark', 'utetrening', 'styrke'],
    lat: 59.9,
    lon: 10.7,
  }));

  assert.deepEqual(plan.categories, ['trene-selv', 'aktivitet-sport', 'utendors']);
  assert.equal(plan.venue?.venueKind, 'outdoor_gym');
});

test('recognizes background imports instead of dropping them as legacy', () => {
  assert.equal(identifySource(service({ id: 'bg_pt_personlig_trener_test' })), 'pt_search');
  assert.equal(identifySource(service({ id: 'bg_ern_kostholdsradgiver_test' })), 'nutrition_search');
  assert.equal(identifySource(service({ id: 'bg_sc_fotball_test' })), 'sport_club');
});

test('creates provider and venue entities for background provider imports', () => {
  const plan = buildContentPlanItem(service({
    id: 'bg_ern_ernaeringsfysiolog_testveien_1_oslo',
    name: 'Eksempel Ernæring',
    type: 'spesialisert',
    main_category: 'oppfolging',
    tags: ['ernæring'],
    address: 'Testveien 1',
    city: 'oslo',
  }));

  assert.equal(plan.source, 'nutrition_search');
  assert.equal(plan.provider?.providerKind, 'independent');
  assert.equal(plan.venue?.venueKind, 'other');
  assert.equal(plan.status, 'ready');
});

test('does not send coordinate-backed OSM venues to manual review only for missing city', () => {
  const plan = buildContentPlanItem(service({
    id: 'osm_node_123',
    main_category: 'trene-selv',
    tags: ['treningssenter'],
    address: null,
    city: null,
    lat: 59.91,
    lon: 10.75,
  }));

  assert.deepEqual(plan.reasons, ['missing_city']);
  assert.equal(plan.status, 'ready');
  assert.equal(needsContentReview(plan), false);
});
