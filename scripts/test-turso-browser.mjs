import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.TURSO_TEST_BASE_URL ?? 'http://localhost:3100';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const output = '.tmp/turso';
await mkdir(output, { recursive: true });
const report = { generatedAt: new Date().toISOString(), mode: 'Real Edge and live read-only trail API; one deliberately simulated 503; external browser resources blocked', checks: [], pageErrors: [] };
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_ok, fail) => fail?.({ code: 1, message: 'QA denied' });
  });
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push(error.message));
  const home = await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
  assert.equal(home.status(), 200);
  assert(await page.locator('h1').count() > 0);
  report.checks.push({ name: 'Homepage responds and renders heading', passed: true });
  const initialResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/trails' && response.status() === 200, { timeout: 120000 });
  await page.goto(`${base}/tur`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const initialTrails = await (await initialResponse).json();
  assert(initialTrails.length > 0);
  await page.getByRole('button', { name: 'Fotrute', exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('path.leaflet-interactive')].some(path => {
    const bounds = path.getBoundingClientRect();
    return bounds.width > 0 && bounds.height > 0;
  }), undefined, { timeout: 30000 });
  report.checks.push({ name: 'Live viewport loads and draws trail polylines', passed: true, routes: initialTrails.length });
  const badBounds = await context.request.get(`${base}/api/trails?minLon=10&minLat=60&maxLon=9&maxLat=59`);
  assert.equal(badBounds.status(), 400);
  report.checks.push({ name: 'Invalid bounds rejected', passed: true });
  const missingBounds = await context.request.get(`${base}/api/trails`, { timeout: 30000 });
  assert.equal(missingBounds.status(), 400);
  report.checks.push({ name: 'Missing bounds rejected', passed: true });
  const nearest = await context.request.get(`${base}/api/trails/nearest?lat=59.744&lon=10.204&radiusKm=5&limit=5`, { timeout: 60000 });
  assert.equal(nearest.status(), 200);
  const nearestRows = await nearest.json();
  assert(nearestRows.length > 0 && nearestRows.length <= 5);
  report.checks.push({ name: 'Live nearest trail query', passed: true, routes: nearestRows.length });
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1000);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  report.checks.push({ name: 'Mobile 390px has no document overflow', passed: true });
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: true });
  const failOnce = async route => {
    await route.fulfill({ status: 503, json: { error: 'QA temporary failure' } });
    await page.unroute('**/api/trails?*', failOnce);
  };
  await page.route('**/api/trails?*', failOnce);
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Kunne ikke oppdatere turrutene' }).waitFor({ timeout: 30000 });
  assert(await page.locator('path.leaflet-interactive').count() > 0);
  const retryResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/trails' && response.status() === 200, { timeout: 60000 });
  await page.getByRole('button', { name: 'Prøv igjen', exact: true }).click();
  await retryResponse;
  await page.getByRole('alert').filter({ hasText: 'Kunne ikke oppdatere turrutene' }).waitFor({ state: 'hidden' });
  report.checks.push({ name: 'One simulated 503 preserves routes; retry uses real API and clears error', passed: true });
  const hugeStarted = Date.now();
  const hugeBounds = await context.request.get(`${base}/api/trails?minLon=-180&minLat=-90&maxLon=180&maxLat=90`, { timeout: 30000 });
  const elapsedMs = Date.now() - hugeStarted;
  assert(elapsedMs < 30000);
  assert([200, 503].includes(hugeBounds.status()));
  const hugeData = await hugeBounds.json();
  if (hugeBounds.status() === 200) {
    assert(Array.isArray(hugeData));
    assert(hugeData.reduce((count, row) => count + row.coordinates.length, 0) <= 250000);
  } else assert.equal(typeof hugeData.error, 'string');
  report.checks.push({ name: 'World bounds completes within 30 seconds with bounded data or controlled error', passed: true, status: hugeBounds.status(), elapsedMs });
  assert.deepEqual(report.pageErrors, []);
} catch (error) {
  report.failure = error.message;
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(`${output}/browser-report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
