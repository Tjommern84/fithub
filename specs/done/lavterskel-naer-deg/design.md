# Lavterskel "Aktiviteter nær deg" + fiks "Utforsk aktiviteter" — plan

## Context
Forsiden har tre seksjoner: "Utforsk aktiviteter" (CTA/nav-lenke), "Aktiviteter nær deg", og
kategori-flisene. To problemer skal løses:

1. **"Utforsk aktiviteter" gir 0 treff.** Bekreftet rotårsak (kode lest, ikke gjettet): lenken
   (`HomeHero.tsx`, `HeroTopNav.tsx`, `TopNav.tsx`) peker på `/resultater` UTEN noen
   lokasjons-query-param. `search_services()` (`sql/29_search_services_provider_type.sql`,
   `matched_coverage`-CTE) krever `user_point IS NOT NULL` ELLER `p_city IS NOT NULL` for å
   matche NOE i `service_coverage` — uten lokasjon blir resultatet strukturelt 0 rader, uansett
   hva som ligger i databasen. Forsterket av et tidligere uavklart punkt (`handoff.md`): Oslo-
   standardlokasjonen settes i dag av `SearchLocationBar.tsx` sin mount-effekt, men denne
   komponenten er skjult på `/` via `ConditionalSearchBar` — så `location`-context kan fortsatt
   være `null` når brukeren klikker "Utforsk aktiviteter" fra forsiden.
2. **"Aktiviteter nær deg" viser alt** (PT-er, idrettslag, treningssentre) — bruker vil begrense
   til lavterskel/spontant-oppsøkbare aktiviteter: tuftepark, hinderløype, pumptrack, diskgolf,
   utendørs klatre/buldrevegg, aktivitetspark (alle `provider_type='facility'`, `type='outdoor'`,
   ingen avtale/booking nødvendig) — **pluss** turstier/sykkelstier fra det frittstående
   `trails`-systemet (f.eks. "tur langs elven"), som i dag IKKE er koblet til `services`/
   `search_services()` i det hele tatt.

**Brukerens avgjørelser (tatt under planlegging):**
- Flytt Oslo-standardlokasjon-logikken til `LocationProvider` (root-nivå) i stedet for å lappe
  kun denne ene lenken — løser rotårsaken permanent, uavhengig av hvilken side man lander på.
- Ta med turstier i denne runden også (ikke som egen oppfølging).

## Del A — Flytt Oslo-standard til `LocationProvider` + fiks "Utforsk aktiviteter"-lenker

### `lib/locationContext.tsx`
Flytt default-Oslo-logikken (i dag i `SearchLocationBar.tsx`) inn i `LocationProvider` sin
eksisterende mount-`useEffect` (samme effekt som leser `localStorage`):
- Hvis `localStorage.getItem('sdem_location_v1')` finnes: gjenopprett som i dag (uendret).
- Hvis IKKE: sett `location` til Oslo (`cityCoordinates.oslo`, `source:'search'`, samme verdier
  som i dag i `SearchLocationBar.tsx`).
- Nytt i context: `geoPromptVisible: boolean` + `dismissGeoPrompt(): void` — settes `true` ved
  Oslo-default HVIS `'geolocation' in navigator` og `sdem_geo_prompt_dismissed` ikke er satt i
  `localStorage`. Dette ERSTATTER `SearchLocationBar.tsx` sin egen `geoPromptVisible`-state.
- **Bevar race-condition-fiksen identisk**: les `localStorage` direkte/synkront i effekten — nå
  trivielt siden dette ER foreldre-effekten (ikke en separat barn-komponent som kappes om det).

### `components/SearchLocationBar.tsx`
Fjern den lokale Oslo-default-settingen og egen `geoPromptVisible`-state — bruk `geoPromptVisible`/
`dismissGeoPrompt` fra `useLocation()` i stedet. GPS-banner-renderingen (UI) er uendret, kun
hvor state'n kommer fra. Siden denne komponenten fortsatt er skjult på `/`, vises banneret der
fortsatt ikke — det er greit, default-settingen (det faktiske bugfikset) skjer nå uavhengig i
`LocationProvider`.

