# Roadmap — fithub.no

*Sist oppdatert: mai 2026*

---

## Bygget ✅

**Infrastruktur**
- Next.js 14 App Router, Supabase + PostGIS, Vercel deployment
- Sentry error tracking, Resend email, rate limiting
- `robots.ts`, `sitemap.ts` (async, up to 2000 provider pages)
- Schema.org JSON-LD: `WebSite`, `LocalBusiness`, `BreadcrumbList`
- `hreflang nb-NO`, canonical URLs

**Søk og resultater**
- `search_services()` — 16 params, PostGIS proximity, full text, pagination
- Tag filter, sort (nearest / best match / rating / price), map view
- "Ingen treff" fallback — larger radius, all in city, other categories
- Share button (clipboard copy of current search URL)

**Landingssider**
- 5 kategori × 32 byer (`/[category]/[city]`, ISR 24h)
- 6 mål × 32 byer (`/trening/[by]/[goal]`, ISR 1h)

**Tilbyderprofil**
- LocalBusiness JSON-LD, star rating, cover/logo image
- "Krev denne profilen" med orgnr-verifisering
- Profil-editor (kontaktinfo + bildeupload)
- "Lignende tilbydere"-seksjon

**Tilbyder-dashboard**
- Tjenesteoversikt, profilstatistikk
- Ukentlig visningstrend (Recharts LineChart)

**Bruker**
- Bookingsystem med ICS-kalenderinvitasjoner
- GDPR: dataeksport + kontosletting

**Data (~27 000 tjenester)**
- BRREG, Google Places (PT, gym, idrettslag, gruppetimer), OSM, para-idrett
- `♿ Paraidrett`-merke og tagfilter i aktivitet-sport

---

## Teknisk gjeld

- **Supabase TypeScript-typer** — `npx supabase gen types typescript --project-id <id>` → erstatt `any` i `lib/supabaseClient.ts`
- **Sentry DSN** — `NEXT_PUBLIC_SENTRY_DSN` mangler som env-var i Vercel

---

## Neste (etter behov)

- **Vurderinger** — 1–5 stjerner + fritekst, kun fra gjennomførte bookinger
- **Tilbyder-synlighet** — "slik øker du synligheten din"-guide i dashboard
- **Mer data** — SATS/EVO/Fresh mangler `cover_image_url` på en del lokasjoner; flere gymkjeder
- **Betalinger** — Stripe Connect for direktebooking på plattformen
- **Partner API** — B2B-tilgang for bedrifter med treningsstøtte
