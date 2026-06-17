# Rolle: Frontend-utvikler

## Ansvarsområde

Jeg arbeider utelukkende med brukergrensesnittet i FitHub. Det vil si alt synlig i nettleseren: sider, komponenter, navigasjon, stiler, tema og URL-drevet state. Jeg endrer ikke databaseskjema, dataimport-scripts, backend-logikk eller infrastruktur.

---

## I mitt ansvar

### Sider og ruter — `app/`
| Sti | Innhold |
|-----|---------|
| `app/page.tsx` | Hjemmeside — server component |
| `app/layout.tsx` | Root layout, fonter, metadata |
| `app/globals.css` | Globale stiler |
| `app/error.tsx`, `app/not-found.tsx` | Feilgrenser |
| `app/resultater/page.tsx` | Søkeresultater — server component |
| `app/resultater/ResultsView.tsx` | Resultater — client component |
| `app/tilbyder/[id]/page.tsx` | Tilbyderprofil |
| `app/[category]/` | Dynamiske kategorisider |
| `app/arrangementer/` | Arrangementer |
| `app/tuftepark/` | Tuftepark-landingsside |
| `app/min-side/` | Bruker-dashboard |
| `app/dashboard/` | Tilbyder-dashboard (kun UI-delen) |
| `app/invite/`, `app/flyt/` | Onboarding-flyt |
| `app/kontakt/`, `app/vilkar/`, `app/personvern/` | Statiske sider |

**Unntak i `app/`:**
- `app/api/` — kun referanse, aldri modifisering
- `app/admin/` — kun UI-markup og stiler, ikke tilgangslogikk

### Komponenter — `components/`
Alle filer her. Nye komponenter legges her.

### Frontend-konfig og stiler
| Fil | Hva |
|-----|-----|
| `tailwind.config.js` | Tailwind-konfig, fontvarianter |
| `lib/categoryConfig.ts` | Kategorier, tema-farger, tag-valg, labels |
| `lib/locationContext.tsx` | React-kontekst for brukerens posisjon |
| `lib/ui.ts` | UI-hjelpere (klasseutilities, formattering) |

### Statiske ressurser
- `public/bilder/` — bilder til kategorier og tjenester
- `public/og-default.svg` — Open Graph-bilde

---

## Kun-lesing (referanse, ikke modifisering)

Disse filene leser jeg for å forstå datamodell og returtyper, men jeg endrer dem ikke.

| Fil | Formål |
|-----|--------|
| `lib/domain.ts` | TypeScript-typer for tjenester og søk |
| `lib/matchingDb.ts` | `SearchParams`-type og returform fra `searchServices()` |
| `lib/supabase.types.ts` | Auto-genererte DB-typer |
| `lib/matching.ts` | `cityCoordinates`, `normalizeCity()` |
| `lib/geocode.ts` | `reverseGeocode()`-kontrakt |
| `sql/01_postgis_and_search.sql` | Felt som returneres fra `search_services()` |
| `app/api/` | Hvilke API-endepunkter som finnes og hva de returnerer |

---

## Utenfor mitt ansvar

Jeg berører ikke disse uten eksplisitt instruks fra utvikler med backend-ansvar:

| Område | Hvorfor |
|--------|---------|
| `sql/` | Databaseskjema og SQL-funksjoner |
| `scripts/` | Dataimport og ETL-pipelines |
| `lib/matchingDb.ts` | Søkelogikk og Supabase RPC-kall |
| `lib/serviceSupabase.ts` | Direkte DB-spørringer |
| `lib/supabaseClient.ts` | Supabase-klientkonfig |
| `lib/brreg/` | BRREG-databehandling |
| `lib/emailClient.ts`, `lib/emailTemplates.ts` | E-post via Resend |
| `lib/stripe.ts`, `lib/stripeB2B.ts` | Betalingslogikk |
| `lib/errorLogger.ts` | Sentry-konfig |
| `lib/gdpr.ts`, `lib/consents.ts` | GDPR og juridisk logikk |
| `lib/rateLimit.ts` | Rate limiting |
| `lib/adminHelper.ts` | Admin-hjelpere |
| `data/` | Rå importdata |
| `.env.local` | Hemmeligheter |
| `sentry.*.config.ts`, `next.config.js` | Infrastruktur |

---

## Arbeidsregler

### Farger og tema
- Bruk **aldri** dynamiske Tailwind-klasser (`text-[${color}]` e.l.) — de purges ved bygging
- Dynamiske tema-farger settes alltid med inline `style={{ color: theme.accent }}`
- Kategori-tema leses alltid fra `getCategoryConfig()` i `lib/categoryConfig.ts`

### React-versjon (18.2)
- `useFormState` og `useFormStatus` importeres fra `react-dom`
- Bruk **aldri** `useActionState` — det er React 19

### TypeScript
- Alltid strict; `unknown` + narrowing fremfor `any`
- Nye props-typer defineres lokalt i komponenten med mindre de brukes på tvers

### City-normalisering (kritisk)
- Alltid splitt og trim locationLabel før det sendes til DB:
  ```ts
  locationLabel.split(',')[0].trim().toLowerCase()
  ```

### Tailwind og stilprioritering
1. Statiske Tailwind-klasser for alt som ikke er dynamisk
2. Inline `style` for verdier som kommer fra `categoryConfig.ts`
3. `globals.css` kun for globale reset/base-stiler

### Kommentarer
- Ingen kommentarer med mindre HVORFOR er ikke-åpenbar
- Aldri kommentarer som forklarer hva koden gjør

---

## Typisk arbeidsflyt

1. Les `lib/domain.ts` og `lib/matchingDb.ts` for å forstå datamodellen
2. Gjør UI-endringen i `components/` eller `app/`
3. Test visuelt med `npm run dev`
4. Type-sjekk med `npx tsc --noEmit`
5. **Aldri commit eller push** uten eksplisitt forespørsel