### Ny `components/ExploreActivitiesLink.tsx` (client)
Leser `useLocation()`, bygger `/resultater`-href med `lat`/`lon`/`location`/`city`/`radius` fra
gjeldende lokasjon (fallback til ren `/resultater` kun i det ekstremt korte vinduet før
`LocationProvider` sin effekt har kjørt — aksepter dette, det er millisekunder). Brukes til å
erstatte ALLE tre stedene teksten "Utforsk aktiviteter" lenker til `/resultater` i dag:
`TopNav.tsx`, `HeroTopNav.tsx`, `HomeHero.tsx` sin primær-CTA.

## Del B — "Aktiviteter nær deg": lavterskel-filter + turstier

### `components/home/HomeNearbyActivities.tsx`
1. Utvid `searchServices()`-kallet: `radiusKm: 30`, `limit: 50` (i stedet for `limit: 10` uten
   radius). Filtrer resultatet CLIENT-SIDE til `item.service.provider_type === 'facility'`
   (fanger tuftepark/hinderløype/pumptrack/diskgolf/klatrevegg-ute/aktivitetspark presist — disse
   er nøyaktig de eksisterende `anl_*`/`tp_*`-radene, bekreftet via research). Ingen SQL-endring
   nødvendig for denne delen — `provider_type` er allerede en returkolonne.
2. Hent også turstier nær brukeren (se ny RPC under), merge inn i samme distanse-sorterte liste
   som en egen korttype (annet utseende: navn, rutetype-ikon, lengde i km, lenke til `/tur` — ikke
   pris/rating/booking-UI siden turstier ikke er en `Service`).
3. Vis et samlet sett (f.eks. 8–10 kort totalt), sortert på avstand, blanding av anlegg+turstier.

### Ny SQL-migrasjon `sql/31_nearest_trails.sql` (sjekk faktisk neste ledige nummer med `ls sql/`)
Ny RPC `get_nearest_trails(p_lat, p_lon, p_radius_km, p_limit)`:
- `ST_DWithin(geom, punkt, radius*1000)` + `ORDER BY ST_Distance(...)` — samme mønster som
  radius-matching i `search_services()`.
- **`WHERE name IS NOT NULL`** — kun navngitte ruter (proxy for "faktisk interessant/vedlikeholdt
  rute", ikke en anonym 50-meters geometri-fragment; research bekreftet <30% av rader har navn).
- Returner `id, name, trail_type, length_km, distance_km`.
- GRANT EXECUTE til `anon, authenticated`.

### `lib/trailsDb.ts`
Ny `getNearestTrails(lat, lon, radiusKm, limit)` — samme mønster som eksisterende
`getTrailsInBounds()`, men kaller den nye RPC-en.

## Verifisering
1. Klikk "Utforsk aktiviteter" fra en helt fersk privat-fane (ingen lagret lokasjon) → får
   faktiske treff, ikke 0 — bekreft URL inneholder `lat`/`lon`.
2. "Aktiviteter nær deg" viser KUN tuftepark/hinderløype/pumptrack-type kort + navngitte turstier
   — ingen PT/idrettslag/treningssenter-kort.
3. Et sted med lite i umiddelbar nærhet viser fortsatt resultater opp til 30 km, ikke tomt.
4. `npx tsc --noEmit` + `npm run build` grønt.
5. `sql/31_nearest_trails.sql` opprettes av backend, kjøres manuelt av bruker (standard rutine).

## Ikke i scope
- Lekeplasser/akebakker (finnes ikke i noen tabell i dag — egen datainnsamling, ikke en kode-fiks)
- Endring av selve `/tur`-kartsiden eller `trails`-importen
- Adminpanel-kuratering av "interessante" turstier utover navn-filteret
