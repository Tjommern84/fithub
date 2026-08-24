#!/usr/bin/env tsx

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  buildContentPlanItem,
  categoriesForService,
  contentQualityScore,
  identifySource,
  needsContentReview,
} from '../../lib/contentClassification';
import { countBy, createServiceRoleClient, fetchAllServices } from './common';

async function main(): Promise<void> {
  const client = createServiceRoleClient();
  console.log('Henter services fra Supabase (skrivebeskyttet) …');
  const services = await fetchAllServices(client);
  const plans = services.map(buildContentPlanItem);

  const categoryCounts = Object.fromEntries(
    [...new Set(services.flatMap(categoriesForService))].map((category) => [
      category,
      services.filter((service) => categoriesForService(service).includes(category)).length,
    ]),
  );

  const report = {
    generatedAt: new Date().toISOString(),
    totalServices: services.length,
    sources: countBy(services, identifySource),
    currentPrimaryCategories: countBy(services, (service) => service.main_category ?? '(tom)'),
    plannedCategories: categoryCounts,
    plannedEntities: {
      providers: new Set(plans.flatMap((plan) => plan.provider?.id ?? [])).size,
      venues: new Set(plans.flatMap((plan) => plan.venue?.id ?? [])).size,
      offerings: plans.filter((plan) => plan.offeringId).length,
      ready: plans.filter((plan) => plan.status === 'ready').length,
      review: plans.filter((plan) => plan.status === 'review').length,
      reviewQueue: plans.filter(needsContentReview).length,
    },
    quality: {
      scoreBelow40: services.filter((service) => contentQualityScore(service) < 40).length,
      missingCity: services.filter((service) => !service.city).length,
      missingAddress: services.filter((service) => !service.address).length,
      missingCoordinates: services.filter((service) => service.lat === null || service.lon === null).length,
      missingAllContact: services.filter((service) => !service.website && !service.phone && !service.email).length,
      invalidPrimaryCategory: services.filter((service) => service.main_category === 'trene-samen').length,
    },
    reviewReasons: countBy(
      plans.flatMap((plan) => plan.reasons),
      (reason) => reason,
    ),
  };

  const outputPath = join(process.cwd(), 'data', 'content-audit.json');
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nRapport lagret: ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
