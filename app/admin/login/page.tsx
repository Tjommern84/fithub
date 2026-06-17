'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { container, label } from '../../../lib/ui';

type LoginStatus = 'idle' | 'sending' | 'sent' | 'error';

function AdminLoginContent() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/admin';
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<LoginStatus>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        window.location.href = `/admin/verify?next=${encodeURIComponent(next)}`;
      }
    });
  }, [next]);

  return (
    <main className={`${container} py-16`}>
      <Card className="mx-auto max-w-md">
        <p className="text-xs uppercase tracking-wide text-slate-500">Admin</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Admin innlogging</h1>
        <p className="mt-3 text-sm text-slate-600">
          Bruk administratore-post. Verifisering med authenticator-app kreves etter e-postlenken.
        </p>

        {!isSupabaseConfigured ? (
          <p className="mt-6 text-sm text-rose-600">Supabase er ikke konfigurert.</p>
        ) : (
          <form
            className="mt-6 grid gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setStatus('sending');
              setMessage('');

              if (!email.trim()) {
                setStatus('error');
                setMessage('Skriv inn e-postadresse.');
                return;
              }

              if (!supabase) {
                setStatus('error');
                setMessage('Supabase er ikke konfigurert.');
                return;
              }

              const redirectTo = `${window.location.origin}/admin/verify?next=${encodeURIComponent(
                next
              )}`;
              const { error } = await supabase.auth.signInWithOtp({
                email: email.trim().toLowerCase(),
                options: {
                  emailRedirectTo: redirectTo,
                },
              });

              if (error) {
                setStatus('error');
                setMessage(
                  error.status === 429
                    ? 'For mange forsok. Vent litt og prov igjen.'
                    : error.status === 422
                    ? 'Admin innlogging er ikke aktivert. Kontakt systemansvarlig.'
                    : 'Kunne ikke sende innloggingslenke.'
                );
                return;
              }

              setStatus('sent');
              setMessage('Sjekk e-posten din og fortsett med 2FA-verifisering.');
            }}
          >
            <div>
              <label htmlFor="admin-email" className={label}>
                E-post
              </label>
              <Input
                id="admin-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@fithub.no"
                autoComplete="email"
              />
            </div>
            <Button type="submit" disabled={status === 'sending'}>
              {status === 'sending' ? 'Sender ...' : 'Send innloggingslenke'}
            </Button>
            {message && (
              <p className={`text-sm ${status === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}>
                {message}
              </p>
            )}
          </form>
        )}
      </Card>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <main className={`${container} py-16`}>
          <Card className="mx-auto max-w-md">
            <p className="text-sm text-slate-600">Laster admin innlogging ...</p>
          </Card>
        </main>
      }
    >
      <AdminLoginContent />
    </Suspense>
  );
}
