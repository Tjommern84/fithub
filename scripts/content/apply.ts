#!/usr/bin/env tsx

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildContentPlanItem,
  contentQualityScore,
  HOME_CATEGORY_KEYS,
  needsContentReview,
  type ContentMigrationPlanItem,
  type LegacyServiceContent,
} from '../../lib/contentClassification';
import {
  chunks,
  createServiceRoleClient,
  fetchAllServices,
  getStringArg,
  parseNonNegativeIntegerArg,
  parsePositiveIntegerArg,
  sha256,
} from './common';

type DbRow = Record<string, unknown>;

async function upsertBatches(
  client: SupabaseClient,
  table: string,
  rows: DbRow[],
  onConflict: string,
): Promise<void> {
  for (const batch of chunks(rows)) {
    if (batch.length === 0) continue;
    const { error } = await client.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function resolveStalePendingReviews(
  client: SupabaseClient,
  selectedServiceIds: Set<string>,
  currentReviewIds: Set<string>,
): Promise<number> {
  const pendingIds: string[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from('content_review_queue')
      .select('service_id')
      .eq('status', 'pending')
      .order('service_id')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Kunne ikke lese vurderingskøen: ${error.message}`);
    const page = (data ?? []) as Array<{ service_id: string }>;
    pendingIds.push(...page.map((row) => row.service_id));
    if (page.length < pageSize) break;
  }

  const staleIds = pendingIds.filter(
    (serviceId) => selectedServiceIds.has(serviceId) && !currentReviewIds.has(serviceId),
  );
  const resolvedAt = new Date().toISOString();
  for (const batch of chunks(staleIds)) {
    const { error } = await client
      .from('content_review_queue')
      .update({ status: 'resolved', resolved_at: resolvedAt })
      .eq('status', 'pending')
      .in('service_id', batch);
    if (error) throw new Error(`Kunne ikke lukke foreldede køelementer: ${error.message}`);
  }
  return staleIds.length;
}

async function fetchReviewStates(
  client: SupabaseClient,
  serviceIds: string[],
): Promise<Map<string, { status: string; resolved_at: string | null }>> {
  const states = new Map<string, { status: string; resolved_at: string | null }>();
  for (const batch of chunks(serviceIds)) {
    if (batch.length === 0) continue;
    const { data, error } = await client
      .from('content_review_queue')
      .select('service_id,status,resolved_at')
      .in('service_id', batch);
    if (error) throw new Error(`Kunne ikke lese eksisterende køstatus: ${error.message}`);
    for (const row of (data ?? []) as Array<{
      service_id: string;
      status: string;
      resolved_at: string | null;
    }>) {
      states.set(row.service_id, { status: row.status, resolved_at: row.resolved_at });
    }
  }
  return states;
}

function uniqueHighestQualityRows(rows: DbRow[], key: (row: DbRow) => string): DbRow[] {
  const result = new Map<string, DbRow>();
  for (const row of rows) {
    const rowKey = key(row);
    const existing = result.get(rowKey);
    const quality = Number(row.quality_score ?? 0);
    const existingQuality = Number(existing?.quality_score ?? -1);
    if (!existing || quality > existingQuality) result.set(rowKey, row);
  }
  return [...result.values()];
}

function parsePlan(rawPlan: string): ContentMigrationPlanItem[] {
  return rawPlan.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try {
      const plan = JSON.parse(line) as Partial<ContentMigrationPlanItem> | null;
      if (!plan || typeof plan.serviceId !== 'string') {
        throw new Error('serviceId mangler');
      }
      return plan as ContentMigrationPlanItem;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Ugyldig migreringsplan på linje ${index + 1}: ${message}`);
    }
  });
}

