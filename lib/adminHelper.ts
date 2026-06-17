import { createClient } from '@supabase/supabase-js';
import { ENABLE_ADMIN } from './featureFlags';

type AdminAccessReason =
  | 'ok'
  | 'admin_disabled'
  | 'missing_token'
  | 'supabase_not_configured'
  | 'invalid_session'
  | 'not_admin'
  | 'mfa_required';

export type AdminAccessResult = {
  ok: boolean;
  reason: AdminAccessReason;
  userId?: string;
  email?: string;
  phoneE164?: string | null;
};

type AdminUserRow = {
  user_id: string | null;
  email: string;
  phone_e164: string | null;
  active: boolean;
};

const getSupabase = (accessToken?: string) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  });
};

const getServiceSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

const getAdminEmail = () => process.env.ADMIN_EMAIL?.toLowerCase() ?? '';

const getAal = (accessToken: string): string | null => {
  const payload = accessToken.split('.')[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as {
      aal?: string;
    };
    return decoded.aal ?? 'aal1';
  } catch {
    return null;
  }
};

const isDevBootstrapAdmin = (email: string | null | undefined) => {
  if (process.env.NODE_ENV === 'production') return false;
  const adminEmail = getAdminEmail();
  return Boolean(email && adminEmail && email.toLowerCase() === adminEmail);
};

export async function getAdminCandidate(accessToken: string): Promise<AdminAccessResult> {
  if (!ENABLE_ADMIN) return { ok: false, reason: 'admin_disabled' };
  if (!accessToken) return { ok: false, reason: 'missing_token' };

  const supabase = getSupabase(accessToken);
  const adminClient = getServiceSupabase();
  if (!supabase || !adminClient) return { ok: false, reason: 'supabase_not_configured' };

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user?.email) return { ok: false, reason: 'invalid_session' };

  const email = data.user.email.toLowerCase();
  const { data: adminUser, error: adminError } = await adminClient
    .from('admin_users')
    .select('user_id, email, phone_e164, active')
    .eq('email', email)
    .eq('active', true)
    .maybeSingle<AdminUserRow>();

  if (adminError && isDevBootstrapAdmin(email)) {
    return { ok: true, reason: 'ok', userId: data.user.id, email, phoneE164: null };
  }

  if (!adminUser) return { ok: false, reason: 'not_admin' };

  const adminUserId = adminUser.user_id;
  if (adminUserId && adminUserId !== data.user.id) {
    return { ok: false, reason: 'not_admin' };
  }

  return {
    ok: true,
    reason: 'ok',
    userId: data.user.id,
    email,
    phoneE164: adminUser.phone_e164,
  };
}

export async function getAdminAccess(accessToken: string): Promise<AdminAccessResult> {
  const candidate = await getAdminCandidate(accessToken);
  if (!candidate.ok) return candidate;

  const aal = getAal(accessToken);
  if (aal !== 'aal2') {
    return { ...candidate, ok: false, reason: 'mfa_required' };
  }

  return candidate;
}

export async function markAdminLogin(accessToken: string): Promise<void> {
  const access = await getAdminAccess(accessToken);
  if (!access.ok || !access.email) return;

  const adminClient = getServiceSupabase();
  if (!adminClient) return;

  await adminClient
    .from('admin_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('email', access.email)
    .eq('active', true);
}

export async function isAdminSession(accessToken: string): Promise<boolean> {
  const access = await getAdminAccess(accessToken);
  return access.ok;
}

export async function isAdminByEmail(accessToken: string): Promise<boolean> {
  return isAdminSession(accessToken);
}
