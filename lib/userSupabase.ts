import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

export type AuthenticatedSupabase = {
  supabase: SupabaseClient<any>;
  user: User;
};

/**
 * Creates an uncached server-side Supabase client.
 *
 * When an access token is supplied, every database request carries the user's
 * JWT so Postgres RLS evaluates `auth.uid()` for that user. Calling
 * `auth.getUser(accessToken)` alone does not attach the token to later queries.
 */
export function getUserSupabase(accessToken?: string): SupabaseClient<any> | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return null;

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
  });
}

export async function getAuthenticatedSupabase(
  accessToken: string,
): Promise<AuthenticatedSupabase | null> {
  if (!accessToken) return null;

  const supabase = getUserSupabase(accessToken);
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return null;

  return { supabase, user: data.user };
}
