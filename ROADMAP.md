# Roadmap — fithub.no

*Sist oppdatert: august 2026*

---

## Bygget ✅

**Infrastruktur**
- Next.js 16 App Router, React 19, Supabase + PostGIS, Vercel deployment
- Sentry error tracking, Resend email, rate limiting
- `robots.ts`, `sitemap.ts` (async, up to 2000 provider pages)
- Schema.org JSON-LD: `WebSite`, `LocalBusiness`, `BreadcrumbList`
- `hreflang nb-NO`, canonical URLs
- Admin-autentisering: magic link + Supabase TOTP MFA (`aal2`) på `/admin/login` + `/admin/verify`
- RLS-innstramming (migrations 18–20): policies på alle tidligere usikrede tabeller, cache-tabeller kun `service_role`, eksplisitt `search_path` på triggerfunksjoner
- CI med lint, typekontroll, enhetstester, produksjonsbygg og offentlige/autentiserte smoketester
- Genererte Supabase TypeScript-typer fra live PostgREST-skjema (`npm run db:types`)
- Sentry-integrasjon på klient/server og begge Next.js-feilgrenser; ekstern aktivering krever Vercel-verdier

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
- Profilscore med konkrete råd for bedre synlighet

**Bruker**
- Bookingsystem med ICS-kalenderinvitasjoner
- Verifiserte vurderinger med 1–5 stjerner og fritekst
- GDPR: dataeksport + kontosletting

**Data (~27 000 tjenester)**
- BRREG, Google Places (PT, gym, idrettslag, gruppetimer), OSM, para-idrett
- Egen `paraidrett`-hovedkategori (tidligere tagfilter i aktivitet-sport)

---

## Gjenstående driftsoppsett

- **Sentry i Vercel** — legg inn `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` og `SENTRY_AUTH_TOKEN`, deploy på nytt og verifiser en kontrollert testfeil

---

## Neste (etter behov)

- **Mer data** — SATS/EVO/Fresh mangler `cover_image_url` på en del lokasjoner; flere gymkjeder
- **Betalinger** — Stripe Connect for direktebooking på plattformen
- **Partner API** — B2B-tilgang for bedrifter med treningsstøtte
