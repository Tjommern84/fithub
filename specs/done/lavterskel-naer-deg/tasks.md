# Lavterskel "Aktiviteter nær deg" + fiks "Utforsk aktiviteter" – Tasks

## Backend
- [x] Sjekk neste ledige `sql/NN_`-nummer med `ls sql/`, opprett `sql/NN_nearest_trails.sql`:
      ny RPC `get_nearest_trails(p_lat, p_lon, p_radius_km, p_limit)` — `ST_DWithin`+`ST_Distance`
      mot `trails.geom`, `WHERE name IS NOT NULL`, GRANT EXECUTE til anon+authenticated
- [x] `npx tsc --noEmit` grønt (ingen TS-endring forventet, ren SQL-fil)
- [x] Marker migrasjonsfilen i handoff.md "Neste steg" med "Blokkert av: bruker må kjøre SQL i Supabase SQL Editor"
- [x] **Uplanlagt, kritisk funn under verifisering**: `search_services()` OG `get_nearest_trails()`
      timet begge ut på helt vanlige nærmeste-søk — reell produksjonsregresjon, uavhengig av denne
      spec'en. Fikset i 6 oppfølgings-migrasjoner (`sql/32`–`36`): manglende GIST-indeks på
      `services.base_location`, OR-disjunksjon i `matched_coverage` hindret indeksbruk (omskrevet
      til UNION ALL), dyre per-rad-subqueries kjørt på hele kandidatsettet før LIMIT (flyttet til
      etter), og for turstier: linje-til-punkt-avstand for tungt i volum (byttet til endepunkter +
      `use_spheroid=false`). Se egen gotcha i CLAUDE.md med full forklaring og EXPLAIN-tall

## Frontend
- [x] `lib/locationContext.tsx`: flytt Oslo-default + GPS-prompt-logikk inn i `LocationProvider`
      sin mount-effekt (se design.md Del A). Ny `geoPromptVisible`/`dismissGeoPrompt` i context
- [x] `components/SearchLocationBar.tsx`: fjern lokal Oslo-default-logikk, bruk context sin
      `geoPromptVisible`/`dismissGeoPrompt` for banner-UI i stedet
- [x] Ny `components/ExploreActivitiesLink.tsx`: leser `useLocation()`, bygger `/resultater`-href
      med lokasjon. Brukt i `TopNav.tsx`, `HeroTopNav.tsx`, `HomeHero.tsx` (alle tre "Utforsk
      aktiviteter"-stedene)
- [x] `lib/trailsDb.ts`: ny `getNearestTrails(lat, lon, radiusKm, limit)` mot den nye RPC-en
- [x] `components/home/HomeNearbyActivities.tsx`: `radiusKm: 30`, `limit: 50`, filtrer client-side
      til `provider_type==='facility'`, merge inn turstier fra `getNearestTrails()`, egen
      korttype for turstier (navn, rutetype, lengde, lenke til `/tur`), samlet sortert på avstand
- [x] `npx tsc --noEmit` OG `npm run build` grønt (build re-verifisert av PM etter timeout-fiksene,
      isolert distDir, dev-server uberørt)
- [x] Manuell test — **verifisert via direkte RPC-kall (node-script), ikke full browser-test i
      privat-fane**: `search_services()` med Oslo-koordinater returnerer 50 rader (19 facility),
      `get_nearest_trails()` returnerer reelle navngitte ruter (Rondanestien, KyststiOslo) på
      335ms varm. Browser-basert sluttbekreftelse i privat-fane er IKKE utført av PM denne runden

## PM / Avslutning
- [x] Sjekke mot suksesskriterier i proposal.md
- [x] Oppdatere CLAUDE.md
- [x] Arkivere spec til specs/done/
- [x] Oppdatere handoff.md med "feature fullført"
