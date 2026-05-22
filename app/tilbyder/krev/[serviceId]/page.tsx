'use client';

import { useCallback, useEffect, useState } from 'react';
import { useFormState } from 'react-dom';
import Link from 'next/link';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabaseClient';
import { claimServiceWithOrgnr, type ClaimWithOrgnrStatus } from '../../[id]/actions';

type Props = { params: { serviceId: string } };

type ServiceInfo = { name: string; hasOrgnr: boolean };

const initialState: ClaimWithOrgnrStatus = {
  ok: false,
  status: 'not_found',
  message: '',
};

export default function KrevProfilPage({ params }: Props) {
  const { serviceId } = params;
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [service, setService] = useState<ServiceInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [state, formAction] = useFormState(claimServiceWithOrgnr, initialState);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let mounted = true;
    (async () => {
      const [{ data: sessionData }, { data: svcData }] = await Promise.all([
        supabase!.auth.getSession(),
        supabase!.from('services').select('name, orgnr').eq('id', serviceId).maybeSingle(),
      ]);
      if (!mounted) return;
      setSession(sessionData.session ?? null);
      if (svcData) {
        setService({ name: svcData.name, hasOrgnr: Boolean(svcData.orgnr) });
      }
      setLoading(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [serviceId]);

  const [otpEmail, setOtpEmail] = useState('');
  const [otpStatus, setOtpStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSendOtp = useCallback(async () => {
    if (!supabase || !otpEmail) return;
    setOtpStatus('sending');
    const redirectTo = typeof window !== 'undefined' ? window.location.href : `https://fithub.no/tilbyder/krev/${serviceId}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: otpEmail,
      options: { emailRedirectTo: redirectTo },
    });
    setOtpStatus(error ? 'error' : 'sent');
  }, [supabase, otpEmail, serviceId]);

  if (!isSupabaseConfigured) {
    return <ErrorPage message="Supabase er ikke konfigurert." />;
  }

  if (loading) {
    return <Shell><p className="text-slate-500 text-sm">Laster …</p></Shell>;
  }

  if (!service) {
    return <ErrorPage message="Fant ikke tjenesten." />;
  }

  if (state.ok) {
    return (
      <Shell>
        <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-6 text-center">
          <p className="text-green-700 font-semibold text-base mb-1">Profil verifisert!</p>
          <p className="text-green-600 text-sm mb-4">{state.message}</p>
          <Link
            href="/dashboard"
            className="inline-block rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
          >
            Gå til dashbordet
          </Link>
        </div>
      </Shell>
    );
  }

  if (!session) {
    return (
      <Shell>
        <h1 className="text-xl font-bold text-slate-900 mb-1">Logg inn for å verifisere</h1>
        <p className="text-slate-500 text-sm mb-5">
          Du må være innlogget for å verifisere <strong>{service.name}</strong>.
          Vi sender deg en magisk lenke på e-post.
        </p>
        {otpStatus === 'sent' ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Sjekk innboksen — lenken sender deg rett tilbake hit.
          </p>
        ) : (
          <div className="space-y-3">
            <input
              type="email"
              value={otpEmail}
              onChange={(e) => setOtpEmail(e.target.value)}
              placeholder="din@epost.no"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
            {otpStatus === 'error' && (
              <p className="text-sm text-red-600">Kunne ikke sende lenke. Prøv igjen.</p>
            )}
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={otpStatus === 'sending' || !otpEmail}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 transition-colors disabled:opacity-40"
            >
              {otpStatus === 'sending' ? 'Sender …' : 'Send magisk lenke'}
            </button>
          </div>
        )}
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-xl font-bold text-slate-900 mb-1">Verifiser profil</h1>
      <p className="text-slate-500 text-sm mb-6">
        Du er i ferd med å verifisere <strong>{service.name}</strong>.
        Oppgi org.nr. for å bekrefte at du representerer denne virksomheten.
      </p>

      {!service.hasOrgnr && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 mb-5">
          Denne tjenesten har ikke et registrert org.nr. i systemet vårt.
          Kontakt{' '}
          <a href="mailto:post@fithub.no" className="underline hover:no-underline">
            post@fithub.no
          </a>{' '}
          for manuell verifisering.
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="serviceId" value={serviceId} />
        <input type="hidden" name="accessToken" value={session.access_token} />

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="orgnr">
            Org.nr. (9 siffer)
          </label>
          <input
            id="orgnr"
            name="orgnr"
            type="text"
            inputMode="numeric"
            pattern="[\d\s-]{9,11}"
            placeholder="123 456 789"
            required
            disabled={!service.hasOrgnr}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:bg-slate-100 disabled:text-slate-400"
          />
        </div>

        {state.message && !state.ok && (
          <p className="text-sm text-red-600">{state.message}</p>
        )}

        <button
          type="submit"
          disabled={!service.hasOrgnr}
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Verifiser profil
        </button>
      </form>

      <p className="mt-4 text-xs text-slate-400 text-center">
        Feil? Kontakt{' '}
        <a href="mailto:post@fithub.no" className="underline hover:no-underline">
          post@fithub.no
        </a>
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 flex items-start justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-6">
          ← Tilbake til FitHub
        </Link>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {children}
        </div>
      </div>
    </main>
  );
}

function ErrorPage({ message }: { message: string }) {
  return (
    <Shell>
      <p className="text-red-600 text-sm">{message}</p>
      <Link href="/" className="mt-4 inline-block text-sm text-rose-600 hover:underline">
        ← Tilbake til forsiden
      </Link>
    </Shell>
  );
}
