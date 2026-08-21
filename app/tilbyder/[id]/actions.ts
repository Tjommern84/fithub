'use server';

import { createHash } from 'crypto';
import { headers } from 'next/headers';
import { sendEmail, isEmailConfigured } from '../../../lib/emailClient';
import { logError } from '../../../lib/errorLogger';
import { wrapServerAction } from '../../../lib/actionWrapper';
import { leadCreatedEmail, serviceClaimedEmail } from '../../../lib/emailTemplates';
import { hasRequiredConsents } from '../../../lib/consents';
import { shouldSendEmail } from '../../../lib/notificationPreferences';
import { trackEvent } from '../../../lib/analytics';
import { ENABLE_EMAILS, ENABLE_PAYMENTS, ENABLE_REVIEWS } from '../../../lib/featureFlags';
import { isStripeConfigured } from '../../../lib/stripe';
import { getOrgSubscriptionStatusForUser, recordOrgLead } from '../../../lib/organizations';
import { invalidateServiceCaches } from '../../../lib/cacheInvalidation';
import { getServiceSupabase } from '../../../lib/serviceSupabase';
import { getUserSupabase } from '../../../lib/userSupabase';
import { isRateLimited } from '../../../lib/rateLimit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../lib/supabase.types';

export type LeadActionState = {
  ok: boolean;
  message: string;
};

export type ReviewActionState = {
  ok: boolean;
  message: string;
};

type ReviewRow = {
  id: string;
  lead_id: string | null;
  rating: number;
  comment: string;
  created_at: string;
};

type ReviewSummary = {
  avg: number;
  count: number;
};

type ClaimStatus = {
  ok: boolean;
  status: 'claimed' | 'already_claimed' | 'not_found' | 'unauthorized';
  message: string;
};

type EmailEventType = 'lead_created' | 'provider_replied';

const getSupabase = getUserSupabase;

const hasEmailEvent = async (
  supabase: SupabaseClient<Database>,
  type: EmailEventType,
  leadId: string,
  recipientEmail: string
) => {
  const { data } = await supabase
    .from('email_events')
    .select('id')
    .eq('type', type)
    .eq('lead_id', leadId)
    .eq('recipient_email', recipientEmail)
    .maybeSingle();

  return Boolean(data?.id);
};

const logEmailEvent = async (
  supabase: SupabaseClient<Database>,
  type: EmailEventType,
  leadId: string,
  recipientEmail: string
) => {
  await supabase.from('email_events').insert({
    type,
    lead_id: leadId,
    recipient_email: recipientEmail,
  });
};

const getProfileById = async (supabase: SupabaseClient<Database>, userId: string) => {
  const { data } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('id', userId)
    .maybeSingle();

  return data as { id: string; email?: string; full_name?: string } | null;
};

const normalizeSuggestionTimes = (values: unknown[]): Date[] => {
  const normalized: Date[] = [];
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (!text) continue;
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) continue;
    normalized.push(parsed);
    if (normalized.length >= 3) break;
  }
  return normalized;
};

const persistLeadTimeSuggestions = async (leadId: string, suggestions: Date[]) => {
  if (suggestions.length === 0) return;
  const serviceClient = getServiceSupabase();
  if (!serviceClient) return;
  const rows = suggestions.map((date) => ({
    lead_id: leadId,
    suggested_at: date.toISOString(),
  }));
  const { error } = await serviceClient.from('lead_time_suggestions').insert(rows);
  if (error) {
    await logError({
      level: 'error',
      source: 'server_action',
      context: 'lead_time_suggestions_insert',
      message: error.message ?? 'Kunne ikke lagre foreslåtte tider.',
      metadata: { lead_id: leadId },
    });
  }
};

export async function getServiceOwner(serviceId: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase || !serviceId) return null;
  const { data } = await supabase
    .from('services')
    .select('owner_user_id')
    .eq('id', serviceId)
    .maybeSingle();

  return data?.owner_user_id ?? null;
}

