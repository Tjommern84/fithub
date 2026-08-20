import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getTransitSearchArea,
  isInsideTransitBounds,
  isValidTransitBounds,
  mapEnturTransportMode,
  type TransitBounds,
} from '../lib/transitStops';

const osloBounds: TransitBounds = {
  minLon: 10.70,
  minLat: 59.89,
  maxLon: 10.80,
  maxLat: 59.95,
};

test('validates and calculates an Entur search circle from map bounds', () => {
  assert.equal(isValidTransitBounds(osloBounds), true);
  assert.equal(isValidTransitBounds({ ...osloBounds, minLat: 60 }), false);

  const area = getTransitSearchArea(osloBounds);
  assert.equal(area.lat, 59.92);
  assert.equal(area.lon, 10.75);
  assert.ok(area.radiusKm > 4 && area.radiusKm < 5);
});

test('caps very large search areas and filters coordinates by the requested bounds', () => {
  const area = getTransitSearchArea({ minLon: 4, minLat: 57, maxLon: 31, maxLat: 72 });
  assert.equal(area.radiusKm, 50);
  assert.equal(isInsideTransitBounds(59.91, 10.75, osloBounds), true);
  assert.equal(isInsideTransitBounds(60.1, 10.75, osloBounds), false);
});

test('maps Entur stop categories to the modes understood by the map', () => {
  assert.equal(mapEnturTransportMode(['onstreetTram', 'onstreetBus']), 'tram');
  assert.equal(mapEnturTransportMode(['railStation']), 'rail');
  assert.equal(mapEnturTransportMode(['ferryStop']), 'water');
  assert.equal(mapEnturTransportMode(['other']), null);
});
