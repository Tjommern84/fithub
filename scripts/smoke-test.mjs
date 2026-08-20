import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function getTestSession() {
  const url = process.env.SMOKE_SUPABASE_URL;
  const anonKey = process.env.SMOKE_SUPABASE_ANON_KEY;
  const email = process.env.SMOKE_AUTH_EMAIL;
  const password = process.env.SMOKE_AUTH_PASSWORD;
  const configured = [url, anonKey, email, password].filter(Boolean).length;

  if (configured === 0) return null;
  if (configured !== 4) {
    throw new Error('Autentisert smoke krever alle SMOKE_SUPABASE_* og SMOKE_AUTH_* variablene');
  }

  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(`Testbrukeren kunne ikke logge inn (HTTP ${response.status})`);
  }

  const session = await response.json();
  assert(session.access_token && session.refresh_token && session.user, 'Ugyldig testbrukersesjon');
  return {
    storageKey: `sb-${new URL(url).hostname.split('.')[0]}-auth-token`,
    session,
  };
}

async function main() {
  const requireExternals = process.env.SMOKE_REQUIRE_EXTERNALS === '1';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const badImageResponses = [];
  const httpErrors = [];

  // Smoketesten skal ikke registrere kunstige sidevisninger i produksjonsanalyse.
  await page.route('https://gc.zgo.at/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: '',
  }));

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    failedRequests.push({
      url: request.url(),
      error: request.failure()?.errorText ?? 'unknown',
    });
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      httpErrors.push({ url: response.url(), status: response.status() });
    }
    if (response.status() >= 400 && response.url().startsWith(`${baseUrl}/_next/image`)) {
      badImageResponses.push({ url: response.url(), status: response.status() });
    }
  });

  try {
    const checks = {};

    let response = await page.goto(`${baseUrl}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await page.waitForTimeout(1_000);

    checks.homeStatus = response?.status();
    checks.homeTitle = await page.title();
    checks.homeHeading = await page.getByRole('heading', { level: 1 }).innerText();
    const defaultLocation = page.getByRole('button', { name: 'Oslo', exact: true });
    await defaultLocation.waitFor({ state: 'visible', timeout: 10_000 });
    checks.defaultLocation = await defaultLocation.innerText();

    assert(checks.homeStatus === 200, `Forsiden svarte ${checks.homeStatus}`);
    assert(checks.defaultLocation === 'Oslo', 'Standardlokasjonen ble ikke lastet');

    await defaultLocation.click();
    const locationInput = page.getByPlaceholder('Adresse, sted eller postnummer…');
    await locationInput.waitFor({ state: 'visible', timeout: 5_000 });
    checks.locationInput = await locationInput.isVisible();

    const smartSearchToggle = page.getByLabel('Smart søk', { exact: true });
    assert((await smartSearchToggle.count()) === 1, 'Fant ikke ett entydig Smart søk-valg');
    await smartSearchToggle.check();
    await page.getByPlaceholder('Søk på navn, sted eller type…').fill('styrke');
    await page.getByRole('button', { name: 'Søk', exact: true }).click();
    await page.waitForURL(/\/resultater\?q=styrke/, { timeout: 15_000 });

    checks.searchUrl = page.url();
    checks.resultsHeading = await page.getByRole('heading', { level: 1 }).innerText();
    checks.providerResultCount = await page.locator('a[href^="/tilbyder/"]').count();
    if (requireExternals) {
      const firstProviderLink = page.locator('a[href^="/tilbyder/"]').first();
      await firstProviderLink.waitFor({ state: 'visible', timeout: 15_000 });
      checks.providerResultCount = await page.locator('a[href^="/tilbyder/"]').count();
      assert(checks.providerResultCount > 0, 'Søket returnerte ingen synlige tilbydertreff');
    }

    checks.generatedRoutes = {};
    for (const route of [
      '/trene-selv/oslo',
      '/trening/oslo/styrke',
      '/tuftepark/oslo',
    ]) {
      response = await page.goto(`${baseUrl}${route}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      const heading = await page.getByRole('heading', { level: 1 }).innerText();
      checks.generatedRoutes[route] = { status: response?.status(), heading };
      assert(response?.status() === 200, `${route} svarte ${response?.status()}`);
      assert(Boolean(heading.trim()), `${route} mangler hovedoverskrift`);
    }

    response = await page.goto(`${baseUrl}/tur`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await page.waitForTimeout(3_000);

    checks.trailStatus = response?.status();
    checks.trailHeading = await page.getByRole('heading', { level: 1 }).innerText();
    checks.trailFilterCount = await page
      .getByRole('button', { name: 'Fotrute', exact: true })
      .count();
    checks.desktopOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

    assert(checks.trailStatus === 200, `Tursiden svarte ${checks.trailStatus}`);
    assert(checks.trailFilterCount === 1, 'Fotrute-filteret mangler eller er duplisert');
    assert(checks.desktopOverflow === 0, 'Tursiden har horisontal overflow på desktop');

    const transitResponse = await page.request.get(
      `${baseUrl}/api/transit-stops?minLon=10.70&minLat=59.89&maxLon=10.80&maxLat=59.95`,
    );
    const transitStops = await transitResponse.json();
    checks.transitStops = {
      status: transitResponse.status(),
      count: Array.isArray(transitStops) ? transitStops.length : null,
    };
    assert(transitResponse.ok(), `Kollektivstopp svarte ${transitResponse.status()}`);
    assert(Array.isArray(transitStops), 'Kollektivstopp returnerte ikke en liste');
    if (requireExternals) {
      assert(transitStops.length > 0, 'Entur-integrasjonen returnerte ingen kollektivstopp');
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await page.waitForTimeout(500);

    checks.mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    assert(checks.mobileOverflow === 0, 'Forsiden har horisontal overflow på mobil');

    await page.goto(`${baseUrl}/dashboard`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    const dashboardGate = requireExternals
      ? page.getByText('Logg inn for å se dine tjenester.', { exact: true })
      : page.getByText(/Logg inn for å se dine tjenester\.|Supabase er ikke konfigurert\./).first();
    await dashboardGate.waitFor({ state: 'visible', timeout: 10_000 });
    checks.unauthenticatedDashboardGate = await dashboardGate.innerText();

    await page.goto(`${baseUrl}/min-side`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    const accountGate = requireExternals
      ? page.getByText('Du må være innlogget for å se forespørslene dine.', { exact: true })
      : page.getByText(/Du må være innlogget for å se forespørslene dine\.|Supabase er ikke konfigurert\./).first();
    await accountGate.waitFor({ state: 'visible', timeout: 10_000 });
    checks.unauthenticatedAccountGate = await accountGate.innerText();

    const testAuth = await getTestSession();
    checks.authenticatedFlows = testAuth ? 'tested' : 'not-configured';
    if (testAuth) {
      const authContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      await authContext.addInitScript(({ storageKey, session }) => {
        localStorage.setItem(storageKey, JSON.stringify(session));
      }, testAuth);
      const authPage = await authContext.newPage();
      await authPage.route('https://gc.zgo.at/**', (route) => route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: '',
      }));

      await authPage.goto(`${baseUrl}/dashboard`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      await authPage.getByRole('heading', { level: 1, name: 'Dine tjenester' })
        .waitFor({ state: 'visible', timeout: 15_000 });

      await authPage.goto(`${baseUrl}/min-side`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      await authPage.getByText('Fortsett der du slapp', { exact: true })
        .waitFor({ state: 'visible', timeout: 15_000 });
      await authContext.close();
    }

    const localHttpErrors = httpErrors.filter(({ url }) => url.startsWith(baseUrl));

    console.log(JSON.stringify({
      checks,
      pageErrors,
      badImageResponses,
      httpErrors,
      consoleErrors,
      failedRequests,
    }, null, 2));
    assert(pageErrors.length === 0, `Siden kastet ${pageErrors.length} JavaScript-feil`);
    assert(badImageResponses.length === 0, `${badImageResponses.length} bilder svarte med HTTP-feil`);
    assert(localHttpErrors.length === 0, `${localHttpErrors.length} lokale endepunkter svarte med HTTP-feil`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
