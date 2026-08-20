'use client';

import { use, useActionState, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useFormStatus } from 'react-dom';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../../../../../lib/supabaseClient';
import type { ChangeEvent } from 'react';
import {
  getOwnedService,
  saveAvailability,
  updateServiceProfile,
  uploadServiceImage,
} from '../../../actions';
import { Button, ButtonLink } from '../../../../../components/ui/Button';
import { Card } from '../../../../../components/ui/Card';
import { Input, Textarea } from '../../../../../components/ui/Input';
import { AvailabilitySlot, formatSlotLabel, WEEKDAY_LABELS } from '../../../../../lib/booking';
import { container, input, label } from '../../../../../lib/ui';

const goalOptions = [
  { value: 'weight_loss', label: 'Vektnedgang' },
  { value: 'strength', label: 'Styrke' },
  { value: 'mobility', label: 'Mobilitet' },
  { value: 'rehab', label: 'Rehab' },
  { value: 'endurance', label: 'Utholdenhet' },
  { value: 'start', label: 'Starte' },
];

const venueOptions = [
  { value: 'home', label: 'Hjemme' },
  { value: 'gym', label: 'Senter' },
  { value: 'online', label: 'Online' },
];

const coverageTypes = [
  { value: 'radius', label: 'Radius' },
  { value: 'cities', label: 'Byer' },
  { value: 'region', label: 'Region' },
];

type CoverageRule =
  | { type: 'radius'; center: { lat: number; lon: number }; radius_km: number }
  | { type: 'cities'; cities: string[] }
  | { type: 'region'; region: 'norway' | 'nordic' };

type ServiceFormState = {
  name: string;
  description: string;
  price_level: 'low' | 'medium' | 'high';
  goals: string[];
  venues: string[];
  tags: string;
  cancellation_hours: string;
  coverage_type: 'radius' | 'cities' | 'region';
  coverage_lat: string;
  coverage_lon: string;
  coverage_radius: string;
  coverage_cities: string;
  coverage_region: 'norway' | 'nordic';
  phone: string;
  email: string;
  website: string;
  address: string;
};

const sortAvailabilitySlots = (slots: AvailabilitySlot[]) =>
  [...slots].sort((a, b) => {
    if (a.weekday !== b.weekday) return a.weekday - b.weekday;
    if (a.start_time !== b.start_time) return a.start_time.localeCompare(b.start_time);
    return a.end_time.localeCompare(b.end_time);
  });

const SubmitButton = () => {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Lagrer ...' : 'Lagre endringer'}
    </Button>
  );
};

const parseCoverage = (coverage: unknown): ServiceFormState['coverage_type'] => {
  if (!Array.isArray(coverage) || coverage.length === 0) return 'region';
  const rule = coverage[0] as CoverageRule;
  if (rule.type === 'radius') return 'radius';
  if (rule.type === 'cities') return 'cities';
  return 'region';
};