export async function claimService(
  _prevState: ClaimStatus,
  formData: FormData
): Promise<ClaimStatus> {
  const accessToken = String(formData.get('accessToken') ?? '');
  const serviceId = String(formData.get('serviceId') ?? '');

  if (!accessToken) {
    return { ok: false, status: 'unauthorized', message: 'Du må være innlogget.' };
  }

  if (!serviceId) {
    return { ok: false, status: 'not_found', message: 'Ugyldig tjeneste.' };
  }

  const supabase = getSupabase(accessToken);
  if (!supabase) {
    return { ok: false, status: 'unauthorized', message: 'Mangler Supabase-konfigurasjon.' };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return { ok: false, status: 'unauthorized', message: 'Innloggingen er ikke gyldig lenger.' };
  }

  const { data: current } = await supabase
    .from('services')
    .select('owner_user_id')
    .eq('id', serviceId)
    .maybeSingle();

  if (!current) {
    return { ok: false, status: 'not_found', message: 'Fant ikke tjenesten.' };
  }

  if (current.owner_user_id) {
    return {
      ok: false,
      status: 'already_claimed',
      message: 'Denne tjenesten er allerede claimet.',
    };
  }

  const { data: updated } = await supabase
    .from('services')
    .update({ owner_user_id: userData.user.id })
    .eq('id', serviceId)
    .is('owner_user_id', null)
    .select('id');

  if (!updated || updated.length === 0) {
    return {
      ok: false,
      status: 'already_claimed',
      message: 'Denne tjenesten ble nettopp claimet av noen andre.',
    };
  }

  return { ok: true, status: 'claimed', message: 'Tjenesten er claimet.' };
}

const createLeadHandler = async (
  _prevState: LeadActionState,
  formData: FormData
): Promise<LeadActionState> => {
  if (!ENABLE_PAYMENTS || !isStripeConfigured) {
    return { ok: false, message: 'Betaling er ikke aktivert ennå. Prøv igjen senere.' };
  }

  const accessToken = String(formData.get('accessToken') ?? '');
  const serviceId = String(formData.get('serviceId') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();
  const suggestionDates = normalizeSuggestionTimes(formData.getAll('suggestions[]'));

  if (!accessToken) {
    return { ok: false, message: 'Du må være innlogget.' };
  }

  if (!serviceId || !name || !email || !message) {
    return { ok: false, message: 'Fyll inn navn, e-post og melding.' };
  }

  if (message.length < 20) {
    return { ok: false, message: 'Meldingen må være minst 20 tegn.' };
  }

  const supabase = getSupabase(accessToken);
  if (!supabase) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };
  }

  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    return { ok: false, message: 'Innloggingen er ikke gyldig lenger.' };
  }

  const consentOk = await hasRequiredConsents(accessToken);
  if (!consentOk) {
    return {
      ok: false,
      message: 'Du må godta vilkår og personvern før du kan sende forespørsel.',
    };
  }

  const orgSubscription = await getOrgSubscriptionStatusForUser(data.user.id);
  if (orgSubscription && orgSubscription !== 'active') {
    return { ok: false, message: 'Bedriftens abonnement er ikke aktivt.' };
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: dailyCount } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', data.user.id)
    .gte('created_at', since);

  if ((dailyCount ?? 0) >= 3) {
    return {
      ok: false,
      message: 'Du har nådd grensen på 3 forespørsler per døgn. Prøv igjen senere.',
    };
  }

  const { data: recentLead } = await supabase
    .from('leads')
    .select('id')
    .eq('user_id', data.user.id)
    .eq('service_id', serviceId)
    .gte('created_at', since)
    .maybeSingle();

  if (recentLead) {
    return {
      ok: false,
      message: 'Du har allerede sendt en forespørsel til denne tilbyderen siste 24 timer.',
    };
  }

  const { data: serviceStatus } = await supabase
    .from('services')
    .select('subscription_status, is_active')
    .eq('id', serviceId)
    .maybeSingle();

  if (!serviceStatus || serviceStatus.is_active === false) {
    return { ok: false, message: 'Denne tjenesten er midlertidig deaktivert.' };
  }

  if (serviceStatus.subscription_status !== 'active') {
    return { ok: false, message: 'Tilbyderen har ikke aktivt abonnement.' };
  }

  const { data: insertedLead, error: insertError } = await supabase
    .from('leads')
    .insert({
      user_id: data.user.id,
      service_id: serviceId,
      name,
      email,
      message,
    })
    .select('id')
    .single();

  if (insertError) {
    await logError({
      level: 'error',
      source: 'server_action',
      context: 'lead_create',
      message: insertError.message ?? 'Kunne ikke lagre forespørselen.',
      metadata: { serviceId },
    });
    return { ok: false, message: 'Kunne ikke lagre forespørselen.' };
  }

  await trackEvent({
    type: 'lead_created',
    serviceId,
    accessToken,
  });

  if (insertedLead?.id) {
    await recordOrgLead(insertedLead.id);
    if (suggestionDates.length > 0) {
      await persistLeadTimeSuggestions(insertedLead.id, suggestionDates);
    }
  }

  const { data: service } = await supabase
    .from('services')
    .select('id, name, owner_user_id')
    .eq('id', serviceId)
    .maybeSingle();

  if (ENABLE_EMAILS && isEmailConfigured && service?.owner_user_id && insertedLead?.id) {
    const profile = await getProfileById(supabase, service.owner_user_id);
    const recipientEmail = profile?.email;
    const serviceName = service.name ?? 'tjenesten';

    if (recipientEmail) {
      const alreadySent = await hasEmailEvent(
        supabase,
        'lead_created',
        insertedLead.id,
        recipientEmail
      );
      if (!alreadySent) {
        const allowed = await shouldSendEmail(service.owner_user_id, 'lead_created');
        if (allowed) {
          const emailContent = leadCreatedEmail({
            serviceName,
            userName: name,
            message,
          });
          const sendResult = await sendEmail({
            to: recipientEmail,
            subject: emailContent.subject,
            body: emailContent.body,
          });
          if (sendResult.ok) {
            await logEmailEvent(supabase, 'lead_created', insertedLead.id, recipientEmail);
          }
        }
      }
    }
  }

  const providerName = service?.name ?? 'tilbyderen';

  return {
    ok: true,
    message: `Forespørsel sendt. Du hører snart fra ${providerName}.`,
  };
};

