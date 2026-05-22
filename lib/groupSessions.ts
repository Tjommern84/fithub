import { supabase } from './supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecurrenceType = 'weekly' | 'biweekly' | 'monthly';
export type SessionStatus = 'active' | 'cancelled' | 'completed';

export type GroupSession = {
  id: string;
  creator_user_id: string;
  title: string;
  description: string | null;
  session_type: string;
  tags: string[];
  address: string | null;
  city: string | null;
  location_notes: string | null;
  lat: number | null;
  lon: number | null;
  is_free: boolean;
  price: number | null;
  payment_info: string | null;
  starts_at: string;
  duration_minutes: number | null;
  recurrence_type: RecurrenceType | null;
  recurrence_ends_at: string | null;
  max_participants: number | null;
  status: SessionStatus;
  is_active: boolean;
  main_category: string;
  created_at: string;
  updated_at: string;
  creator?: {
    full_name: string | null;
    phone_verified_at: string | null;
    is_pro: boolean;
    avatar_url: string | null;
    bio: string | null;
  } | null;
  session_participants?: { user_id: string; status: string }[];
};

export type GroupSessionInput = Omit<
  GroupSession,
  'id' | 'created_at' | 'updated_at' | 'creator' | 'session_participants'
>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function nextOccurrence(
  session: Pick<GroupSession, 'starts_at' | 'recurrence_type' | 'recurrence_ends_at'>
): Date {
  const start = new Date(session.starts_at);
  if (!session.recurrence_type) return start;

  const now = new Date();
  if (start > now) return start;

  const intervalMs =
    session.recurrence_type === 'weekly'   ? 7  * 86_400_000 :
    session.recurrence_type === 'biweekly' ? 14 * 86_400_000 :
                                             30 * 86_400_000;

  let next = new Date(start);
  while (next <= now) {
    next = new Date(next.getTime() + intervalMs);
  }

  if (session.recurrence_ends_at && next > new Date(session.recurrence_ends_at)) {
    return start;
  }
  return next;
}

export function recurrenceLabel(type: RecurrenceType | null): string {
  if (!type) return 'Enkelt økt';
  if (type === 'weekly') return 'Ukentlig';
  if (type === 'biweekly') return 'Annenhver uke';
  return 'Månedlig';
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Read functions ───────────────────────────────────────────────────────────

export async function fetchGroupSessions(params: {
  lat?: number;
  lon?: number;
  city?: string;
  radiusKm?: number;
  tags?: string[];
  limit?: number;
}): Promise<GroupSession[]> {
  if (!supabase) return [];

  const { lat, lon, city, radiusKm = 25, tags, limit = 30 } = params;

  let query = supabase
    .from('group_sessions')
    .select(
      `*, creator:profiles!creator_user_id(full_name, phone_verified_at, is_pro, avatar_url, bio), session_participants(user_id, status)`
    )
    .eq('is_active', true)
    .eq('status', 'active')
    .order('starts_at', { ascending: true })
    .limit(limit * 4);

  if (tags && tags.length > 0) {
    query = query.overlaps('tags', tags);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[fetchGroupSessions]', error.message);
    return [];
  }

  const now = new Date();
  let sessions = (data ?? []) as GroupSession[];

  // Filter: only upcoming sessions
  sessions = sessions.filter((s) => {
    const next = nextOccurrence(s);
    return next >= now;
  });

  // Filter: by location
  if (lat !== undefined && lon !== undefined) {
    sessions = sessions.filter((s) => {
      if (s.lat !== null && s.lon !== null) {
        return haversineKm(lat, lon, s.lat, s.lon) <= radiusKm;
      }
      if (city && s.city) {
        return s.city.toLowerCase() === city.toLowerCase();
      }
      return false;
    });
  } else if (city) {
    sessions = sessions.filter(
      (s) => s.city?.toLowerCase() === city.toLowerCase()
    );
  }

  return sessions.slice(0, limit);
}

export async function getGroupSession(id: string): Promise<GroupSession | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('group_sessions')
    .select(
      `*, creator:profiles!creator_user_id(full_name, phone_verified_at, is_pro, avatar_url, bio), session_participants(user_id, status, joined_at)`
    )
    .eq('id', id)
    .single();
  if (error) return null;
  return data as GroupSession;
}

export async function getMyGroupSessions(userId: string): Promise<GroupSession[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('group_sessions')
    .select(`*, session_participants(user_id, status)`)
    .eq('creator_user_id', userId)
    .order('starts_at', { ascending: false });
  if (error) return [];
  return (data ?? []) as GroupSession[];
}

// ─── Write functions (requires authenticated client) ──────────────────────────

export async function createGroupSession(
  input: GroupSessionInput
): Promise<GroupSession> {
  if (!supabase) throw new Error('Supabase ikke konfigurert');
  const { data, error } = await supabase
    .from('group_sessions')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as GroupSession;
}

export async function updateGroupSession(
  id: string,
  updates: Partial<GroupSessionInput>
): Promise<void> {
  if (!supabase) throw new Error('Supabase ikke konfigurert');
  const { error } = await supabase
    .from('group_sessions')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function cancelGroupSession(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase ikke konfigurert');
  const { error } = await supabase
    .from('group_sessions')
    .update({ status: 'cancelled', is_active: false })
    .eq('id', id);
  if (error) throw error;
}

export async function joinSession(sessionId: string, userId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase ikke konfigurert');
  const { error } = await supabase
    .from('session_participants')
    .upsert(
      { session_id: sessionId, user_id: userId, status: 'confirmed' },
      { onConflict: 'session_id,user_id' }
    );
  if (error) throw error;
}

export async function leaveSession(sessionId: string, userId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase ikke konfigurert');
  const { error } = await supabase
    .from('session_participants')
    .delete()
    .eq('session_id', sessionId)
    .eq('user_id', userId);
  if (error) throw error;
}

// ─── Profile helpers ──────────────────────────────────────────────────────────

export type ProfileVerification = {
  phone: string | null;
  phone_verified_at: string | null;
  is_pro: boolean;
};

export async function getProfileVerification(userId: string): Promise<ProfileVerification | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('phone, phone_verified_at, is_pro')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data as ProfileVerification;
}

export async function savePhone(userId: string, phone: string): Promise<void> {
  if (!supabase) throw new Error('Supabase ikke konfigurert');
  const { error } = await supabase
    .from('profiles')
    .update({ phone, phone_verified_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}