function validatePlans(
  plans: ContentMigrationPlanItem[],
  serviceById: Map<string, LegacyServiceContent>,
): void {
  const knownCategories = new Set<string>(HOME_CATEGORY_KEYS);
  const seenServiceIds = new Set<string>();
  const missing: string[] = [];
  const stale: string[] = [];

  for (const plan of plans) {
    if (seenServiceIds.has(plan.serviceId)) {
      throw new Error(`Migreringsplanen inneholder duplikat serviceId: ${plan.serviceId}`);
    }
    seenServiceIds.add(plan.serviceId);

    if (!Array.isArray(plan.categories) || plan.categories.some((key) => !knownCategories.has(key))) {
      throw new Error(`Migreringsplanen har ugyldig kategori for ${plan.serviceId}`);
    }
    if (plan.status === 'ready' && (!plan.offeringId || (!plan.provider && !plan.venue))) {
      throw new Error(`Migreringsplanen har en ufullstendig ready-rad for ${plan.serviceId}`);
    }

    const service = serviceById.get(plan.serviceId);
    if (!service) {
      missing.push(plan.serviceId);
      continue;
    }
    if (!isDeepStrictEqual(plan, buildContentPlanItem(service))) stale.push(plan.serviceId);
  }

  if (missing.length > 0) {
    throw new Error(
      `${missing.length} tjenester fra planen finnes ikke lenger. Bygg planen på nytt. Eksempel: ${missing.slice(0, 3).join(', ')}`,
    );
  }
  if (stale.length > 0) {
    throw new Error(
      `${stale.length} tjenester er endret etter planlegging. Kjør content:plan på nytt. Eksempel: ${stale.slice(0, 3).join(', ')}`,
    );
  }
}

