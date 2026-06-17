# FitHub – Skill-indeks

Denne filen er inngangspunktet for agentic coding på FitHub-prosjektet.
Last alltid riktig skill-fil for domenet du jobber i – ikke hele kodebasen.

## Domener

| # | Skill-fil | Domene | Nøkkelord |
|---|-----------|--------|-----------|
| 1 | `01-search-discovery.md` | Søk & Oppdagelse | søk, filter, resultater, kart, PostGIS, search_services |
| 2 | `02-frontpage-categories.md` | Forside & Kategorier | forside, kategorier, CategoryGrid, lokasjon, TopNav |
| 3 | `03-group-sessions.md` | Gruppetimer & Arrangementer | gruppetimer, arrangementer, påmelding, gjentakelse |
| 4 | `04-provider.md` | Tilbyder / Provider | tilbyder, leads, bookinger, vurderinger, dashboard |
| 5 | `05-user-profile.md` | Bruker (Min Side) | bruker, profil, telefon, GDPR, samtykke, min-side |
| 6 | `06-email-notifications.md` | E-post & Varsling | e-post, varsler, Resend, maler, notifikasjoner |
| 7 | `07-infrastructure.md` | Infrastruktur & Felles | Supabase, types, feature-flags, UI-komponenter, analytics |
| 8 | `08-payments-b2b.md` | Betaling & Organisasjon | Stripe, betaling, org, B2B, webhook, invitasjon |
| 9 | `09-admin-import.md` | Admin & Dataimport | admin, import, scripts, cache, BRREG, Google Places |

## Domene-avhengigheter (forenklet)

```
Domene 7 (Infrastruktur)
  ← brukes av alle andre domener

Domene 2 (Forside)
  → trigger Domene 1 (Søk)

Domene 1 (Søk)
  → viser innhold fra Domene 3 (Gruppetimer)

Domene 4 (Tilbyder)
  → bruker Domene 5 (Bruker) for profil
  → kaller Domene 6 (E-post) for varsler
  → sjekker Domene 8 (Betaling) for abonnement

Domene 3 (Gruppetimer)
  → krever phone_verified_at fra Domene 5 (Bruker)

Domene 8 (Betaling)
  → oppdaterer Domene 5 (Bruker) via webhook

Domene 9 (Admin/Import)
  → bruker Domene 1 for geocoding-logikk
  → kaller Domene 6 for admin-e-poster
```

## Globale gotchas (gjelder alle domener)

| Gotcha | Regel |
|--------|-------|
| React 18.2 skjemastate | Bruk `useFormState`/`useFormStatus` fra `react-dom` – aldri `useActionState` |
| Dynamiske Tailwind-farger | Bruk `style={{ color: theme.accent }}` – ikke dynamiske klassestrenger |
| WKT-koordinater | `SRID=4326;POINT(${lon} ${lat})` – lon ALLTID først |
| Supabase service-role | `serviceSupabase.ts` kun på server – aldri i client components |
| GRANT EXECUTE | Kjør alltid etter `DROP+CREATE` av `search_services()` |
| City-normalisering | `locationLabel.split(',')[0].trim().toLowerCase()` før DB-oppslag |
| Feature-flagg | Sjekk alltid `featureFlags.ts` for reviews, payments, emails, pilot |
| `actionWrapper.ts` | Pakk inn alle server actions for konsistent feilhåndtering |

## SQL-migrasjonsrekkefølge

```
00_schema.sql           → kjerneskjema
01_postgis_and_search   → søkefunksjon (GRANT etter DROP+CREATE!)
02_rls.sql              → row-level security
03_seed.sql             → testdata
04–11_*.sql             → kolonner, migrasjoner, backfill
12_group_sessions.sql   → gruppeøkter
```
