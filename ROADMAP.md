# Utviklingsplan for fithub.no

*Sist oppdatert: april 2026*

---

## Fase 1: Grunnleggende stabilitet
**Status**: ✅ Fullført

- [x] Kjernefunksjonalitet (matching, søk, profiler)
- [x] Database-skjema med PostGIS og geografisk søk
- [x] Autentisering via Supabase
- [x] Grunnleggende UI med Tailwind CSS
- [x] Stripe-integrasjon (B2C og B2B)
- [x] E-postutsending via Resend

---

## Fase 2: Data og innholdspopulering
**Status**: ✅ Fullført

### Datasett bygd opp (nullkostnad)
- [x] ~12 000 virksomheter importert fra BRREG (SQLite → Supabase)
- [x] 149 treningssenter med koordinater (Google Places via Serper.dev)
- [x] 807 idrettslag med by-dekning og sport-tags
- [x] 840 personlige trenere med by-dekning
- [x] Ernæringsrådgivere og rehabiliteringstilbud
- [x] Gruppetimer: yoga, bootcamp, løpegrupper, utendørs

### Enrichment-pipeline (nullkostnad)
- [x] Navn-basert sport-inferens (`enrich-clubs-names.ts`) → 778 klubber oppdatert
- [x] BRREG formålsbeskrivelse-parsing (`enrich-clubs-brreg.ts`) → 264 klubber oppdatert
- [x] Nominatim-geocoding (`geocode-clubs.ts`) → 999/1000 koordinatsatt
- [x] E-postfunn via BRREG + hjemmeside-scraping (`find-emails.ts`) → 728 epost funnet
- [x] NIF-importskript klart (venter på credentials fra idrettsforbundet.no)

### Kategorisystem
- [x] 4 hovedkategorier: `trene-selv`, `trene-sammen`, `oppfolging`, `aktivitet-sport`
- [x] `main_category`-kolonne i databasen, populert fra `type`-feltet
- [x] Tag-basert filtrering innenfor kategorier
- [x] `search_services()` SQL-funksjon (14 parametre, PostGIS, score-ranking)

---

## Fase 3: Frontend og deployment
**Status**: ✅ Fullført

### Hjemmeside og søk
- [x] 4-område CategoryGrid med bilde-animasjon og tag-panel
- [x] GPS-lokasjon og adressesøk (Nominatim-autocomplete)
- [x] Oslo bydel-filter
- [x] Interaktivt kart på resultatsiden (react-leaflet v4)
- [x] Nationwide + lokal resultat-splitt
- [x] Sortering (beste treff, nærmest, rating, pris)

### Vercel-deployment
- [x] Tilkoblet GitHub (auto-deploy ved push til `main`)
- [x] **`fithub.no`** — live og fungerende (DNS via Webhuset, A-record → Vercel)
- [x] `fithub.no` konfigurert som primærdomene i Vercel
- [x] Vercel CLI koblet til (`npx vercel` fungerer fra prosjektmappen)

### Infrastruktur-fikser (april 2026)
- [x] `scripts/` ekskludert fra `tsconfig.json` (byggebrytende TypeScript-feil i skript kan ikke lenger bryte Vercel-bygget)
- [x] `refresh-city` API: begrenset til 3 søk per kall (holder seg under Vercel Hobby 10s timeout)
- [x] `react-leaflet` nedgradert til v4 (kompatibel med React 18)

---

## Fase 4: Synlighet og datakvalitet (Neste)
**Prioritet**: Høy

### SEO — lav hengetid, høy effekt
- [ ] `sitemap.xml` generert automatisk
- [ ] `robots.txt` med korrekte regler
- [ ] Open Graph-metadata på alle sider (bilde, tittel, beskrivelse)
- [ ] Strukturert data (Schema.org `LocalBusiness`, `SportsClub`)
- [ ] Statiske landingssider per by og kategori (f.eks. `/styrke/oslo`, `/fotball/bergen`)
- [ ] Kanoniske URL-er

