'use client';

import { useEffect, useState } from 'react';
import type { Session as AuthSession } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabaseClient';
import { joinSession, leaveSession, getProfileVerification } from '../../../lib/groupSessions';
import type { GroupSession } from '../../../lib/groupSessions';
import { nextOccurrence, recurrenceLabel } from '../../../lib/groupSessions';
import { buttonPrimary, buttonSecondary } from '../../../lib/ui';

function formatDate(date: Date): string {
  return date.toLocaleDateString('no-NO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatUpdated(iso: string): string {
  return new Date(iso).toLocaleDateString('no-NO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function SessionDetail({ session }: { session: GroupSession }) {
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [joinStatus, setJoinStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [joined, setJoined] = useState(false);
  const [participantCount, setParticipantCount] = useState(
    session.session_participants?.filter((p) => p.status === 'confirmed').length ?? 0
  );

  const isFull =
    session.max_participants !== null && participantCount >= session.max_participants;
  const creator = session.creator;
  const next = nextOccurrence(session);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      setAuthSession(data.session);
      if (data.session?.user?.id) {
        const pv = await getProfileVerification(data.session.user.id);
        setIsVerified(Boolean(pv?.phone_verified_at));
        const already = session.session_participants?.some(
          (p) => p.user_id === data.session!.user.id && p.status === 'confirmed'
        );
        setJoined(Boolean(already));
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => {
      setAuthSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, [session]);

  const handleJoin = async () => {
    if (!authSession?.user) return;
    setJoinStatus('loading');
    try {
      await joinSession(session.id, authSession.user.id);
      setJoined(true);
      setParticipantCount((c) => c + 1);
      setJoinStatus('idle');
    } catch {
      setJoinStatus('error');
    }
  };

  const handleLeave = async () => {
    if (!authSession?.user) return;
    setJoinStatus('loading');
    try {
      await leaveSession(session.id, authSession.user.id);
      setJoined(false);
      setParticipantCount((c) => Math.max(0, c - 1));
      setJoinStatus('idle');
    } catch {
      setJoinStatus('error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="inline-flex items-center rounded-full bg-violet-50 px-3 py-0.5 text-sm font-medium text-violet-700">
            {session.session_type}
          </span>
          {session.is_free ? (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-0.5 text-sm font-medium text-emerald-700">
              Gratis
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-0.5 text-sm font-medium text-amber-700">
              kr {session.price} per økt
            </span>
          )}
          {session.status !== 'active' && (
            <span className="inline-flex items-center rounded-full bg-rose-50 px-3 py-0.5 text-sm font-medium text-rose-600">
              {session.status === 'cancelled' ? 'Avlyst' : 'Avsluttet'}
            </span>
          )}
        </div>

        <h1 className="text-2xl font-bold text-slate-900">{session.title}</h1>
        {session.description && (
          <p className="mt-2 text-slate-600 leading-relaxed">{session.description}</p>
        )}

        {/* Date */}
        <div className="mt-4 p-4 rounded-xl bg-violet-50 border border-violet-100">
          <p className="text-sm font-semibold text-violet-800">{formatDate(next)}</p>
          {session.recurrence_type && (
            <p className="text-xs text-violet-600 mt-0.5">
              Gjentas: {recurrenceLabel(session.recurrence_type)}
              {session.recurrence_ends_at
                ? ` · Avsluttes ${new Date(session.recurrence_ends_at).toLocaleDateString('no-NO')}`
                : ''}
            </p>
          )}
          {session.duration_minutes && (
            <p className="text-xs text-violet-600 mt-0.5">Varighet: {session.duration_minutes} min</p>
          )}
        </div>

        {/* Location */}
        {(session.address || session.city || session.location_notes) && (
          <div className="mt-4 text-sm text-slate-600 space-y-0.5">
            {session.address && <p>📍 {session.address}{session.city ? `, ${session.city}` : ''}</p>}
            {!session.address && session.city && <p>📍 {session.city}</p>}
            {session.location_notes && <p className="text-slate-500 pl-5">{session.location_notes}</p>}
          </div>
        )}

        {/* Paid: payment info */}
        {!session.is_free && session.payment_info && (
          <div className="mt-4 rounded-xl bg-amber-50 border border-amber-100 p-3 text-sm text-amber-800">
            <span className="font-semibold">Betaling: </span>{session.payment_info}
          </div>
        )}

        {/* Participants */}
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <span>
            {participantCount}
            {session.max_participants !== null
              ? ` av ${session.max_participants} plasser opptatt`
              : ' påmeldt'}
          </span>
          {isFull && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
              Fullt
            </span>
          )}
        </div>

        {/* Join / leave */}
        {session.status === 'active' && (
          <div className="mt-5">
            {!authSession ? (
              <p className="text-sm text-slate-500">
                <a href="/min-side" className="text-violet-600 font-medium hover:underline">Logg inn</a>
                {' '}for å melde deg på.
              </p>
            ) : !isVerified ? (
              <p className="text-sm text-slate-500">
                <a href="/min-side#telefon" className="text-violet-600 font-medium hover:underline">Verifiser telefon</a>
                {' '}for å melde deg på.
              </p>
            ) : joined ? (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-emerald-700">✓ Du er påmeldt</span>
                <button
                  type="button"
                  onClick={handleLeave}
                  disabled={joinStatus === 'loading'}
                  className={buttonSecondary}
                >
                  {joinStatus === 'loading' ? 'Melder av ...' : 'Meld av'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleJoin}
                disabled={joinStatus === 'loading' || isFull}
                className={buttonPrimary}
              >
                {isFull ? 'Fullt' : joinStatus === 'loading' ? 'Melder på ...' : 'Delta'}
              </button>
            )}
            {joinStatus === 'error' && (
              <p className="mt-2 text-xs text-rose-600">Noe gikk galt. Prøv igjen.</p>
            )}
          </div>
        )}

        <p className="mt-4 text-xs text-slate-400">Sist endret {formatUpdated(session.updated_at)}</p>
      </div>

      {/* Creator */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Arrangert av</h2>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-semibold text-base">
            {creator?.full_name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">{creator?.full_name ?? 'Anonym'}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {creator?.phone_verified_at && (
                <span className="inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
                  ✓ Verifisert
                </span>
              )}
              {creator?.is_pro && (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                  Pro
                </span>
              )}
            </div>
            {creator?.bio && (
              <p className="mt-1 text-xs text-slate-500">{creator.bio}</p>
            )}
          </div>
        </div>
      </div>

      {/* Participant list */}
      {(session.session_participants?.length ?? 0) > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            Påmeldte ({participantCount})
          </h2>
          <div className="flex flex-wrap gap-2">
            {session.session_participants
              ?.filter((p) => p.status === 'confirmed')
              .slice(0, 8)
              .map((p) => (
                <div
                  key={p.user_id}
                  className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500"
                >
                  ?
                </div>
              ))}
            {participantCount > 8 && (
              <div className="h-8 px-2 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500">
                +{participantCount - 8}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