const addLeadTimeSuggestionsHandler = async (
  _prevState: { ok: boolean; message: string },
  formData: FormData
): Promise<{ ok: boolean; message: string }> => {
  const accessToken = String(formData.get('accessToken') ?? '');
  const leadId = String(formData.get('leadId') ?? '');
  const suggestionDates = normalizeSuggestionTimes(formData.getAll('suggestions[]'));

  if (!accessToken || !leadId) {
    return { ok: false, message: 'Manglende data for foreslåtte tider.' };
  }

  const supabase = getSupabase(accessToken);
  if (!supabase) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };
  }

  if (suggestionDates.length === 0) {
    return { ok: true, message: 'Ingen foreslåtte tider å lagre.' };
  }

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    return { ok: false, message: 'Innloggingen er ikke gyldig lenger.' };
  }

  const { data: lead } = await supabase
    .from('leads')
    .select('id, user_id')
    .eq('id', leadId)
    .maybeSingle();

  if (!lead || lead.user_id !== data.user.id) {
    return { ok: false, message: 'Du har ikke tilgang til denne forespørselen.' };
  }

  await persistLeadTimeSuggestions(leadId, suggestionDates);
  return { ok: true, message: 'Foreslåtte tider lagret.' };
};

export const createLead = wrapServerAction('lead_create', createLeadHandler);
export const addLeadTimeSuggestions = wrapServerAction(
  'lead_time_suggestions_add',
  addLeadTimeSuggestionsHandler
);

export async function getReviews(serviceId: string): Promise<ReviewRow[]> {
  if (!ENABLE_REVIEWS) return [];
  const supabase = getSupabase();
  if (!supabase || !serviceId) return [];
  const { data } = await supabase
    .from('reviews')
    .select('id, lead_id, rating, comment, created_at')
    .eq('service_id', serviceId)
    .order('created_at', { ascending: false });

  return data ?? [];
}

export async function getReviewSummary(serviceId: string): Promise<ReviewSummary> {
  if (!ENABLE_REVIEWS) return { avg: 0, count: 0 };
  const supabase = getSupabase();
  if (!supabase || !serviceId) return { avg: 0, count: 0 };

  const { data } = await supabase
    .from('reviews')
    .select('rating')
    .eq('service_id', serviceId);

  const ratings = (data ?? []).map((row) => row.rating);
  if (ratings.length === 0) return { avg: 0, count: 0 };
  const sum = ratings.reduce((acc, value) => acc + value, 0);
  return { avg: sum / ratings.length, count: ratings.length };
}