export default function EditServicePage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = use(paramsPromise);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [formState, setFormState] = useState<ServiceFormState>({
    name: '',
    description: '',
    price_level: 'medium',
    goals: [],
    venues: [],
    tags: '',
    cancellation_hours: '24',
    coverage_type: 'region',
    coverage_lat: '',
    coverage_lon: '',
    coverage_radius: '',
    coverage_cities: '',
    coverage_region: 'norway',
    phone: '',
    email: '',
    website: '',
    address: '',
  });

  const [saveState, formAction] = useActionState(updateServiceProfile, {
    ok: false,
    message: '',
  });
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverStatus, setCoverStatus] = useState<string | null>(null);
  const [logoStatus, setLogoStatus] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [slotDraft, setSlotDraft] = useState({
    weekday: 1,
    start_time: '16:00',
    end_time: '20:00',
  });
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityState, availabilityAction] = useActionState(saveAvailability, {
    ok: false,
    message: '',
  });

  const selectedCoverage = useMemo(() => formState.coverage_type, [formState.coverage_type]);

  const completeness = useMemo(() => {
    const checks = [
      { key: 'description', label: 'Skriv en beskrivelse på minst 50 tegn', ok: formState.description.trim().length >= 50 },
      { key: 'phone',       label: 'Legg til telefonnummer',                 ok: !!formState.phone.trim() },
      { key: 'email',       label: 'Legg til e-postadresse',                 ok: !!formState.email.trim() },
      { key: 'website',     label: 'Legg til nettside',                      ok: !!formState.website.trim() },
      { key: 'address',     label: 'Legg til adresse',                       ok: !!formState.address.trim() },
      { key: 'cover',       label: 'Last opp coverbilde',                    ok: !!coverPreview },
      { key: 'logo',        label: 'Last opp logo',                          ok: !!logoPreview },
      { key: 'tags',        label: 'Legg til tags',                          ok: !!formState.tags.trim() },
      { key: 'goals',       label: 'Velg minst ett mål',                     ok: formState.goals.length > 0 },
    ];
    const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
    return { score, missing: checks.filter((c) => !c.ok).map((c) => c.label) };
  }, [formState, coverPreview, logoPreview]);
  const toSlotTime = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const parts = trimmed.split(':');
    if (parts.length === 2) {
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`;
    }
    return trimmed;
  };

  const slotMinutes = (value: string) => {
    const [hours = '0', minutes = '0'] = value.split(':');
    return Number(hours) * 60 + Number(minutes);
  };

  const handleAddSlot = () => {
    if (!slotDraft.start_time || !slotDraft.end_time) return;
    const start = toSlotTime(slotDraft.start_time);
    const end = toSlotTime(slotDraft.end_time);
    if (!start || !end) return;
    if (slotMinutes(end) <= slotMinutes(start)) return;
    setAvailabilitySlots((prev) => {
      const exists = prev.some(
        (slot) =>
          slot.weekday === slotDraft.weekday &&
          slot.start_time === start &&
          slot.end_time === end
      );
      if (exists) return prev;
      return sortAvailabilitySlots([
        ...prev,
        { weekday: slotDraft.weekday, start_time: start, end_time: end },
      ]);
    });
  };

  const handleRemoveSlot = (index: number) => {
    setAvailabilitySlots((prev) => prev.filter((_, idx) => idx !== index));
  };

  useEffect(() => {
    let isMounted = true;
    const loadAvailability = async () => {
      setAvailabilityLoading(true);
      try {
        const response = await fetch(`/api/availability?serviceId=${params.id}`);
        if (!response.ok) {
          if (isMounted) setAvailabilitySlots([]);
          return;
        }
        const payload = (await response.json()) as AvailabilitySlot[];
        if (isMounted) {
          setAvailabilitySlots(Array.isArray(payload) ? sortAvailabilitySlots(payload) : []);
        }
      } catch {
        if (isMounted) setAvailabilitySlots([]);
      } finally {
        if (isMounted) setAvailabilityLoading(false);
      }
    };
    loadAvailability();
    return () => {
      isMounted = false;
    };
  }, [params.id, availabilityState.ok]);

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
    const loadService = async () => {
      setStatus('loading');
      const data = await getOwnedService(session.access_token, params.id);
      if (!data) {
        setStatus('error');
        return;
      }
      const coverageType = parseCoverage(data.coverage);
      const rule = Array.isArray(data.coverage) && data.coverage.length > 0 ? data.coverage[0] : null;

      setFormState({
        name: data.name ?? '',
        description: data.description ?? '',
        price_level: data.price_level ?? 'medium',
        goals: Array.isArray(data.goals) ? data.goals : [],
        venues: Array.isArray(data.venues) ? data.venues : [],
        tags: Array.isArray(data.tags) ? data.tags.join(', ') : '',
        cancellation_hours: String(data.cancellation_hours ?? 24),
        coverage_type: coverageType,
        coverage_lat: rule && rule.type === 'radius' ? String(rule.center.lat) : '',
        coverage_lon: rule && rule.type === 'radius' ? String(rule.center.lon) : '',
        coverage_radius: rule && rule.type === 'radius' ? String(rule.radius_km) : '',
        coverage_cities: rule && rule.type === 'cities' ? rule.cities.join(', ') : '',
        coverage_region: rule && rule.type === 'region' ? rule.region : 'norway',
        phone: data.phone ?? '',
        email: data.email ?? '',
        website: data.website ?? '',
        address: data.address ?? '',
      });
      setCoverPreview(data.cover_image_url ?? null);
      setLogoPreview(data.logo_image_url ?? null);
      setStatus('idle');
    };
    loadService();
  }, [params.id, session]);

  const handleUpload =
    (kind: 'cover' | 'logo') => (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !session?.access_token) return;

      const statusSetter = kind === 'cover' ? setCoverStatus : setLogoStatus;
      const uploadingSetter = kind === 'cover' ? setCoverUploading : setLogoUploading;
      const previewSetter = kind === 'cover' ? setCoverPreview : setLogoPreview;

      statusSetter(null);
      uploadingSetter(true);

      startTransition(async () => {
        try {
          const formData = new FormData();
          formData.append('accessToken', session.access_token);
          formData.append('serviceId', params.id);
          formData.append('kind', kind);
          formData.append('file', file);

          const result = await uploadServiceImage(formData);
          if (result.ok && result.url) {
            previewSetter(result.url);
            statusSetter(result.message ?? 'Bildet er lastet opp.');
          } else {
            statusSetter(result.message ?? 'Kunne ikke laste opp bildet.');
          }
        } catch {
          statusSetter('Kunne ikke laste opp bildet.');
        } finally {
          uploadingSetter(false);
          event.target.value = '';
        }
      });
    };

  if (!isSupabaseConfigured) {
    return (
      <main className={`${container} py-16`}>
        <Card>
          <h1 className="text-2xl font-semibold text-slate-900">Rediger tjeneste</h1>
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
          <h1 className="text-2xl font-semibold text-slate-900">Rediger tjeneste</h1>
          <p className="mt-3 text-sm text-slate-600">Logg inn for å redigere.</p>
          <ButtonLink href="/dashboard" className="mt-6">
            Tilbake til dashboard
          </ButtonLink>
        </Card>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className={`${container} py-16`}>
        <Card>
          <h1 className="text-2xl font-semibold text-slate-900">Rediger tjeneste</h1>
          <p className="mt-3 text-sm text-slate-600">
            Fant ikke tjenesten eller du har ikke tilgang.
          </p>
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

      <Card className="mt-6 p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Rediger tjeneste</h1>

        {status === 'loading' && (
          <div className="mt-4 text-sm text-slate-500">Laster data ...</div>
        )}

        {saveState.message && (
          <div
            className={`mt-4 rounded-lg px-4 py-3 text-sm ${
              saveState.ok
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {saveState.message}
          </div>
        )}

        <form className="mt-6 grid gap-6" action={formAction}>
          <input type="hidden" name="serviceId" value={params.id} />
          <input type="hidden" name="accessToken" value={session.access_token} />

          <div className="grid gap-2">
            <label htmlFor="name" className={label}>
              Navn
            </label>
            <Input
              id="name"
              name="name"
              value={formState.name}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, name: event.target.value }))
              }
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="description" className={label}>
              Beskrivelse
            </label>
            <Textarea
              id="description"
              name="description"
              rows={5}
              value={formState.description}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, description: event.target.value }))
              }
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="price_level" className={label}>
              Prisnivå
            </label>
            <select
              id="price_level"
              name="price_level"
              value={formState.price_level}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  price_level: event.target.value as ServiceFormState['price_level'],
                }))
              }
              className={input}
            >
              <option value="low">Lav</option>
              <option value="medium">Middels</option>
              <option value="high">Høy</option>
            </select>
          </div>

          <div className="grid gap-2">
            <label htmlFor="cancellation_hours" className={label}>
              Avbestillingsfrist (timer)
            </label>
            <Input
              id="cancellation_hours"
              name="cancellation_hours"
              type="number"
              min={0}
              step={1}
              value={formState.cancellation_hours}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, cancellation_hours: event.target.value }))
              }
            />
          </div>

          <div>
            <p className={label}>Mål</p>
            <div className="mt-2 flex flex-wrap gap-3">
              {goalOptions.map((goal) => (
                <label key={goal.value} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="goals"
                    value={goal.value}
                    checked={formState.goals.includes(goal.value)}
                    onChange={(event) => {
                      setFormState((prev) => ({
                        ...prev,
                        goals: event.target.checked
                          ? [...prev.goals, goal.value]
                          : prev.goals.filter((item) => item !== goal.value),
                      }));
                    }}
                  />
                  {goal.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className={label}>Tilbys som</p>
            <div className="mt-2 flex flex-wrap gap-3">
              {venueOptions.map((venue) => (
                <label key={venue.value} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="venues"
                    value={venue.value}
                    checked={formState.venues.includes(venue.value)}
                    onChange={(event) => {
                      setFormState((prev) => ({
                        ...prev,
                        venues: event.target.checked
                          ? [...prev.venues, venue.value]
                          : prev.venues.filter((item) => item !== venue.value),
                      }));
                    }}
                  />
                  {venue.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className={label}>Dekning</p>
            <div className="mt-2 flex flex-wrap gap-3">
              {coverageTypes.map((type) => (
                <label key={type.value} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="coverage_type"
                    value={type.value}
                    checked={selectedCoverage === type.value}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        coverage_type: event.target.value as ServiceFormState['coverage_type'],
                      }))
                    }
                  />
                  {type.label}
                </label>
              ))}
            </div>

            {selectedCoverage === 'radius' && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Input
                  type="text"
                  name="coverage_lat"
                  value={formState.coverage_lat}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, coverage_lat: event.target.value }))
                  }
                  placeholder="Lat"
                />
                <Input
                  type="text"
                  name="coverage_lon"
                  value={formState.coverage_lon}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, coverage_lon: event.target.value }))
                  }
                  placeholder="Lon"
                />
                <Input
                  type="text"
                  name="coverage_radius"
                  value={formState.coverage_radius}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, coverage_radius: event.target.value }))
                  }
                  placeholder="Radius km"
                />
              </div>
            )}

            {selectedCoverage === 'cities' && (
              <Input
                type="text"
                name="coverage_cities"
                value={formState.coverage_cities}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, coverage_cities: event.target.value }))
                }
                className="mt-4"
                placeholder="Oslo, Bergen, ..."
              />
            )}

            {selectedCoverage === 'region' && (
              <select
                name="coverage_region"
                value={formState.coverage_region}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    coverage_region: event.target.value as ServiceFormState['coverage_region'],
                  }))
                }
                className={`${input} mt-4`}
              >
                <option value="norway">Hele Norge</option>
                <option value="nordic">Hele Norden</option>
              </select>
            )}
          </div>

          <div className="grid gap-2">
            <label htmlFor="tags" className={label}>
              Tags (kommaseparert)
            </label>
            <Input
              id="tags"
              name="tags"
              value={formState.tags}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, tags: event.target.value }))
              }
            />
          </div>

          {/* Kontaktinfo */}
          <div className="border-t border-slate-100 pt-6">
            <p className="text-sm font-semibold text-slate-700 mb-4">Kontaktinformasjon</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label htmlFor="phone" className={label}>Telefon</label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="12345678"
                  value={formState.phone}
                  onChange={(event) => setFormState((prev) => ({ ...prev, phone: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="contact_email" className={label}>E-post (offentlig)</label>
                <Input
                  id="contact_email"
                  name="email"
                  type="email"
                  placeholder="post@dinbedrift.no"
                  value={formState.email}
                  onChange={(event) => setFormState((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="website" className={label}>Nettside</label>
                <Input
                  id="website"
                  name="website"
                  type="url"
                  placeholder="https://dinbedrift.no"
                  value={formState.website}
                  onChange={(event) => setFormState((prev) => ({ ...prev, website: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="address" className={label}>Adresse</label>
                <Input
                  id="address"
                  name="address"
                  placeholder="Storgata 1, Oslo"
                  value={formState.address}
                  onChange={(event) => setFormState((prev) => ({ ...prev, address: event.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Profilkomplettering */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-700">Profilkomplettering</p>
              <span
                className={`text-sm font-bold ${
                  completeness.score >= 80
                    ? 'text-emerald-600'
                    : completeness.score >= 50
                    ? 'text-amber-600'
                    : 'text-rose-600'
                }`}
              >
                {completeness.score}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  completeness.score >= 80
                    ? 'bg-emerald-500'
                    : completeness.score >= 50
                    ? 'bg-amber-400'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${completeness.score}%` }}
              />
            </div>
            {completeness.missing.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {completeness.missing.map((tip) => (
                  <li key={tip} className="flex items-start gap-2 text-xs text-slate-600">
                    <span className="mt-0.5 shrink-0 text-slate-400">○</span>
                    {tip}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs font-medium text-emerald-600">Profilen er komplett!</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <SubmitButton />
            {saveState.ok && (
              <Link
                href={`/tilbyder/${params.id}`}
                className="text-sm font-semibold text-slate-900"
              >
                Se offentlig profil
              </Link>
            )}
          </div>
        </form>

        {/* Bilder */}
        <div className="mt-10 border-t border-slate-100 pt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Bilder
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Cover */}
            <div className="space-y-3">
              <p className={label}>Coverbilde (1200×630 px anbefalt)</p>
              {coverPreview && (
                <Image
                  src={coverPreview}
                  alt="Cover"
                  width={1200}
                  height={630}
                  unoptimized
                  className="w-full h-32 object-cover rounded-lg border border-slate-200"
                />
              )}
              {coverStatus && (
                <p className="text-xs text-slate-500">{coverStatus}</p>
              )}
              <label className="block">
                <span className="sr-only">Last opp coverbilde</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={coverUploading || isPending}
                  onChange={handleUpload('cover')}
                  className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-4 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                />
              </label>
              {coverUploading && <p className="text-xs text-slate-400">Laster opp ...</p>}
            </div>

            {/* Logo */}
            <div className="space-y-3">
              <p className={label}>Logo (kvadratisk, maks 5 MB)</p>
              {logoPreview && (
                <Image
                  src={logoPreview}
                  alt="Logo"
                  width={160}
                  height={160}
                  unoptimized
                  className="w-20 h-20 object-cover rounded-full border border-slate-200"
                />
              )}
              {logoStatus && (
                <p className="text-xs text-slate-500">{logoStatus}</p>
              )}
              <label className="block">
                <span className="sr-only">Last opp logo</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={logoUploading || isPending}
                  onChange={handleUpload('logo')}
                  className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-4 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                />
              </label>
              {logoUploading && <p className="text-xs text-slate-400">Laster opp ...</p>}
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-100 pt-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Tilgjengelighet
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Definer ukentlig tilgjengelighet levert av deg.
              </p>
            </div>
            {availabilityLoading && (
              <p className="text-xs text-slate-500">Laster tilgjengelighet …</p>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <p className={label}>Ukedag</p>
              <select
                value={slotDraft.weekday}
                onChange={(event) =>
                  setSlotDraft((prev) => ({
                    ...prev,
                    weekday: Number(event.target.value),
                  }))
                }
                className={input}
              >
                {Object.entries(WEEKDAY_LABELS).map(([key, labelText]) => (
                  <option key={key} value={Number(key)}>
                    {labelText}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <p className={label}>Starttid</p>
              <Input
                type="time"
                value={slotDraft.start_time}
                onChange={(event) =>
                  setSlotDraft((prev) => ({ ...prev, start_time: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <p className={label}>Sluttid</p>
              <Input
                type="time"
                value={slotDraft.end_time}
                onChange={(event) =>
                  setSlotDraft((prev) => ({ ...prev, end_time: event.target.value }))
                }
              />
            </div>
            <div className="flex items-end">
              <Button type="button" onClick={handleAddSlot}>
                Legg til
              </Button>
            </div>
          </div>

          <div className="mt-4">
            {availabilitySlots.length === 0 ? (
              <p className="text-sm text-slate-500">Ingen slots er lagt inn enda.</p>
            ) : (
              <ul className="space-y-2">
                {availabilitySlots.map((slot, index) => (
                  <li
                    key={`${slot.weekday}-${slot.start_time}-${slot.end_time}-${index}`}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                  >
                    <span>{formatSlotLabel(slot)}</span>
                    <button
                      type="button"
                      className="text-xs font-semibold uppercase tracking-wide text-rose-600"
                      onClick={() => handleRemoveSlot(index)}
                    >
                      Fjern
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form className="mt-6 space-y-3" action={availabilityAction}>
            <input type="hidden" name="serviceId" value={params.id} />
            <input type="hidden" name="accessToken" value={session.access_token} />
            <input type="hidden" name="slots" value={JSON.stringify(availabilitySlots)} />
            {availabilityState.message && (
              <div
                className={`rounded-lg px-4 py-3 text-sm ${
                  availabilityState.ok
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border border-rose-200 bg-rose-50 text-rose-700'
                }`}
              >
                {availabilityState.message}
              </div>
            )}
            <Button type="submit" disabled={!session}>
              Lagre tilgjengelighet
            </Button>
          </form>
        </div>
      </Card>
    </main>
  );
}
