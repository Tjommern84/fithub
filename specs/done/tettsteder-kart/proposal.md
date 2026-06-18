# Tettsteder-lag på /tur-kartet – Proposal

## Sammendrag
Legg til norske tettsteder (navn, kommune, folketall, koordinater) som et eget, togglbart punktlag på den eksisterende `/tur`-kartsiden, basert på data fra Wikipedias "Tettsteder i [fylke]"-sider.

## Hva
- Skrape alle ~19 "Tettsteder i [fylke]"-sider på Wikipedia (navn, kommune, folketall, DMS-koordinater, tettstedsnummer)
- Lagre som ny tabell `settlements` i Supabase, samme pipeline-mønster som Turrutebasen (`/tur`)
- Vise som eget togglbart lag (CircleMarker) på eksisterende `/tur`-kart, med bbox-basert henting ved pan/zoom

## Hvorfor
Brukeren ønsket en database over norske tettsteder til kartvisualisering. Wikipedia ble først vurdert og avvist (trodde ingen koordinater fantes), men korrigert etter at brukeren viste faktiske tabelldata med DMS-koordinater og offisielt SSB-tettstedsnummer — gjør Wikipedia til en pragmatisk, brukbar kilde uten behov for separat geokoding.

## Scope
- `sql/25_settlements.sql` (ny tabell, RLS, bbox-RPC)
- `scripts/parse-wikipedia-settlements.ts`, `scripts/push-wikipedia-settlements.ts`
- `lib/settlementsDb.ts`, `app/api/settlements/route.ts`
- `components/TrailMap.tsx` (nytt lag/toggle, ingen endring i eksisterende turrute-logikk)

## Ikke i scope
- Stedsnavn-gjenkjenning i søk (frikoblet fra `specs/active/sok-fallback-kjede/`)
- Ny, separat side — alt lever i eksisterende `/tur`
- Endring av `search_services()`, `lib/matchingDb.ts`, `lib/categoryConfig.ts`
- Underområde-rader i Wikipedia-aggregater (kun "Tilsammen"-raden lagres)

## Suksesskriterier
- [x] Tettstedsdata importert med 0 feil, stikkprøve (Drammen) verifisert mot reelle koordinater
- [x] `/tur` viser tettsted-punkter i viewport, refetcher ved pan/zoom
- [x] Toggle av/på fungerer uten å påvirke turruter eller brukerposisjon
- [x] Popup viser navn/kommune/folketall korrekt, ingen null/undefined-lekkasje
- [x] PostgREST sin 1000-rad-cap bekreftet ikke et reelt problem ved nasjonalt zoom-ut-nivå
- [x] `npx tsc --noEmit` grønt
