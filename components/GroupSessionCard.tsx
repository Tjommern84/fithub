import Link from 'next/link';
import type { GroupSession } from '../lib/groupSessions';
import { nextOccurrence, recurrenceLabel } from '../lib/groupSessions';

function formatDate(date: Date): string {
  return date.toLocaleDateString('no-NO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatUpdated(iso: string): string {
  return new Date(iso).toLocaleDateString('no-NO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function GroupSessionCard({ session }: { session: GroupSession }) {
  const next = nextOccurrence(session);
  const participantCount = session.session_participants?.filter(
    (p) => p.status === 'confirmed'
  ).length ?? 0;
  const isFull =
    session.max_participants !== null && participantCount >= session.max_participants;
  const creator = session.creator;
  const isVerified = Boolean(creator?.phone_verified_at);
  const isPro = Boolean(creator?.is_pro);

  return (
    <Link
      href={`/arrangementer/${session.id}`}
      className="block rounded-xl border border-violet-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
              {session.session_type}
            </span>
            {session.is_free ? (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                Gratis
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                kr {session.price}
              </span>
            )}
            {isFull && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                Fullt
              </span>
            )}
          </div>

          <h3 className="mt-2 font-semibold text-slate-900 text-base leading-snug">
            {session.title}
          </h3>

          {session.description && (
            <p className="mt-1 text-sm text-slate-500 line-clamp-2">{session.description}</p>
          )}
        </div>
      </div>

      {/* Date / recurrence */}
      <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
        <span className="text-violet-600 font-medium">{formatDate(next)}</span>
        {session.recurrence_type && (
          <span className="text-slate-400">· {recurrenceLabel(session.recurrence_type)}</span>
        )}
      </div>

      {/* Location */}
      {(session.address || session.city || session.location_notes) && (
        <p className="mt-1.5 text-xs text-slate-500">
          📍{' '}
          {session.address
            ? session.address
            : session.city}
          {session.location_notes ? ` · ${session.location_notes}` : ''}
        </p>
      )}

      {/* Creator + participants */}
      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span>Av {creator?.full_name ?? 'Anonym'}</span>
          {isVerified && (
            <span className="inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
              ✓ Verifisert
            </span>
          )}
          {isPro && (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              Pro
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>
            {participantCount}
            {session.max_participants !== null
              ? ` / ${session.max_participants} påmeldt`
              : ' påmeldt'}
          </span>
          <span>Endret {formatUpdated(session.updated_at)}</span>
        </div>
      </div>
    </Link>
  );
}