export async function canReview(
  serviceId: string,
  accessToken: string
): Promise<{ canReview: boolean; leadId?: string }> {
  if (!ENABLE_REVIEWS) return { canReview: false };
  const supabase = getSupabase(accessToken);
  if (!supabase || !serviceId || !accessToken) return { canReview: false };

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) return { canReview: false };

  const { data: leads } = await supabase
    .from('leads')
    .select('id')
    .eq('user_id', userData.user.id)
    .eq('service_id', serviceId);

  const leadIds = (leads ?? []).map((lead) => lead.id);
  if (leadIds.length === 0) return { canReview: false };

  const { data: reviews } = await supabase
    .from('reviews')
    .select('lead_id')
    .in('lead_id', leadIds);

  const reviewed = new Set((reviews ?? []).map((review) => review.lead_id));
  const availableLead = leadIds.find((id) => !reviewed.has(id));

  if (!availableLead) return { canReview: false };
  return { canReview: true, leadId: availableLead };
}

const submitReviewHandler = async (
  _prevState: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> => {
  if (!ENABLE_REVIEWS) {
    return { ok: false, message: 'Vurderinger er ikke aktivert ennå.' };
  }

  const accessToken = String(formData.get('accessToken') ?? '');
  const leadId = String(formData.get('lead_id') ?? '');
  const ratingValue = Number(formData.get('rating') ?? 0);
  const comment = String(formData.get('comment') ?? '').trim();

  if (!accessToken) {
    return { ok: false, message: 'Du må være innlogget.' };
  }

  if (!leadId || !comment || Number.isNaN(ratingValue)) {
    return { ok: false, message: 'Fyll inn rating og kommentar.' };
  }

  if (comment.length < 10) {
    return { ok: false, message: 'Kommentaren må være minst 10 tegn.' };
  }

  const supabase = getSupabase(accessToken);
  if (!supabase) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };
  }

  if (ratingValue < 1 || ratingValue > 5) {
    return { ok: false, message: 'Rating må være mellom 1 og 5.' };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return { ok: false, message: 'Innloggingen er ikke gyldig lenger.' };
  }

  const { data: leadData } = await supabase
    .from('leads')
    .select('id, service_id, user_id')
    .eq('id', leadId)
    .single();

  if (!leadData || leadData.user_id !== userData.user.id) {
    return { ok: false, message: 'Du kan ikke vurdere denne forespørselen.' };
  }

  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('lead_id', leadId)
    .maybeSingle();

  if (existing) {
    return { ok: false, message: 'Denne forespørselen er allerede vurdert.' };
  }

  const { error: insertError } = await supabase.from('reviews').insert({
    service_id: leadData.service_id,
    user_id: userData.user.id,
    lead_id: leadId,
    rating: ratingValue,
    comment,
  });

  if (insertError) {
    await logError({
      level: 'error',
      source: 'server_action',
      context: 'review_submit',
      message: insertError.message ?? 'Kunne ikke lagre vurderingen.',
      metadata: { leadId },
    });
    return { ok: false, message: 'Kunne ikke lagre vurderingen.' };
  }

  // Recalculate and persist rating_avg / rating_count so search ranking stays current
  const serviceClient = getServiceSupabase();
  if (serviceClient) {
    const { data: allRatings } = await serviceClient
      .from('reviews')
      .select('rating')
      .eq('service_id', leadData.service_id);

    if (allRatings && allRatings.length > 0) {
      const count = allRatings.length;
      const avg = allRatings.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / count;
      await serviceClient
        .from('services')
        .update({ rating_avg: Math.round(avg * 10) / 10, rating_count: count })
        .eq('id', leadData.service_id);
    }
  }

  await invalidateServiceCaches(leadData.service_id);

  return { ok: true, message: 'Takk for vurderingen!' };
};

export const submitReview = wrapServerAction('review_submit', submitReviewHandler);

export type ClaimWithOrgnrStatus = {
  ok: boolean;
  status: 'claimed' | 'already_claimed' | 'not_found' | 'unauthorized' | 'orgnr_mismatch' | 'no_orgnr' | 'facility';
  message: string;
};

