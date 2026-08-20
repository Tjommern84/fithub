'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabaseClient';
import { createGroupSession, getProfileVerification } from '../../../lib/groupSessions';
import type { RecurrenceType } from '../../../lib/groupSessions';
import { input, label, buttonPrimary, buttonSecondary, container } from '../../../lib/ui';
import Link from 'next/link';

const SESSION_TYPES = [
  'Løpegruppe', 'Gågruppe', 'Utetrening', 'Bootcamp', 'Fotball',
  'Sykkelgruppe', 'Yoga', 'Svømmeklubb', 'Klatring', 'Annet',
];

const RECURRENCE_OPTIONS: { value: RecurrenceType | ''; label: string }[] = [
  { value: '',         label: 'Enkelt økt (én gang)' },
  { value: 'weekly',   label: 'Ukentlig' },
  { value: 'biweekly', label: 'Annenhver uke' },
  { value: 'monthly',  label: 'Månedlig' },
];

export default function CreateSessionForm() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [isVerified, setIsVerified] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sessionType, setSessionType] = useState(SESSION_TYPES[0]);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [locationNotes, setLocationNotes] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceType | ''>('');
  const [recurrenceEndsAt, setRecurrenceEndsAt] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState('');
  const [paymentInfo, setPaymentInfo] = useState('');

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user?.id) {
        const pv = await getProfileVerification(data.session.user.id);
        setIsVerified(Boolean(pv?.phone_verified_at));
      }
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;
    setSubmitStatus('saving');
    setErrorMsg('');
    try {
      const result = await createGroupSession({
        creator_user_id: session.user.id,
        title: title.trim(),
        description: description.trim() || null,
        session_type: sessionType,
        tags: [sessionType.toLowerCase()],
        address: address.trim() || null,
        city: city.trim().toLowerCase() || null,
        location_notes: locationNotes.trim() || null,
        lat: null,
        lon: null,
        is_free: isFree,
        price: !isFree && price ? parseFloat(price) : null,
        payment_info: !isFree && paymentInfo.trim() ? paymentInfo.trim() : null,
        starts_at: new Date(startsAt).toISOString(),
        duration_minutes: durationMinutes ? parseInt(durationMinutes, 10) : null,
        recurrence_type: recurrence || null,
        recurrence_ends_at: recurrence && recurrenceEndsAt
          ? new Date(recurrenceEndsAt).toISOString()
          : null,
        max_participants: maxParticipants ? parseInt(maxParticipants, 10) : null,
        status: 'active',
        is_active: true,
        main_category: 'trene-sammen',
      });
      router.push(`/arrangementer/${result.id}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Noe gikk galt');
      setSubmitStatus('error');
    }
  };

  if (authLoading) {
    return <div className="py-16 text-center text-sm text-slate-400">Laster ...</div>;
  }

  if (!session) {
    return (
      <div className={`${container} py-16 text-center`}>
        <p className="text-slate-600 mb-4">Du må være innlogget for å opprette et arrangement.</p>
        <Link href="/min-side" className={buttonPrimary}>Logg inn</Link>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className={`${container} py-16 text-center`}>
        <p className="text-slate-700 font-medium mb-2">Verifiser telefonnummeret ditt</p>
        <p className="text-slate-500 text-sm mb-6">
          Du må legge til og verifisere telefonnummer i profilen din for å opprette arrangementer.
        </p>
        <Link href="/min-side#telefon" className={buttonPrimary}>Gå til Min side</Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div>
        <label className={label} htmlFor="title">Tittel *</label>
        <input
          id="title"
          className={`${input} mt-1`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="f.eks. Tirsdagsløp rundt Sognsvann"
          required
          maxLength={100}
        />
      </div>

      {/* Type */}
      <div>
        <label className={label} htmlFor="session-type">Type aktivitet *</label>
        <select
          id="session-type"
          className={`${input} mt-1`}
          value={sessionType}
          onChange={(e) => setSessionType(e.target.value)}
          required
        >
          {SESSION_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label className={label} htmlFor="description">Beskrivelse</label>
        <textarea
          id="description"
          className={`${input} mt-1 min-h-[100px] resize-y`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Fortell litt om aktiviteten, nivå, hva å ta med ..."
          maxLength={1000}
        />
      </div>

      {/* Location */}
      <fieldset className="space-y-3">
        <legend className={`${label} block`}>Sted</legend>
        <div>
          <label className="text-xs text-slate-500" htmlFor="address">Adresse</label>
          <input
            id="address"
            className={`${input} mt-0.5`}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Sognsvannsveien 1"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500" htmlFor="city">By / sted *</label>
          <input
            id="city"
            className={`${input} mt-0.5`}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Oslo"
            required
          />
        </div>
        <div>
          <label className="text-xs text-slate-500" htmlFor="location-notes">Oppmøtebeskrivelse</label>
          <input
            id="location-notes"
            className={`${input} mt-0.5`}
            value={locationNotes}
            onChange={(e) => setLocationNotes(e.target.value)}
            placeholder="Møt ved p-plassen ved inngang nord"
          />
        </div>
      </fieldset>

      {/* Date / time */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label} htmlFor="starts-at">Dato og tid *</label>
          <input
            id="starts-at"
            type="datetime-local"
            className={`${input} mt-1`}
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
        </div>
        <div>
          <label className={label} htmlFor="duration">Varighet (minutter)</label>
          <input
            id="duration"
            type="number"
            min={10}
            max={480}
            className={`${input} mt-1`}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            placeholder="60"
          />
        </div>
      </div>

      {/* Recurrence */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label} htmlFor="recurrence">Gjentagelse</label>
          <select
            id="recurrence"
            className={`${input} mt-1`}
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as RecurrenceType | '')}
          >
            {RECURRENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {recurrence && (
          <div>
            <label className={label} htmlFor="recurrence-ends">Avsluttes</label>
            <input
              id="recurrence-ends"
              type="date"
              className={`${input} mt-1`}
              value={recurrenceEndsAt}
              onChange={(e) => setRecurrenceEndsAt(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Max participants */}
      <div>
        <label className={label} htmlFor="max-participants">Maks antall deltakere</label>
        <input
          id="max-participants"
          type="number"
          min={1}
          className={`${input} mt-1`}
          value={maxParticipants}
          onChange={(e) => setMaxParticipants(e.target.value)}
          placeholder="La stå tomt for ubegrenset"
        />
      </div>

      {/* Pricing */}
      <fieldset className="space-y-3">
        <legend className={`${label} block`}>Betaling</legend>
        <label className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={isFree}
            onChange={(e) => setIsFree(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Gratis arrangement
        </label>
        {!isFree && (
          <div className="space-y-3 pl-7">
            <div>
              <label className="text-xs text-slate-500" htmlFor="price">Pris per økt (kr)</label>
              <input
                id="price"
                type="number"
                min={0}
                step={10}
                className={`${input} mt-0.5`}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="150"
                required={!isFree}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500" htmlFor="payment-info">Betalingsinformasjon</label>
              <input
                id="payment-info"
                className={`${input} mt-0.5`}
                value={paymentInfo}
                onChange={(e) => setPaymentInfo(e.target.value)}
                placeholder="Vipps til 98765432"
              />
            </div>
          </div>
        )}
      </fieldset>

      {submitStatus === 'error' && (
        <p className="text-sm text-rose-600">{errorMsg}</p>
      )}

      <div className="flex gap-3">
        <button type="submit" className={buttonPrimary} disabled={submitStatus === 'saving'}>
          {submitStatus === 'saving' ? 'Oppretter ...' : 'Opprett arrangement'}
        </button>
        <Link href="/min-side" className={buttonSecondary}>Avbryt</Link>
      </div>
    </form>
  );
}
