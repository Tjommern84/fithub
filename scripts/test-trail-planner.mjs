import { chromium } from 'playwright';

const baseUrl = process.env.TRAIL_TEST_BASE_URL ?? 'http://127.0.0.1:3000';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitUntil(check, message, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(message);
}

const destination = {
  id: 'destination-testtoppen',
  name: 'Testtoppen',
  destinationType: 'peak',
  elevationM: 321,
  lat: 59.925,
  lon: 10.71,
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    geolocation: { latitude: 59.9139, longitude: 10.7522 },
    permissions: ['geolocation'],
  });
  const page = await context.newPage();
  const footRouteCalls = [];
  const destinationBounds = [];

  await page.route('https://*.basemaps.cartocdn.com/**', route => route.fulfill({
    status: 200,
    contentType: 'image/png',
    body: Buffer.alloc(0),
  }));
  await page.route('**/api/trails?**', route => route.fulfill({ json: [] }));
  await page.route('**/api/settlements?**', route => route.fulfill({ json: [] }));
  await page.route('**/api/transit-stops?**', route => route.fulfill({ json: [] }));
  await page.route('**/api/transit', route => route.fulfill({ json: [] }));
  await page.route('**/api/destinations?**', route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('types') === 'parking') {
      return route.fulfill({ json: [] });
    }
    destinationBounds.push({
      minLat: Number(url.searchParams.get('minLat')),
      maxLat: Number(url.searchParams.get('maxLat')),
      minLon: Number(url.searchParams.get('minLon')),
      maxLon: Number(url.searchParams.get('maxLon')),
    });
    return route.fulfill({ json: [destination] });
  });
  await page.route('**/api/route?**', route => {
    const url = new URL(route.request().url());
    const fromLat = Number(url.searchParams.get('user_lat'));
    const fromLon = Number(url.searchParams.get('user_lon'));
    const toLat = Number(url.searchParams.get('dest_lat') ?? destination.lat);
    const toLon = Number(url.searchParams.get('dest_lon') ?? destination.lon);
    const profile = url.searchParams.get('profile');
    if (profile === 'foot-walking') footRouteCalls.push(url);
    return route.fulfill({
      json: {
        distanceKm: 2.4,
        durationMin: 31,
        elevationGainM: 80,
        coordinates: [[fromLon, fromLat], [toLon, toLat]],
      },
    });
  });

  try {
    const response = await page.goto(`${baseUrl}/tur`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    assert(response?.ok(), `/tur svarte ${response?.status()}`);
    await page.locator('.leaflet-container').waitFor({ state: 'visible', timeout: 15_000 });

    await waitUntil(
      () => destinationBounds.some(bounds => (
        bounds.minLat < 59.9139 && bounds.maxLat > 59.9139
        && bounds.minLon < 10.7522 && bounds.maxLon > 10.7522
      )),
      'Kartet flyttet seg ikke til nettleserens posisjon',
    );

    await page.getByRole('button', { name: 'Kartinnstillinger', exact: true }).click();
    await page.getByLabel('Sett startpunkt', { exact: true }).check();
    const map = page.locator('.leaflet-container');
    await map.click({ position: { x: 280, y: 300 } });

    const destinationButton = page.locator(
      `[data-destination-id="${destination.id}"]:visible`,
    );
    await destinationButton.waitFor({ state: 'visible', timeout: 10_000 });
    await destinationButton.click();
    const panel = page.getByTestId('destination-panel');
    await panel.waitFor({ state: 'visible', timeout: 10_000 });
    await panel.getByRole('button', { name: /Til fots 2\.4 km/ })
      .waitFor({ state: 'visible', timeout: 10_000 });

    const callsBeforeMove = footRouteCalls.length;
    await map.click({ position: { x: 520, y: 260 } });
    await waitUntil(
      () => footRouteCalls.length > callsBeforeMove,
      'Flytting av startpunkt utløste ikke ny ruteberegning',
    );
    assert(await panel.isVisible(), 'Valgt mål forsvant da startpunktet ble flyttet');

    await page.getByRole('button', { name: 'Kartinnstillinger', exact: true }).click();
    await page.getByLabel('Sett startpunkt', { exact: true }).uncheck();
    await page.getByLabel('Sett mål', { exact: true }).check();
    const callsBeforeMapGoal = footRouteCalls.length;
    await map.click({ position: { x: 430, y: 330 } });
    await waitUntil(
      () => footRouteCalls.length > callsBeforeMapGoal,
      'Kartvalgt mål utløste ikke ruteberegning',
    );
    const latestRoute = footRouteCalls.at(-1);
    assert(latestRoute?.searchParams.has('dest_lat'), 'Kartmålet sendte ikke dest_lat');
    assert(latestRoute?.searchParams.has('dest_lon'), 'Kartmålet sendte ikke dest_lon');
    await panel.getByText('Valgt mål', { exact: false }).waitFor({ state: 'visible', timeout: 10_000 });

    await page.setViewportSize({ width: 390, height: 844 });
    assert(await panel.isVisible(), 'Ruteinformasjonen er skjult på mobil');

    console.log(JSON.stringify({
      mapFollowedGeolocation: true,
      routeRecalculatedAfterStartMove: true,
      mapSelectedGoal: true,
      mobileRoutePanelVisible: true,
      footRouteCalls: footRouteCalls.length,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
