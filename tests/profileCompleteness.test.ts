import assert from 'node:assert/strict';
import test from 'node:test';
import { getProfileCompleteness } from '../lib/profileCompleteness';

const completeProfile = {
  description: 'En grundig beskrivelse som forklarer tilbudet, målgruppen og hva kunden kan forvente.',
  coverImageUrl: 'https://example.com/cover.jpg',
  logoImageUrl: 'https://example.com/logo.jpg',
  address: 'Testveien 1, Oslo',
  website: 'https://example.com',
  phone: '12345678',
  email: null,
  tags: ['styrke', 'kondisjon', 'gruppe'],
  goals: ['strength'],
  venues: ['gym'],
};

test('returns 100 percent for a complete provider profile', () => {
  assert.deepEqual(getProfileCompleteness(completeProfile), {
    percentage: 100,
    missing: [],
  });
});

test('returns prioritized, actionable advice for an empty profile', () => {
  const result = getProfileCompleteness({
    description: '',
    coverImageUrl: null,
    logoImageUrl: null,
    address: null,
    website: null,
    phone: null,
    email: null,
    tags: [],
    goals: [],
    venues: [],
  });

  assert.equal(result.percentage, 0);
  assert.equal(result.missing.length, 8);
  assert.equal(result.missing[0], 'Skriv en beskrivelse på minst 80 tegn');
});

test('accepts email as contact information when phone is missing', () => {
  const result = getProfileCompleteness({
    ...completeProfile,
    phone: null,
    email: 'hei@example.com',
  });

  assert.equal(result.percentage, 100);
});
