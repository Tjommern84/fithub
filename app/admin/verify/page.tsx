'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { container, label } from '../../../lib/ui';
import { getSafeAdminPath } from '../../../lib/safeRedirect';
import { getAdminVerificationStatus, markAdminVerifiedLogin } from './actions';

type VerifyStatus =
  | 'loading'
  | 'ready'
  | 'enroll'
  | 'enrolling'
  | 'verifying'
  | 'error'
  | 'blocked';

type MfaFactor = {
  id: string;
  factor_type?: string;
  status?: string;
  friendly_name?: string | null;
};

type TotpEnrollment = {
  qrCode: string;
  secret: string;
};

const getAal = (session: Session | null) => {
  const payload = session?.access_token?.split('.')[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = JSON.parse(window.atob(padded)) as { aal?: string };
    return decoded.aal ?? 'aal1';
  } catch {
    return null;
  }
};

function AdminVerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = getSafeAdminPath(searchParams.get('next'));
  const [status, setStatus] = useState<VerifyStatus>('loading');
  const [message, setMessage] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [factor, setFactor] = useState<MfaFactor | null>(null);
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setStatus('error');
        setMessage('Supabase er ikke konfigurert.');
        return;
      }

      const { data } = await supabase.auth.getSession();
      const currentSession = data.session;
      if (!currentSession?.access_token) {
        router.replace(`/admin/login?next=${encodeURIComponent(next)}`);
        return;
      }

      setSession(currentSession);

      const adminStatus = await getAdminVerificationStatus(currentSession.access_token);
      if (!adminStatus.ok) {
        await supabase.auth.signOut();
        setStatus('blocked');
        setMessage('Ingen admintilgang for denne brukeren.');
        return;
      }

      if (getAal(currentSession) === 'aal2') {
        await markAdminVerifiedLogin(currentSession.access_token);
        window.location.href = next;
        return;
      }

      const { data: factorsData, error } = await (supabase.auth.mfa as any).listFactors();
      if (error) {
        setStatus('error');
        setMessage('Kunne ikke hente MFA-faktorer.');
        return;
      }

      const totpFactors = ((factorsData?.totp ?? []) as MfaFactor[]).map((item) => ({
        ...item,
        factor_type: item.factor_type ?? 'totp',
      }));
      const allFactors = [...totpFactors, ...((factorsData?.all ?? []) as MfaFactor[])];

      const verifiedTotpFactors = allFactors.filter(
        (item, index, list) =>
          item.id &&
          item.factor_type === 'totp' &&
          item.status === 'verified' &&
          list.findIndex((candidate) => candidate.id === item.id) === index
      );

      if (verifiedTotpFactors.length === 0) {
        setStatus('enroll');
        setMessage('Ingen verifisert authenticator-faktor funnet for denne admin-brukeren.');
        return;
      }

      setFactor(verifiedTotpFactors[0]);
      setStatus('ready');
    };

    load();
  }, [next, router]);

  const verifyTotpCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !factor || !code.trim()) return;
    setStatus('verifying');
    setMessage('');

    let currentChallengeId = challengeId;
    if (!currentChallengeId) {
      const { data: challengeData, error: challengeError } = await (supabase.auth.mfa as any).challenge(
        { factorId: factor.id }
      );
      if (challengeError || !challengeData?.id) {
        setStatus('error');
        setMessage('Kunne ikke starte verifisering.');
        return;
      }
      currentChallengeId = challengeData.id;
      setChallengeId(currentChallengeId);
    }

    const { data, error } = await (supabase.auth.mfa as any).verify({
      factorId: factor.id,
      challengeId: currentChallengeId,
      code: code.trim(),
    });

    if (error) {
      setStatus('ready');
      setMessage(error.status === 400 ? 'Feil engangskode.' : 'Kunne ikke verifisere koden.');
      return;
    }

    const verifiedAccessToken = data?.access_token;
    const token =
      verifiedAccessToken ??
      (await supabase.auth.refreshSession()).data.session?.access_token ??
      session?.access_token;

    if (!token) {
      setStatus('error');
      setMessage('Kunne ikke oppdatere innloggingen.');
      return;
    }

    await markAdminVerifiedLogin(token);
    window.location.href = next;
  };

  const startTotpEnrollment = async () => {
    if (!supabase) return;
    setStatus('enrolling');
    setMessage('');

    const { data, error } = await (supabase.auth.mfa as any).enroll({
      factorType: 'totp',
      friendlyName: 'FitHub Admin',
    });

    if (error || !data?.id || !data?.totp?.qr_code || !data?.totp?.secret) {
      setStatus('error');
      setMessage('Kunne ikke starte authenticator-oppsett.');
      return;
    }

    setFactor({
      id: data.id,
      factor_type: 'totp',
      status: data.status ?? 'unverified',
      friendly_name: data.friendly_name ?? 'FitHub Admin',
    });
    setEnrollment({
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    });
    setStatus('ready');
    setMessage('Authenticator-oppsett startet. Skann QR-koden og skriv inn engangskoden.');
  };

  return (
    <main className={`${container} py-16`}>
      <Card className="mx-auto max-w-md">
        <p className="text-xs uppercase tracking-wide text-slate-500">Admin</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">2FA verifisering</h1>
        <p className="mt-3 text-sm text-slate-600">
          Skriv inn koden fra authenticator-appen for aa fullfore admin-innlogging.
        </p>

        {status === 'loading' && (
          <p className="mt-6 text-sm text-slate-600">Sjekker admin-tilgang ...</p>
        )}

        {(status === 'enroll' || status === 'enrolling') && (
          <div className="mt-6 grid gap-4">
            <p className="text-sm text-slate-600">
              Ingen 2FA-faktor er verifisert ennå. Start oppsett for authenticator-app.
            </p>
            <Button
              type="button"
              onClick={startTotpEnrollment}
              disabled={status === 'enrolling'}
            >
              {status === 'enrolling' ? 'Starter oppsett ...' : 'Start authenticator-oppsett'}
            </Button>
          </div>
        )}

        {enrollment?.qrCode && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Skann QR-kode
            </p>
            <div
              className="mt-3 inline-block rounded-lg bg-white p-3"
              dangerouslySetInnerHTML={{ __html: enrollment.qrCode }}
            />
            <p className="mt-3 text-xs text-slate-500">Manuell kode: {enrollment.secret}</p>
          </div>
        )}

        {(status === 'ready' || status === 'verifying') && (
          <form className="mt-6 grid gap-4" onSubmit={verifyTotpCode}>
            <div>
              <label htmlFor="admin-totp-code" className={label}>
                Engangskode
              </label>
              <Input
                id="admin-totp-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
              />
            </div>
            <Button type="submit" disabled={status === 'verifying' || !code.trim()}>
              {status === 'verifying' ? 'Verifiserer ...' : 'Bekreft kode'}
            </Button>
          </form>
        )}

        {message && (
          <p
            className={`mt-4 text-sm ${
              status === 'blocked' || status === 'error' ? 'text-rose-600' : 'text-slate-600'
            }`}
          >
            {message}
          </p>
        )}
      </Card>
    </main>
  );
}

export default function AdminVerifyPage() {
  return (
    <Suspense
      fallback={
        <main className={`${container} py-16`}>
          <Card className="mx-auto max-w-md">
            <p className="text-sm text-slate-600">Laster 2FA-verifisering ...</p>
          </Card>
        </main>
      }
    >
      <AdminVerifyContent />
    </Suspense>
  );
}
