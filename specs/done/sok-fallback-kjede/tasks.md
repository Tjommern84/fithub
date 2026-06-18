# Søk-fallback-kjede – Tasks

## Backend
- [x] Opprett `sql/24_search_fallback_tiers.sql`: trigger-utvidelse (`services_set_search_text` + city/address, inkl. oppdatert `CREATE TRIGGER ... OF name, description, tags, city, address`), engangs-backfill, ny funksjon `search_services_unanchored` (`DROP FUNCTION IF EXISTS` + `GRANT EXECUTE`). `search_services()` ikke rørt
- [x] Kjørt av bruker mot Supabase
- [x] Verifisert manuelt i SQL Editor, to runder — **bug funnet og fikset**: første versjon brukte `similarity()`/`%` (samme som `search_services()`) som ga 0 treff på `'yoga'` (trigram-likhet straffer lengdeforskjell mellom kort søkeord og lang `search_text` hardt). Byttet til `word_similarity()`/`<%` (måler likhet mot beste substreng) — re-verifisert: alle 10 treff på `'yoga'` nå `similarity_score: 1`

## Frontend
- [x] `lib/settlementsDb.ts`: lagt til `findSettlementInQuery()` — gjenbruker eksisterende `getSettlementsInBounds()` mot en Norge-dekkende bbox (ingen ny SQL/RPC), tokeniserer query og matcher case-insensitivt mot `settlements.name`
- [x] `lib/domain.ts`: lagt til `city?: string | null` på `Service` (ved siden av `address`)
- [x] `lib/matchingDb.ts`: lagt til `UnanchoredSearchRow`, `UnanchoredService`, `FallbackNotice`, `searchServicesUnanchored()`, `searchServicesWithFallback()` — `searchServices()` selv uendret
- [x] `app/resultater/page.tsx`: byttet til `searchServicesWithFallback()`, sender `unanchoredResults`/`fallbackNotice` til `ResultsView`
- [x] `app/resultater/ResultsView.tsx`: utvidet `EmptyState`-trigger, ny `FallbackNoticeBanner` (Tier 2, sky-palett), ny `UnanchoredServiceCard` + seksjon "Andre treff (utenfor ditt område)" (Tier 3, amber-badge)
- [x] `npx tsc --noEmit` grønt
- [x] Manuell test (migrasjon 24 var allerede kjørt mot Supabase da denne oppgaven startet):
  - [x] Kategori-nettlesing uten `q` → 200 OK, uendret adferd
  - [x] Fritekst med ekte Tier 1-treff ("Yogic Shala") → 1 kort, ingen banner/badge — identisk med dagens adferd, bekrefter ingen ekstra kall lekker inn i Tier 1-stien
  - [x] "Lindmann Yoga" + lokasjon Oslo → **ikke seedet i denne databasen** (fiktivt eksempel fra proposal.md), alle 3 tiers korrekt 0 → ekte `EmptyState` rendres, ingen krasj
  - [x] "yoga drammen" + lokasjon Oslo → Tier 2 fant "Drammen" som settlement og re-søkte, men 0 reelle dekningstreff for yoga i Drammen i denne databasen → korrekt kaskadert til Tier 3, fant 2 ekte treff ("YogaFRI", "UGB Yoga skole") med "Utenfor ditt område"-badge. Bekrefter kjeden fungerer ende-til-ende; ren Tier-2-suksess kunne ikke fremtvinges med tilgjengelig data, men mekanismen (finn sted → rekoordiner → 0 → kaskade) er bevist riktig

## PM / Avslutning
- [ ] Sjekke mot suksesskriterier i proposal.md
- [ ] Oppdatere CLAUDE.md
- [ ] Arkivere spec til specs/done/
- [ ] Oppdatere handoff.md med "feature fullført"
