'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import { getMyGroupSessions, cancelGroupSession, nextOccurrence, recurrenceLabel } from '../../../lib/groupSessions';
import type { GroupSession } from '../../../lib/groupSessions';
import { container, buttonPrimary, buttonSecondary } from '../../../lib/ui';
import { Card } from '../../../components/ui/Card';
import { ButtonLink } from '../../../components/ui/Button';

function formatDate(date: Date): string {
  return date.toLocaleDateString('no-NO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktiv',
  cancelled: 'Avlyst',
  completed: 'Avsluttet',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-rose-50 text-rose-600',
  completed: 'bg-slate-100 text-slate-500',
};

export default function MineArrangementerPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<GroupSession[]>([]);
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    let mounted = true;
    setLoadStatus('loading');
    getMyGroupSessions(session.user.id)
      .then((data) => {
        if (!mounted) return;
        setSessions(data);
        setLoadStatus('idle');
      })
      .catch(() => {
        if (!mounted) return;
        setLoadStatus('error');
      });
    return () => { mounted = false; };
  }, [session?.user?.id]);

  const handleCancel = async (id: string) => {
    if (!confirm('Er du sikker på at du vil avlyse dette arrangementet?')) return;
    setCancelling(id);
    try {
      await cancelGroupSession(id);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, status: 'cancelled', is_active: false } : s
        )
      );
    } finally {
      setCancelling(null);
    }
  };

  if (!session) {
    return (
      <main className={`${container} py-16 text-center`}>
        <p className="text-slate-600 mb-4">Du må være innlogget.</p>
        <Link href="/min-side" className={buttonPrimary}>Logg inn</Link>
      </main>
    );
  }

  return (
    <main className={`${container} py-10`}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Min side</p>
          <h1 className="text-2xl font-bold text-slate-900">Mine arrangementer</h1>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/arrangementer/nytt" className="text-sm">
            + Nytt arrangement
          </ButtonLink>
          <ButtonLink href="/min-side" variant="secondary" className="text-sm">
            Tilbake
          </ButtonLink>
        </div>
      </div>

      {loadStatus === 'loading' && (
        <p className="text-sm text-slate-400">Laster ...</p>
      )}

      {loadStatus === 'error' && (
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700">
          Kunne ikke laste arrangementer.
        </Card>
      )}

      {loadStatus === 'idle' && sessions.length === 0 && (
        <Card className="text-center py-10">
          <p className="text-slate-500 text-sm mb-4">Du har ingen arrangementer ennå.</p>
          <ButtonLink href="/arrangementer/nytt">Opprett ditt første</ButtonLink>
        </Card>
      )}

      {sessions.length > 0 && (
        <div className="space-y-4">
          {sessions.map((s) => {
            const next = nextOccurrence(s);
            const participantCount =
              s.session_participants?.filter((p) => p.status === 'confirmed').length ?? 0;

            return (
              <Card key={s.id} className="p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[s.status] ?? 'bg-slate-100 text-slate-500'}`}>
                        {STATUS_LABELS[s.status] ?? s.status}
                      </span>
                      <span className="text-xs text-slate-400">{s.session_type}</span>
                      {s.recurrence_type && (
                        <span className="text-xs text-violet-600">
                          {recurrenceLabel(s.recurrence_type)}
                        </span>
                      )}
                    </div>

                    <h2 className="font-semibold text-slate-900 text-base">{s.title}</h2>

                    <div className="mt-1 text-sm text-slate-500 space-y-0.5">
                      <p>📅 {formatDate(next)}</p>
                      {s.city && <p>📍 {s.address ? `${s.address}, ${s.city}` : s.city}</p>}
                      <p>
                        {participantCount}
                        {s.max_participants !== null
                          ? ` / ${s.max_participants} påmeldt`
                          : ' påmeldt'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {s.is_free ? 'Gratis' : `kr ${s.price}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <Link
                      href={`/arrangementer/${s.id}`}
                      className={`${buttonSecondary} text-xs px-3`}
                    >
                      Se side
                    </Link>
                    {s.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => handleCancel(s.id)}
                        disabled={cancelling === s.id}
                        className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition disabled:opacity-50"
                      >
                        {cancelling === s.id ? 'Avlyser ...' : 'Avlys'}
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