### Datakvalitet
- [ ] Dublett-deteksjon og sammenslåing på tvers av datakilder
- [ ] Manuell verifikasjon av toppresultater (100 per kategori)
- [ ] Hjemmeside-validering (er URL-ene fortsatt aktive?)
- [ ] NIF-import når API-credentials er på plass
- [ ] `refresh-city` utvidelse til gymkjeder og yoga-studioer

### DNS og domene
- [x] `fithub.no` er live og tilgjengelig (DNS via Webhuset → Vercel)

---

## Fase 5: Brukeropplevelse og konvertering
**Prioritet**: Høy

### UX
- [ ] Progressiv visning av resultater (pagination eller infinite scroll)
- [ ] Bedre mobilopplevelse (kart-layout, touch-vennlige kort)
- [ ] "Ingen treff"-tilstand med smarte forslag (prøv bredere radius, annen kategori)
- [ ] Lagre søk og lokasjon mellom besøk (allerede delvis implementert)
- [ ] Kortvisning med bilde der tilbydere har lastet opp profil

### Tilbyder-onboarding
- [ ] Forenklet registreringsflyt for tilbydere
- [ ] "Krev denne profilen"-funksjon for eksisterende BRREG-oppføringer
- [ ] Profil-editor med forhåndsvisning
- [ ] Veiledning: slik øker du synligheten din

---

## Fase 6: Innhold og engasjement
**Prioritet**: Middels

### Vurderinger
- [ ] Vurderingssystem (1–5 stjerner + fritekst)
- [ ] Verifiserte vurderinger (kun fra gjennomførte bookinger)
- [ ] Moderering og svar fra tilbydere

### Innhold
- [ ] Blogg / treningssartikler for SEO og engasjement
- [ ] Ekspertråd fra tilknyttede tilbydere
- [ ] Suksesshistorier fra brukere

### Kommunikasjon
- [ ] E-post-notifikasjoner med personaliserte treningstips
- [ ] Kalenderinvitasjoner (.ics) for bookinger

---

## Fase 7: Markedsplass og betalinger
**Prioritet**: Middels

- [ ] Direkte betaling via plattformen (Stripe Connect for tilbydere)
- [ ] Abonnementsmodell for premium-tilbydere
- [ ] Partner API for bedrifter (velferdstilbud / treningsstøtte)
- [ ] Rapportering og analytics for tilbydere

---

## Kontinuerlige forbedringer

### Sikkerhet og compliance
- [ ] GDPR-compliance audit og sikker datasletting
- [ ] 2FA for tilbydere og admin
- [ ] Rate limiting på API-endepunkter

### Infrastruktur
- [ ] Staging-miljø (preview-deploys i Vercel fungerer delvis)
- [ ] Database-backup-rutiner (Supabase har automatisk backup på Pro)
- [ ] Overvåkning og varsling (Sentry eller tilsvarende)

---

## Nøkkeltall å følge

| Metrikk | Mål |
|---|---|
| Søk per uke | Voksende |
| Søk → klikk på tilbyder | > 20 % |
| Tjenester i databasen | > 15 000 |
| Byer med lokal dekning | > 30 |
| Vercel-byggestatus | Alltid grønn |
| Uptime | > 99,5 % |

---

## Risikoer

| Risiko | Tiltak |
|---|---|
| Datakvalitet fra BRREG er variabel | Enrichment-pipeline + manuell spot-check |
| Cold start — lite innhold i små byer | `refresh-city` fyller dynamisk ved besøk |
| Scripts bryter Vercel-bygg | Løst: `scripts/` ekskludert fra tsconfig |
| Vercel Hobby timeout (10s) | Løst: `refresh-city` begrenset til 3 søk |
| DNS-propagering for `.no`-domenet | Venter på Uniweb NS-bytte |
| NIF API krever godkjenning | Skript klart — søk sendt |
