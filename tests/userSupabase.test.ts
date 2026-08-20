import assert from 'node:assert/strict';
import test from 'node:test';
import { getUserSupabase } from '../lib/userSupabase';

test('authenticated Supabase requests carry the user JWT', async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const previousFetch = globalThis.fetch;
  let authorization: string | null = null;

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  globalThis.fetch = async (_input, init) => {
    authorization = new Headers(init?.headers).get('authorization');
    return new Response('[]', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const supabase = getUserSupabase('user-jwt');
    assert.ok(supabase);
    await supabase.from('profiles').select('id');
    assert.equal(authorization, 'Bearer user-jwt');
  } finally {
    process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
    globalThis.fetch = previousFetch;
  }
});

test('returns null when Supabase is not configured', () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  try {
    assert.equal(getUserSupabase('user-jwt'), null);
  } finally {
    process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});
