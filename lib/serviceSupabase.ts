import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase.types';

let cachedClient: SupabaseClient<Database> | null = null;

export function getServiceSupabase(): SupabaseClient<Database> | null {
  if (cachedClient) return cachedClient;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  cachedClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${serviceRoleKey}` } },
  });
  return cachedClient;
}
