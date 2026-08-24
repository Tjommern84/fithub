#!/usr/bin/env tsx

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { buildContentPlanItem, needsContentReview } from '../../lib/contentClassification';
import { countBy, createServiceRoleClient, fetchAllServices, sha256 } from './common';

async function main(): Promise<void> {
  const client = createServiceRoleClient();
  console.log('Bygger migreringsplan fra Supabase (skrivebeskyttet) …');
  const services = await fetchAllServices(client);
  const plans = services.map(buildContentPlanItem);
  const jsonl = `${plans.map((plan) => JSON.stringify(plan)).join('\n')}\n`;
  const outputPath = join(process.cwd(), 'data', 'content-migration-plan.jsonl');
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, jsonl, 'utf8');

  const summary = {
    planHash: sha256(jsonl),
    records: plans.length,
    ready: plans.filter((plan) => plan.status === 'ready').length,
    review: plans.filter((plan) => plan.status === 'review').length,
    reviewQueue: plans.filter(needsContentReview).length,
    sources: countBy(plans, (plan) => plan.source),
    categories: countBy(plans.flatMap((plan) => plan.categories), (category) => category),
  };

  writeFileSync(
    join(process.cwd(), 'data', 'content-migration-plan.summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nPlan lagret: ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
