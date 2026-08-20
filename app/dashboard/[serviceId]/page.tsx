'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import {
  getLeadsForOwnedService,
  getOwnedServices,
  getServiceAnalytics,
  getProfileViewTrend,
  type ServiceAnalytics,
  type WeeklyView,
} from '../actions';
import { ButtonLink } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { container } from '../../../lib/ui';

type LeadRow = {
  id: string;
  service_id: string;
  name: string;
  email: string;
  message: string;
  created_at: string;
};

export default function ServiceLeadsPage({
  params: paramsPromise,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const params = use(paramsPromise);
  const [session, setSession] = useState<Session | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [serviceName, setServiceName] = useState('Laster ...');
  const [analytics, setAnalytics] = useState<ServiceAnalytics | null>(null);
  const [trend, setTrend] = useState<WeeklyView[]>([]);

  useEffect(() => {
    if (!supabase) return;
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) setSession(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.access_token) return;
    const loadData = async () => {
      setStatus('loading');
      const [data, ownedList, analyticsData, trendData] = await Promise.all([
        getLeadsForOwnedService(session.access_token, params.serviceId),
        getOwnedServices(session.access_token),
        getServiceAnalytics(session.access_token, params.serviceId),
        getProfileViewTrend(session.access_token, params.serviceId),
      ]);
      setLeads(data);
      setAnalytics(analyticsData);
      setTrend(trendData);
      const found = ownedList.find((s) => s.id === params.serviceId);
      if (found?.name) setServiceName(found.name);
      else setServiceName('Tjeneste');
      setStatus('idle');
    };
    loadData();
  }, [session, params.serviceId]);

  if (!isSupabaseConfigured) {
    return (
      <main className={`${container} py-16`}>
        <Card>
          <h1 className="text-2xl font-semibold text-slate-900">Leads</h1>
          <p className="mt-3 text-sm text-slate-600">Supabase er ikke konfigurert.</p>
          <ButtonLink href="/dashboard" className="mt-6">
            Tilbake til dashboard
          </ButtonLink>
        </Card>
      </main>
    );
  }

  if (!session) {
    return (
      <main className={`${container} py-16`}>
        <Card>
          <h1 className="text-2xl font-semibold text-slate-900">Leads</h1>
          <p className="mt-3 text-sm text-slate-600">Logg inn for å se leads.</p>
          <ButtonLink href="/dashboard" className="mt-6">
            Tilbake til dashboard
          </ButtonLink>
        </Card>
      </main>
    );
  }

  return (
    <main className={`${container} py-12`}>
      <Link href="/dashboard" className="text-sm font-medium text-slate-500 hover:text-slate-700">
        Tilbake til dashboard
      </Link>
      <h1 className="mt-4 text-3xl font-semibold text-slate-900">{serviceName}</h1>

      {analytics && (
        <div className="mt-4 flex flex-wrap gap-4">
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-center">
            <p className="text-2xl font-bold text-slate-900">{analytics.views7d}</p>
            <p className="mt-0.5 text-xs text-slate-400">Profilvisninger siste 7 dager</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-center">
            <p className="text-2xl font-bold text-slate-900">{analytics.views30d}</p>
            <p className="mt-0.5 text-xs text-slate-400">Profilvisninger siste 30 dager</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-center">
            <p className="text-2xl font-bold text-slate-900">{leads.length}</p>
            <p className="mt-0.5 text-xs text-slate-400">Forespørsler totalt</p>
          </div>
        </div>
      )}

      {trend.length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <p className="mb-3 text-sm font-medium text-slate-700">Profilvisninger per uke (siste 8 uker)</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={trend} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Line
                type="monotone"
                dataKey="views"
                stroke="#e11d48"
                strokeWidth={2}
                dot={{ r: 3, fill: '#e11d48' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {status === 'loading' && (
        <div className="mt-6 text-sm text-slate-500">Laster leads ...</div>
      )}

      <div className="mt-6 grid gap-4">
        {leads.map((lead) => (
          <Link
            key={lead.id}
            href={`/dashboard/leads/${lead.id}`}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{lead.name}</h2>
                <p className="text-sm text-slate-500">{lead.email}</p>
              </div>
              <div className="text-xs text-slate-500">
                {new Date(lead.created_at).toLocaleDateString('no-NO')}
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-700">{lead.message}</p>
          </Link>
        ))}
      </div>

      {status === 'idle' && leads.length === 0 && (
        <Card className="mt-6 text-sm text-slate-600">
          Ingen leads enda. Del profilen din for å få de første forespørslene.
        </Card>
      )}
    </main>
  );
}
