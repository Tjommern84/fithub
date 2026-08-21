# FitHub

Norwegian marketplace matching users with gyms, PTs, sports clubs and classes — by location, goal and preference.

**Live:** [fithub.no](https://fithub.no)

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16 App Router · React 19 · TypeScript · Tailwind CSS |
| Database | Supabase (PostgreSQL + PostGIS) |
| Auth | Supabase Auth (magic link) |
| Geocoding | Nominatim (OpenStreetMap) |
| Data import | Serper.dev (Google Places API) |
| Email | Resend |
| Error tracking | Sentry |
| Hosting | Vercel |

---

## Routes

| Route | Description |
|-------|-------------|
| `/` | Homepage — 5-category grid with GPS/address search |
| `/resultater` | Results — tag filter, sort, map view, pagination |
| `/tilbyder/[id]` | Provider profile |
| `/tilbyder/krev/[serviceId]` | Claim existing profile (orgnr verification) |
| `/[category]/[city]` | Static category landing — 5 cats × 32 cities, ISR 24h |
| `/trening/[by]/[goal]` | Goal landing pages — 6 goals × 32 cities, ISR 1h |
| `/dashboard/[serviceId]` | Provider dashboard — stats, analytics, profile editor |
| `/min-side` | User dashboard — bookings, GDPR export/delete |
| `/admin/login` | Admin login — email magic link |
| `/admin/verify` | Admin 2FA — Supabase TOTP (authenticator app) |
| `/admin` | Admin panel — metrics, curation, invites |
| `/invite/[token]` | Provider invite onboarding |

---

## Search

`search_services()` — 16-param Supabase RPC. Scores on goal/type/budget/venue match, rating and PostGIS distance. Full text search via `p_query`. Source: `sql/01_postgis_and_search.sql`.

Coverage per provider in `service_coverage`: `city | radius | region`.

> **Critical:** after any `DROP FUNCTION`, re-run `GRANT EXECUTE ON FUNCTION search_services(...) TO anon, authenticated;`

---

## Setup

```bash
npm install
cp .env.example .env.local   # fill in keys
npm run dev
```

### Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://fithub.no
NEXT_PUBLIC_ENABLE_ADMIN=true
ADMIN_EMAIL=                 # dev/bootstrap fallback only; production admins live in admin_users
ADMIN_PHONE_E164=            # optional metadata in admin_users, e.g. +4712345678
ADMIN_USER_ID=               # optional bootstrap override
SERPER_API_KEY=              # data import
RESEND_API_KEY=              # transactional email
NEXT_PUBLIC_SENTRY_DSN=      # error tracking
SENTRY_ORG=                  # Sentry organization slug
SENTRY_PROJECT=              # Sentry project slug
SENTRY_AUTH_TOKEN=           # secret, source-map upload only
```

Admin access uses `admin_users` plus Supabase TOTP MFA (`aal2`). Run
`sql/16_admin_users.sql`, then run `npm run admin:bootstrap` after the admin
has logged in once. Pre-enroll a verified TOTP factor in Supabase before
using `/admin`.

### Migrations

Run `sql/00_schema.sql` through `sql/20_function_search_path.sql` in order via Supabase SQL editor. The remaining loose `.sql` files are legacy — ignore.

Regenerate the checked-in database types after schema changes:

```bash
npm run db:types
```

The command reads the local Supabase variables and never writes to the database.

### Quality checks

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:production
```

CI also exercises authenticated `/dashboard` and `/min-side` flows with a dedicated read-only smoke user. See [authenticated smoke tests](docs/operations/authenticated-smoke-tests.md), [Anleggsregisteret sync](docs/operations/anleggsregisteret-sync.md) and [Sentry production setup](docs/operations/sentry.md).

---

## Data pipeline

~27 000 services across 32+ cities, built from open/free sources:

| Source | Commands | ID prefix |
|--------|----------|-----------|
| BRREG (~12k businesses) | `npm run brreg:sqlite-import` | `brr_*` |
| PT providers (Google Places) | `npm run pt:find && pt:push` | `pt_*` |
| Gym chains (Google Places) | `npm run gyms:find-locations && gyms:push` | `gp_*` |
| Sports clubs (Google Places) | `npm run clubs:find && clubs:push` | `sc_*` |
| Group fitness | `npm run groups:find && groups:push` | `gf_*` |
| OSM facilities | `npm run osm:find && osm:push` | `osm_*` |
| Para-sports (168 clubs) | `npx tsx scripts/push-paraidrett.ts` | `par_*` |

Background city refresh: `/api/refresh-city` — 24h cooldown per city, runs on first page load.

---

## Project structure

```
app/
  [category]/[city]/    # Static category landing pages
  trening/[by]/[goal]/  # Goal-based landing pages
  resultater/           # Search results (server + client)
  tilbyder/[id]/        # Provider profile + claim flow
  dashboard/            # Provider dashboard
  min-side/             # User dashboard
  api/                  # geocode, refresh-city, availability, recommendations
components/
  CategoryGrid.tsx      # Homepage grid — GPS, tag panel ('use client')
  LocalHighlights.tsx   # City-specific highlights widget
  ui/                   # Button, Card, Chip, etc.
lib/
  matchingDb.ts         # searchServices() — direct Supabase RPC
  categoryConfig.ts     # 5 categories with themes and tag options
  matching.ts           # cityCoordinates, normalizeCity()
  domain.ts             # TypeScript types
scripts/                # One-off and recurring data import scripts
sql/                    # Database migrations (00–20)
```