function deliveryMode(service: LegacyServiceContent): string {
  const tags = (service.tags ?? []).map((tag) => tag.toLowerCase());
  const online = tags.some((tag) => tag.includes('online') || tag.includes('digital'));
  const mobile = tags.some((tag) => tag.includes('hjemmetrening'));
  if (online && (service.address || service.lat !== null)) return 'hybrid';
  if (online) return 'online';
  if (mobile && !service.address) return 'mobile';
  return 'onsite';
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const shouldApply = args.includes('--apply');
  const maxRecords = parsePositiveIntegerArg(args, 'max-records');
  const limit = parsePositiveIntegerArg(args, 'limit');
  const offset = parseNonNegativeIntegerArg(args, 'offset') ?? 0;
  const planArg = getStringArg(args, 'plan');
  const planPath = resolve(planArg ?? join(process.cwd(), 'data', 'content-migration-plan.jsonl'));
  const rawPlan = readFileSync(planPath, 'utf8');
  const allPlans = parsePlan(rawPlan);
  const plans = allPlans.slice(offset, limit ? offset + limit : undefined);

  if (shouldApply && maxRecords === null) {
    throw new Error('--apply krever --max-records=<antall> som sikkerhetsgrense');
  }
  if (shouldApply && plans.length > (maxRecords ?? 0)) {
    throw new Error(`Planen har ${plans.length} rader, over --max-records=${maxRecords}`);
  }

  const client = createServiceRoleClient();
  const { error: schemaError } = await client.from('content_categories').select('key').limit(1);
  if (schemaError) {
    throw new Error(`Datamodellen mangler. Kjør sql/42_content_model.sql først: ${schemaError.message}`);
  }

  const services = await fetchAllServices(client);
  const serviceById = new Map(services.map((service) => [service.id, service]));
  validatePlans(plans, serviceById);
  const selected = plans;
  const ready = selected.filter((plan) => plan.status === 'ready' && plan.offeringId);
  const review = selected.filter((plan) => plan.status === 'review');

  const summary = {
    mode: shouldApply ? 'apply' : 'dry-run',
    planPath,
    planHash: sha256(rawPlan),
    selected: selected.length,
    ready: ready.length,
    review: review.length,
    providers: new Set(ready.flatMap((plan) => plan.provider?.id ?? [])).size,
    venues: new Set(ready.flatMap((plan) => plan.venue?.id ?? [])).size,
    offerings: ready.length,
    categoryLinks: ready.reduce((sum, plan) => sum + plan.categories.length, 0),
    reviewQueue: selected.filter(needsContentReview).length,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!shouldApply) {
    console.log('\nTørrkjøring ferdig. Ingen data ble endret.');
    return;
  }

  const { data: run, error: runError } = await client
    .from('content_migration_runs')
    .insert({ plan_hash: summary.planHash, counters: summary })
    .select('id')
    .single();
  if (runError || !run) throw new Error(`Kunne ikke starte migreringsrunde: ${runError?.message}`);
  const runId = String(run.id);

  try {
    const providerCandidates = ready.flatMap((plan) => {
      if (!plan.provider) return [];
      const service = serviceById.get(plan.serviceId)!;
      return [{
        id: plan.provider.id,
        name: plan.provider.name,
        legal_name: plan.provider.legalName,
        orgnr: plan.provider.orgnr,
        provider_kind: plan.provider.providerKind,
        website: service.website,
        phone: service.phone,
        email: service.email,
        verification_status: 'imported',
        quality_score: contentQualityScore(service),
        is_active: service.is_active !== false,
        updated_at: new Date().toISOString(),
      }];
    });
    const providers = uniqueHighestQualityRows(providerCandidates, (row) => String(row.id));

    const venues = ready.flatMap((plan) => {
      if (!plan.venue) return [];
      const service = serviceById.get(plan.serviceId)!;
      return [{
        id: plan.venue.id,
        provider_id: plan.provider?.id ?? null,
        name: plan.venue.name,
        venue_kind: plan.venue.venueKind,
        address: service.address,
        city: service.city,
        lat: service.lat,
        lon: service.lon,
        website: service.website,
        phone: service.phone,
        email: service.email,
        status: service.is_active === false ? 'inactive' : 'active',
        quality_score: contentQualityScore(service),
        updated_at: new Date().toISOString(),
      }];
    });

    const offerings = ready.map((plan) => {
      const service = serviceById.get(plan.serviceId)!;
      return {
        id: plan.offeringId!,
        provider_id: plan.provider?.id ?? null,
        name: service.name,
        description: service.description,
        delivery_mode: deliveryMode(service),
        price_level: service.price_level,
        tags: service.tags ?? [],
        goals: service.goals ?? [],
        is_active: service.is_active !== false,
        updated_at: new Date().toISOString(),
      };
    });

    const offeringVenues = ready.flatMap((plan) => plan.venue ? [{
      offering_id: plan.offeringId!,
      venue_id: plan.venue.id,
      is_primary: true,
    }] : []);
    const offeringCategories = ready.flatMap((plan) => plan.categories.map((category, index) => ({
      offering_id: plan.offeringId!,
      category_key: category,
      is_primary: index === 0,
    })));
    const serviceCategories = ready.flatMap((plan) => plan.categories.map((category) => ({
      service_id: plan.serviceId,
      category_id: category,
    })));
    const sourceRows = ready.flatMap((plan) => {
      const rows: DbRow[] = [{
        source: plan.source,
        external_id: plan.sourceExternalId,
        entity_type: 'offering',
        provider_id: null,
        venue_id: null,
        offering_id: plan.offeringId,
        confidence: plan.confidence,
      }];
      if (plan.provider) rows.push({
        source: plan.source,
        external_id: plan.sourceExternalId,
        entity_type: 'provider',
        provider_id: plan.provider.id,
        venue_id: null,
        offering_id: null,
        confidence: plan.provider.confidence,
      });
      if (plan.venue) rows.push({
        source: plan.source,
        external_id: plan.sourceExternalId,
        entity_type: 'venue',
        provider_id: null,
        venue_id: plan.venue.id,
        offering_id: null,
        confidence: plan.venue.confidence,
      });
      return rows;
    });
    const legacyMap = ready.map((plan) => ({
      service_id: plan.serviceId,
      provider_id: plan.provider?.id ?? null,
      venue_id: plan.venue?.id ?? null,
      offering_id: plan.offeringId,
      migration_run_id: runId,
      confidence: plan.confidence,
      status: 'migrated',
      reasons: plan.reasons,
      migrated_at: new Date().toISOString(),
    }));
    const reviewPlans = selected.filter(needsContentReview);
    const existingReviewStates = await fetchReviewStates(
      client,
      reviewPlans.map((plan) => plan.serviceId),
    );
    const reviewRows = reviewPlans.map((plan) => {
      const existing = existingReviewStates.get(plan.serviceId);
      return {
        service_id: plan.serviceId,
        reasons: plan.reasons,
        suggested_action: plan,
        status: existing?.status ?? 'pending',
        resolved_at: existing?.resolved_at ?? null,
      };
    });

    await upsertBatches(client, 'providers', providers, 'id');
    await upsertBatches(client, 'venues', venues, 'id');
    await upsertBatches(client, 'offerings', offerings, 'id');
    await upsertBatches(client, 'offering_venues', offeringVenues, 'offering_id,venue_id');
    await upsertBatches(client, 'offering_categories', offeringCategories, 'offering_id,category_key');
    await upsertBatches(client, 'service_categories', serviceCategories, 'service_id,category_id');
    await upsertBatches(client, 'content_sources', sourceRows, 'source,external_id,entity_type');
    await upsertBatches(client, 'legacy_service_map', legacyMap, 'service_id');
    await upsertBatches(client, 'content_review_queue', reviewRows, 'service_id');
    const resolvedReviewQueue = await resolveStalePendingReviews(
      client,
      new Set(selected.map((plan) => plan.serviceId)),
      new Set(reviewRows.map((row) => String(row.service_id))),
    );

    // Compatibility bridge: current search RPC already maps these service types to homepage categories.
    const serviceTypes = ready.flatMap((plan) => {
      const rows: DbRow[] = [];
      if (plan.categories.includes('helse')) rows.push({ service_id: plan.serviceId, type: 'helse', is_primary: false });
      if (plan.categories.includes('utendors')) rows.push({ service_id: plan.serviceId, type: 'outdoor', is_primary: false });
      if (plan.categories.includes('paraidrett')) rows.push({ service_id: plan.serviceId, type: 'sport', is_primary: false });
      return rows;
    });
    await upsertBatches(client, 'service_types', serviceTypes, 'service_id,type');

    for (const batch of chunks(ready.filter((plan) => {
      const service = serviceById.get(plan.serviceId)!;
      return service.main_category === 'trene-samen';
    }).map((plan) => plan.serviceId))) {
      const { error } = await client.from('services').update({ main_category: 'trene-sammen' }).in('id', batch);
      if (error) throw new Error(`Rettet ikke trene-samen: ${error.message}`);
    }
    for (const batch of chunks(ready.filter((plan) => plan.categories.includes('paraidrett')).map((plan) => plan.serviceId))) {
      const { error } = await client.from('services').update({ main_category: 'paraidrett' }).in('id', batch);
      if (error) throw new Error(`Kunne ikke aktivere paraidrett: ${error.message}`);
    }

    const counters = {
      ...summary,
      providers: providers.length,
      venues: venues.length,
      offerings: offerings.length,
      reviewQueue: reviewRows.length,
      resolvedReviewQueue,
    };
    const { error: finishError } = await client.from('content_migration_runs').update({
      status: 'completed',
      counters,
      completed_at: new Date().toISOString(),
    }).eq('id', runId);
    if (finishError) throw new Error(`Migrert, men kunne ikke ferdigstille loggen: ${finishError.message}`);
    console.log(`\nMigrering fullført. Run ID: ${runId}`);
  } catch (error) {
    await client.from('content_migration_runs').update({
      status: 'failed',
      error_message: error instanceof Error ? error.message : String(error),
      completed_at: new Date().toISOString(),
    }).eq('id', runId);
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
