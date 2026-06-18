# Tettsteder-lag på /tur-kartet – Tasks

## Backend
- [x] **Steg 1**: verifisert empirisk mot rå wikitext + rendret HTML (4 fylker). Korrigerte spec-antakelser: 15 fylkesider (ikke 19), befolkning/areal kun i rendret HTML, "grå/parentes" er faktisk CSS-klassen `rtdelvis`/`kommsplit`, samme tettstedsnummer kan dukke opp på 2 sider (identiske verdier, trygt å upserte uten cross-page-dedup)
- [x] Opprett `sql/25_settlements.sql` — **kjørt av bruker 2026-06-18**
- [x] Skriv `scripts/parse-wikipedia-settlements.ts` — kjørt mot ekte Wikipedia, 961 unike tettsteder, 0 ugyldige koordinater
- [x] Skriv `scripts/push-wikipedia-settlements.ts` — modellert på `push-geonorge-trails.ts`
- [x] Kjør `npx tsx scripts/push-wikipedia-settlements.ts` — **kjørt 2026-06-18, 961/961 behandlet, 0 feil**
- [x] Stikkprøve: Drammen bekreftet — population 125 680, lat 59.75, lon 10.13 (avvik fra 59.74/10.20 er kun avrunding fra grad+minutt-presisjon i kildedata). `municipality: NULL` er kjent, dokumentert grensetettsted-særtrekk, ikke en feil

## Frontend
- [x] `lib/settlementsDb.ts`: `Settlement`-type, `getSettlementsInBounds()`
- [x] `app/api/settlements/route.ts`: bbox-endepunkt, rate-limitet — verifisert manuelt (200 med korrekt shape, 400 ved ugyldig bbox)
- [x] `components/TrailMap.tsx`: nytt togglbart lag (CircleMarker + Popup), parallelt fetch, legend-toggle — ingen endring i eksisterende turrute-logikk
- [x] `npx tsc --noEmit` grønt
- [x] Nasjonal bbox ga 960/961 rader — bekrefter PostgREST sin 1000-rad-cap ikke er et reelt problem ved dette datasettets størrelse
- [x] Visuell test i browser — bekreftet av bruker: lilla tettsted-markører, grønne fotruter, oransje sykkelruter, blå skiløyper vises korrekt

## PM / Avslutning
- [x] Sjekke mot suksesskriterier i proposal.md
- [x] Oppdatere CLAUDE.md
- [x] Arkivere spec til specs/done/
- [x] Oppdatere handoff.md med "feature fullført"
