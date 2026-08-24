import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { LegacyServiceContent } from '../../lib/contentClassification';

export const SERVICE_SELECT = [
  'id', 'name', 'type', 'main_category', 'provider_type', 'tags', 'goals', 'venues',
  'orgnr', 'description', 'address', 'city', 'phone', 'email', 'website', 'lat', 'lon',
  'price_level', 'is_active',
].join(',');

export function loadLocalEnv(): void {
  try {
    const text = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const separator = trimmed.indexOf('=');
      if (separator < 1) continue;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // The caller reports missing required variables with a clearer message.
  }
}

export function createServiceRoleClient(): SupabaseClient {
  loadLocalEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY må finnes i .env.local');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function fetchAllServices(client: SupabaseClient): Promise<LegacyServiceContent[]> {
  const rows: LegacyServiceContent[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from('services')
      .select(SERVICE_SELECT)
      .order('id')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Kunne ikke hente services: ${error.message}`);
    const page = (data ?? []) as unknown as LegacyServiceContent[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

export function parsePositiveIntegerArg(args: string[], name: string): number | null {
  const raw = args.find((arg) => arg.startsWith(`--${name}=`))?.split('=', 2)[1];
  if (raw === undefined) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`--${name} må være et positivt heltall`);
  }
  return value;
}

export function parseNonNegativeIntegerArg(args: string[], name: string): number | null {
  const raw = args.find((arg) => arg.startsWith(`--${name}=`))?.split('=', 2)[1];
  if (raw === undefined) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`--${name} må være et ikke-negativt heltall`);
  }
  return value;
}

export function getStringArg(args: string[], name: string): string | null {
  return args.find((arg) => arg.startsWith(`--${name}=`))?.split('=', 2)[1] ?? null;
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function chunks<T>(values: T[], size = 250): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

export function countBy<T>(values: T[], key: (value: T) => string): Record<string, number> {
  return Object.fromEntries(
    Object.entries(values.reduce<Record<string, number>>((counts, value) => {
      const itemKey = key(value);
      counts[itemKey] = (counts[itemKey] ?? 0) + 1;
      return counts;
    }, {})).sort((left, right) => right[1] - left[1]),
  );
}