export async function claimServiceWithOrgnr(
  _prevState: ClaimWithOrgnrStatus,
  formData: FormData
): Promise<ClaimWithOrgnrStatus> {
  const accessToken = String(formData.get('accessToken') ?? '');
  const serviceId = String(formData.get('serviceId') ?? '');
  const orgnrInput = String(formData.get('orgnr') ?? '').replace(/\s|-/g, '');

  if (!accessToken) {
    return { ok: false, status: 'unauthorized', message: 'Du må være innlogget.' };
  }
  if (!serviceId) {
    return { ok: false, status: 'not_found', message: 'Ugyldig tjeneste-ID.' };
  }
  if (!/^\d{9}$/.test(orgnrInput)) {
    return { ok: false, status: 'orgnr_mismatch', message: 'Org.nr. må være 9 siffer.' };
  }

  const supabase = getSupabase(accessToken);
  if (!supabase) {
    return { ok: false, status: 'unauthorized', message: 'Mangler Supabase-konfigurasjon.' };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return { ok: false, status: 'unauthorized', message: 'Innloggingen er ikke gyldig lenger.' };
  }

  const { data: svc } = await supabase
    .from('services')
    .select('id, name, orgnr, owner_user_id, email, provider_type')
    .eq('id', serviceId)
    .maybeSingle();

  if (!svc) {
    return { ok: false, status: 'not_found', message: 'Fant ikke tjenesten.' };
  }
  // Gate på provider_type FØR orgnr-sjekken — et anlegg har ingen tilbyder å verifisere,
  // uavhengig av om/hvilken orgnr-verdi som måtte stå på raden.
  if (svc.provider_type === 'facility') {
    return {
      ok: false,
      status: 'facility',
      message: 'Dette er et offentlig anlegg uten registrert tilbyder, og kan ikke kreves.',
    };
  }
  if (svc.owner_user_id) {
    return { ok: false, status: 'already_claimed', message: 'Denne profilen er allerede verifisert av en annen bruker.' };
  }
  if (!svc.orgnr) {
    return { ok: false, status: 'no_orgnr', message: 'Denne tjenesten har ikke et registrert org.nr. Kontakt oss for manuell verifisering.' };
  }

  const storedOrgnr = String(svc.orgnr).replace(/\s|-/g, '');
  if (storedOrgnr !== orgnrInput) {
    return { ok: false, status: 'orgnr_mismatch', message: 'Org.nr. stemmer ikke med det registrerte for denne tjenesten.' };
  }

  const { data: updated } = await supabase
    .from('services')
    .update({ owner_user_id: userData.user.id })
    .eq('id', serviceId)
    .is('owner_user_id', null)
    .select('id');

  if (!updated || updated.length === 0) {
    return { ok: false, status: 'already_claimed', message: 'Profilen ble nettopp verifisert av noen andre.' };
  }

  if (ENABLE_EMAILS && isEmailConfigured && svc.email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fithub.no';
    const emailContent = serviceClaimedEmail({
      serviceName: svc.name,
      dashboardUrl: `${appUrl}/dashboard`,
    });
    await sendEmail({ to: svc.email, subject: emailContent.subject, body: emailContent.body });
  }

  return { ok: true, status: 'claimed', message: `${svc.name} er nå verifisert og koblet til kontoen din.` };
}

const getRequestIp = async (): Promise<string> => {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown';
  return headerList.get('cf-connecting-ip') ?? 'unknown';
};

const hashIp = (ip: string): string => createHash('sha256').update(ip).digest('hex');

export type ReportServiceResult = {
  ok: boolean;
  message: string;
};

export async function reportService(
  serviceId: string,
  reason: string
): Promise<ReportServiceResult> {
  if (!serviceId) {
    return { ok: false, message: 'Ugyldig tjeneste.' };
  }

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    return { ok: false, message: 'Velg en årsak.' };
  }

  const ip = await getRequestIp();
  if (isRateLimited(`report:${ip}`, 5, 60 * 60_000)) {
    return { ok: false, message: 'Du har rapportert for mange ganger. Prøv igjen senere.' };
  }

  const serviceClient = getServiceSupabase();
  if (!serviceClient) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };
  }

  const reporterIpHash = hashIp(ip);

  const { error: insertError } = await serviceClient.from('service_reports').insert({
    service_id: serviceId,
    reason: trimmedReason,
    reporter_ip_hash: reporterIpHash,
  });

  if (insertError) {
    await logError({
      level: 'error',
      source: 'server_action',
      context: 'service_report_insert',
      message: insertError.message ?? 'Kunne ikke lagre rapporten.',
      metadata: { serviceId },
    });
    return { ok: false, message: 'Kunne ikke lagre rapporten.' };
  }

  const { error: updateError } = await serviceClient
    .from('services')
    .update({ reported_at: new Date().toISOString() })
    .eq('id', serviceId);

  if (updateError) {
    await logError({
      level: 'error',
      source: 'server_action',
      context: 'service_report_flag',
      message: updateError.message ?? 'Kunne ikke flagge tjenesten.',
      metadata: { serviceId },
    });
    return { ok: false, message: 'Kunne ikke flagge tjenesten.' };
  }

  return { ok: true, message: 'Takk for tilbakemeldingen! Vi ser på dette.' };
}
