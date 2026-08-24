#!/usr/bin/env tsx

import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceRoleClient } from './common';

async function exactCount(client: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await client.from(table).select('*', { count: 'exact', head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function main(): Promise<void> {
  const client = createServiceRoleClient();
  const tables = [
    'services', 'providers', 'venues', 'offerings', 'offering_categories',
    'offering_venues', 'content_sources', 'legacy_service_map', 'content_review_queue',
    'content_category_listings',
  ];
  const counts = Object.fromEntries(await Promise.all(
    tables.map(async (table) => [table, await exactCount(client, table)]),
  ));

  const { count: pendingReviews, error: pendingReviewError } = await client
    .from('content_review_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (pendingReviewError) throw new Error(pendingReviewError.message);

  const { count: completedRuns, error: completedRunsError } = await client
    .from('content_migration_runs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed');
  if (completedRunsError) throw new Error(completedRunsError.message);

  const { count: invalidCategories, error: invalidError } = await client
    .from('services')
    .select('*', { count: 'exact', head: true })
    .eq('main_category', 'trene-samen');
  if (invalidError) throw new Error(invalidError.message);

  const { count: paraServices, error: paraError } = await client
    .from('services')
    .select('*', { count: 'exact', head: true })
    .eq('main_category', 'paraidrett');
  if (paraError) throw new Error(paraError.message);

  const categoryKeys = [
    'trene-selv', 'trene-sammen', 'oppfolging', 'helse',
    'aktivitet-sport', 'paraidrett', 'utendors',
  ];
  const byCategory = Object.fromEntries(await Promise.all(categoryKeys.map(async (key) => {
    const { count, error } = await client
      .from('offering_categories')
      .select('*', { count: 'exact', head: true })
      .eq('category_key', key);
    if (error) throw new Error(`offering_categories/${key}: ${error.message}`);
    return [key, count ?? 0];
  })));

  const homepageSearch = Object.fromEntries(await Promise.all(categoryKeys.map(async (key) => {
    const { data, error } = await client.rpc('search_services', {
      p_city: null,
      // search_services krever et geografisk anker. Oslo + stor radius tester
      // kategorifiltreringen uten å gjøre testen avhengig av én bestemt byrad.
      p_lat: 59.9139,
      p_lon: 10.7522,
      p_goal: 'any',
      p_service_type: 'any',
      p_budget: 'any',
      p_venue: null,
      p_sort: 'best_match',
      p_query: null,
      p_tag: null,
      p_main_category: key,
      p_tags: null,
      p_radius_km: 1000,
      p_limit: 1,
    });
    if (error) throw new Error(`search_services/${key}: ${error.message}`);
    return [key, Array.isArray(data) && data.length > 0];
  })));

  const structuredCategorySearch = Object.fromEntries(await Promise.all(categoryKeys.map(async (key) => {
    const { data, error } = await client.rpc('search_content_category_services', {
      p_main_category: key,
      // Uten geografisk anker kontrollerer vi at hver kategori kan leses fra
      // den nye modellen, uavhengig av hvor tilbyderne holder til.
      p_lat: null,
      p_lon: null,
      p_radius_km: 50,
      p_limit: 1,
      p_offset: 0,
    });
    if (error) throw new Error(`search_content_category_services/${key}: ${error.message}`);
    return [key, Array.isArray(data) && data.length > 0];
  })));

  const structuredResultsSearch = Object.fromEntries(await Promise.all(categoryKeys.map(async (key) => {
    const { data, error } = await client.rpc('search_content_services', {
      p_main_category: key,
      p_lat: null,
      p_lon: null,
      p_radius_km: 50,
      p_service_type: 'any',
      p_venue: 'either',
      p_query: null,
      p_tags: null,
      p_sort: 'best_match',
      p_limit: 1,
      p_offset: 0,
    });
    if (error) throw new Error(`search_content_services/${key}: ${error.message}`);
    return [key, Array.isArray(data) && data.length > 0];
  })));

  const { data: structuredOsloData, error: structuredOsloError } = await client.rpc(
    'search_content_services',
    {
      p_main_category: null,
      p_lat: 59.9139,
      p_lon: 10.7522,
      p_radius_km: 50,
      p_service_type: 'any',
      p_venue: 'either',
      p_query: null,
      p_tags: null,
      p_sort: 'nearest',
      p_limit: 100,
      p_offset: 0,
    },
  );
  if (structuredOsloError) throw new Error(`search_content_services/oslo: ${structuredOsloError.message}`);
  const structuredOsloRows = (Array.isArray(structuredOsloData) ? structuredOsloData : []) as Array<{
    service_id?: string;
  }>;
  const structuredOsloIds = structuredOsloRows
    .map((row) => row.service_id)
    .filter((id): id is string => typeof id === 'string');

  const structuredFilterCases = [
    { key: 'query', query: 'styrke', serviceType: 'any', tags: null, category: null },
    { key: 'type', query: null, serviceType: 'styrke', tags: null, category: null },
    { key: 'tag', query: null, serviceType: 'any', tags: ['tuftepark'], category: 'utendors' },
  ] as const;
  const structuredFilterSearch = Object.fromEntries(await Promise.all(
    structuredFilterCases.map(async (filterCase) => {
      const { data, error } = await client.rpc('search_content_services', {
        p_main_category: filterCase.category,
        p_lat: 59.9139,
        p_lon: 10.7522,
        p_radius_km: 50,
        p_service_type: filterCase.serviceType,
        p_venue: 'either',
        p_query: filterCase.query,
        p_tags: filterCase.tags,
        p_sort: 'best_match',
        p_limit: 1,
        p_offset: 0,
      });
      if (error) throw new Error(`search_content_services/${filterCase.key}: ${error.message}`);
      return [filterCase.key, Array.isArray(data) && data.length > 0];
    }),
  ));

  const report = {
    verifiedAt: new Date().toISOString(),
    counts,
    categories: byCategory,
    homepageSearch,
    structuredCategorySearch,
    structuredResultsSearch,
    structuredFilterSearch,
    legacyCorrections: {
      invalidTreneSamen: invalidCategories ?? 0,
      paraidrettPrimary: paraServices ?? 0,
    },
    migration: {
      completedRuns: completedRuns ?? 0,
      pendingReviews: pendingReviews ?? 0,
      coveredServices: counts.legacy_service_map + (pendingReviews ?? 0),
    },
    checks: {
      completedMigrationExists: (completedRuns ?? 0) > 0,
      mappedRowsDoNotExceedServices: counts.legacy_service_map <= counts.services,
      allServicesAccountedFor:
        counts.legacy_service_map + (pendingReviews ?? 0) === counts.services,
      mappedServicesHaveOfferings: counts.offerings === counts.legacy_service_map,
      offeringsHaveCategories: counts.offering_categories >= counts.offerings,
      publicListingIsPopulated: counts.content_category_listings > 0,
      typoRemoved: (invalidCategories ?? 0) === 0,
      allHomepageCategoriesPopulated: categoryKeys.every((key) => (byCategory[key] ?? 0) > 0),
      allHomepageCategoriesSearchable: categoryKeys.every((key) => homepageSearch[key] === true),
      allStructuredCategoriesSearchable:
        categoryKeys.every((key) => structuredCategorySearch[key] === true),
      allStructuredResultsCategoriesSearchable:
        categoryKeys.every((key) => structuredResultsSearch[key] === true),
      structuredResultsReturnNearbyRows: structuredOsloRows.length > 0,
      structuredResultsHaveUniqueServices:
        new Set(structuredOsloIds).size === structuredOsloIds.length,
      structuredResultsFiltersWork:
        structuredFilterCases.every((filterCase) => structuredFilterSearch[filterCase.key] === true),
    },
  };
  console.log(JSON.stringify(report, null, 2));
  if (Object.values(report.checks).some((value) => !value)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
