# FitHub – Handoff

> Delt tavle mellom alle agenter. Oppdateres etter hvert fullført arbeid.
> PM-agenten leser denne for å forstå status. Coding-agenter oppdaterer den når de er ferdige.

---

## Siste oppdateringer

### Frontend (2026-06-18 — samlet-sok-lokasjon)

Implementert hele `tasks.md → Frontend` for `specs/active/samlet-sok-lokasjon/`. Dev-server kjørte
allerede på port 3000 — **ikke startet en ny instans, ikke restartet, ingen portkonflikt**. All
manuell verifisering gjort mot den eksisterende instansen.

- **Ny `components/SearchLocationBar.tsx`** erstatter `components/LocationBar.tsx` (slettet,
  bekreftet 0 gjenværende imports først):
  - `smartSearch`-state persistert i `localStorage` (`sdem_smart_search_v1`). AV (standard):
    identisk adressegeokoding-oppførsel som gamle `LocationBar` (forslagsliste via `/api/geocode`),
    MINUS Oslo-bydel-`<select>` og "Endre"-knapp. PÅ: ingen forslagsliste, submit sender `q`-param
    og navigerer — gjenbruker eksisterende `searchServicesWithFallback()` uendret
  - Smart-søk-submit håndterer to ulike kontekster: på `/resultater` bevares eksisterende
    URL-params (cat/tags/sort/etc., samme mønster som gamle `ResultsView.handleSearchSubmit`);
    på alle andre sider (forsiden) bygges friske params fra `location` (samme mønster som gamle
    `CategoryGrid.handleSearch`) — detektert via `usePathname()`
  - Idle-visning: grønn prikk + stednavn er en egen klikkbar `<button>` (starter redigering),
    radius og ✕ er egne sidestilte knapper — unngår nestede interaktive elementer i HTML
  - GPS-knapp/`reverseGeocode`-logikk portert uendret fra `LocationBar.tsx`
  - **Default Oslo + samtidig GPS-prompt-banner ved første lasting**: satt `location` til
    `cityCoordinates.oslo` umiddelbart hvis ingenting er lagret, viser samtidig banner
    ("Tillat stedstjenester for å bruke din posisjon i stedet for Oslo")
  - **Race-fiks funnet under egen implementering, ikke detaljert i opprinnelig spec**: sjekker
    `localStorage.getItem(LOCATION_STORAGE_KEY)` DIREKTE i stedet for å lese `location`-state fra
    context. Grunn: React kjører barn-komponenters `useEffect` FØR foreldre-komponenters i samme
    commit — `SearchLocationBar` (barn) sin mount-effekt ville alltid kjørt FØR `LocationProvider`
    (forelder) sin egen gjenopprettings-effekt fra `localStorage`. En naiv `location === null`-sjekk
    ville derfor alltid vært sann ved første render (uavhengig av om noe faktisk var lagret),
    og `SearchLocationBar` ville satt Oslo og overskrevet en ekte lagret lokasjon på HVER sideload.
    Løsningen leser `localStorage` synkront og direkte, og lar `LocationProvider` sin egen restore
    håndtere det tilfellet der noe faktisk er lagret
- **`components/TopNav.tsx`**: byttet `<LocationBar />` → `<SearchLocationBar />`
- **`components/CategoryGrid.tsx`**: fjernet embedded søkefelt (`searchQuery`/`handleSearch`-JSX)
  og geo-prompt-banneret (`geoPrompt`-state, `GEO_PROMPT_KEY`, `handleGeoAccept`/`handleGeoSkip`,
  `reverseGeocodeTop`) — all denne logikken lever nå kun i `SearchLocationBar`. Fjernet `bydel`
  fra `doNavigate`. Ubrukt `useEffect`-import fjernet. `disabled={!location}`-mønsteret er
  **uendret i kode** (per design) — i praksis alltid `false` nå siden Oslo er default
- **`app/resultater/ResultsView.tsx`**: fjernet embedded søkefelt (`inputQuery`/
  `handleSearchSubmit`/"× Fjern søk"-knapp), fjernet `bydel: null` fra `handleSearchHere`s
  `setLocation(...)`-kall (fra forrige `sok-her-knapp`-leveranse)
- **`lib/locationContext.tsx`**: fjernet `bydel?: string | null` fra `LocationState`
- **`app/resultater/page.tsx`**: fjernet `rawBorough`-parsing og bydel-tekst i header
- `npx tsc --noEmit`: grønt. Bekreftet 0 gjenværende `bydel`-referanser utenom
  `lib/osloBoroughs.ts` (urelatert, ikke rørt — postnummer→bydel-oppslagsdata)
- Manuell test mot eksisterende dev-server: forsiden viser "Smart søk"-checkbox, gamle
  søkefelt-placeholder/bydel-select/"Endre"-knapp bekreftet borte, `/resultater` viser ikke
  lenger det gamle embedded søkefeltet, ingen 500/krasj. **Begrensning**: selve Oslo-default-
  effekten (grønn prikk i idle-visning) krever klient-side hydrering (`useEffect` kjører ikke
  under SSR) — ikke verifiserbar med curl alene. Bekreftet i stedet at SSR-fallbacken
  (edit-modus med adressefelt, siden `location` er `null` før hydrering) rendres korrekt, som
  er forventet adferd

### Backend (2026-06-18 — sok-her-knapp: sql/27_search_unanchored_tags.sql)

Implementert `tasks.md → Backend` for `specs/active/sok-her-knapp/`, full spec i design.md.
Dev-server kjørte allerede på port 3000 — ikke rørt, ingen restart/portkonflikt (oppgaven
krevde ingen npm/dev-server-interaksjon, ren SQL-fil).

- `DROP FUNCTION IF EXISTS search_services_unanchored(text, double precision, double
  precision, int);` — eksakt gammel 4-param-signatur, FØR `CREATE OR REPLACE` (gotcha fra
  forrige incident).
- `CREATE OR REPLACE FUNCTION search_services_unanchored(p_query, p_lat, p_lon, p_tags
  text[] DEFAULT NULL, p_limit)` — **basert på den allerede FIKSEDE kroppen fra
  `sql/24_search_fallback_tiers.sql`** (med `word_similarity()`/`<%`, ikke den opprinnelige
  buggy `similarity()`/`%`-versjonen — viktig å bruke riktig kilde siden `sql/24` selv ble
  patchet etter første kjøring). Ett nytt filter lagt til: `AND (p_tags IS NULL OR s.tags &&
  p_tags)`. Manuelt opptalt: 20 kolonner i `RETURNS TABLE`, 20 i `SELECT`-listen, posisjonelt
  identisk rekkefølge.
- `GRANT EXECUTE ON FUNCTION search_services_unanchored(text, double precision, double
  precision, text[], int) TO anon, authenticated;` — ny 5-param-signatur, `p_tags` lagt til
  FØR `p_limit` som spec'et (JS-kallet bruker navngitte parametre, så rekkefølgen er trygg).
- `npx tsc --noEmit`: ikke relevant (ren SQL-fil).
- **Kan ikke kjøres av meg** — ingen programmatisk DB-tilgang i dette miljøet (se
  CLAUDE.md). **Neste steg er brukerens**: kjør `sql/27_search_unanchored_tags.sql` i
  Supabase SQL Editor.

### Frontend (2026-06-18 — sok-her-knapp)

Implementert hele `tasks.md → Frontend` for `specs/active/sok-her-knapp/`. Dev-server kjørte
allerede på port 3000 — **ikke startet en ny instans, ikke restartet, ingen portkonflikt**.
Brukt eksisterende instans for all manuell verifisering.

Som del av denne oppgaven: **arkivert `sentrer-kart-pa-treff` til `specs/done/`** (supplert/erstattet
av denne featuren — se note lagt til i den arkiverte `tasks.md`).

- **`lib/matchingDb.ts` — Bugfiks A**: Tier 2 i `searchServicesWithFallback()` sender nå
  `query: settlement.remainder || undefined` i stedet for `|| params.query`. Et konsumert
  stedsnavn (tom remainder) gir nå et rent lokasjon+tag-søk, ikke et feilslående tekstsøk på
  selve stedsnavnet
- **`lib/matchingDb.ts` — Bugfiks B**: `UnanchoredSearchParams` fikk `tags?: string[]`,
  `searchServicesUnanchored()` sender `p_tags`, Tier 3-kallet i `searchServicesWithFallback()`
  sender `tags: params.tags`
- **Ikke i opprinnelig spec, funnet under egen verifisering (rå RPC-testing mot Supabase)**:
  å sende `p_tags` (selv `null`) til den ennå ukjørte 5-param-signaturen i `sql/27` gjør at
  PostgREST avviser **hele** kallet med `PGRST202` (signaturmismatch) — ikke bare ignorerer
  tag-filteret. Konsekvens hvis ikke fikset: Tier 3 ville returnert 0 for **alle** søk (ikke
  bare tag-filtrerte) helt til bruker kjører migrasjonen — en reell regresjon av allerede
  fungerende funksjonalitet, ikke bare "venter på migrasjon". Lagt til samme
  retry-uten-ny-parameter-mønster som `searchServices()` allerede bruker for `p_borough`
  (linje ~108-129 i samme fil). Verifisert empirisk: direkte RPC-kall med `p_tags: null`
  reproduserte feilen (`Could not find the function ... with p_tags`), retry-fiksen løste det
- **`app/resultater/ResultsView.tsx`**: knappen "📍 Sentrer på kart" → **"📍 Søk her i stedet"**.
  `CenterMapButton`/`onCenterMap` omdøpt til `SearchHereButton`/`onSearchHere` gjennomgående.
  Ny `onClick`: henter `lat`/`lon` fra treffet, et display-label (`service.city ?? service.name`
  / `item.city ?? item.name` — kun visuelt, påvirker ikke selve søket), kaller `setLocation(...)`
  fra `useLocation()` (radius beholdt fra eksisterende lokasjon, fallback 10), bygger nye
  URL-params (behold `cat`/`tags`/`radius`, fjern `q`, sett nytt `lat`/`lon`/`location`/`city`,
  **fjernet `page`** også — egen vurdering utover spec'en, siden gammel paginering på en helt ny
  lokasjon lett kunne gitt en tom side), `router.push()` — full navigasjon
- **`components/ServiceMap.tsx`**: `focusedCoords`-prop og `FlyToPoint`-komponent fullstendig
  fjernet. `FitBounds`, `Circle`, bruker-`Marker` urørt
- `npx tsc --noEmit`: grønt. Bekreftet 0 gjenværende referanser til `focusedCoords`/`FlyToPoint`/
  `CenterMapButton`/`CenterMapFn`/`onCenterMap` i hele kodebasen
- Manuell test mot ekte Supabase-data (samme kjørende dev-server, ikke restartet):
  - Bugfiks A bekreftet med en **ekte Tier 2-suksess** — første i hele prosjektet (tidligere
    sesjoner falt alltid videre til Tier 3): `cat=aktivitet-sport&q=Drammen` fra Oslo ga
    Tier 2-banner + 50 reelle sportsklubb-treff i Drammen
  - Tier 3 bekreftet fortsatt fungerende for "yoga drammen" etter retry-fiksen (50 treff,
    riktig seksjon)
  - Destinasjons-URL-mønsteret fra "Søk her i stedet" (`cat`/`tags`/`radius` bevart, nytt
    `lat`/`lon`/`location`/`city`) verifisert å laste korrekt
  - **Begrensning**: selve knappeklikket (`router.push` fra en faktisk DOM-event) og brukerens
    fulle scenario (Drammen → "Søk her i stedet" → huk av Ishockey) krever en ekte browser —
    ikke verifiserbar med curl/node alene

### Frontend (2026-06-18 — sentrer-kart-pa-treff)

Implementert hele `tasks.md → Frontend` for `specs/active/sentrer-kart-pa-treff/`. Ren klientsidig
feature, ingen API/DB-involvering.

- **`components/ServiceMap.tsx`**: ny `focusedCoords`-prop, ny `FlyToPoint`-komponent — **helt
  separat** fra `FitBounds` (eget `useMap()`-kall, egen `useEffect`, egne deps `[coords, map]`).
  `FitBounds`, `Circle` (radius-sirkel) og bruker-`Marker` er **ikke rørt** — verifisert ved at
  ingen av disse tre fikk endret kode, kun en ny `<FlyToPoint coords={...} />` lagt til ved siden
  av eksisterende `<FitBounds .../>`
- **`app/resultater/ResultsView.tsx`**:
  - Ny `focusedCoords`-state + `handleCenterMap(coords)` som setter den og kaller
    `handleViewToggle('map')` hvis `view !== 'map'` (mobil-toggle via URL-param)
  - Ny delt `CenterMapButton`-komponent (felles for `ServiceCard` og `UnanchoredServiceCard` —
    identisk knapp, identisk plassering, unngår duplisert markup)
  - Knappen "📍 Sentrer på kart" lagt til i footer-raden ved siden av "Se full profil →" i begge
    kort-typer, guard `item.lat != null && item.lon != null` (samme guard `ServiceMap.tsx`
    allerede bruker for å filtrere markører)
  - `onCenterMap` tråden gjennom `ResultSection` → `ServiceCard`, og direkte til
    `UnanchoredServiceCard`
- `npx tsc --noEmit`: grønt
- Manuell test: bekreftet via rendret HTML (node, ikke bash-grep — bash sin grep hadde
  encoding-problemer med æøå i dette miljøet) at knappen vises med korrekt tekst "Sentrer på
  kart", `title`-attributt "Sentrer kartet på dette stedet", og riktig flex-footer-layout på et
  reelt treff med koordinater. **Begrensning**: selve flyTo-kamera-animasjonen og den visuelle
  bekreftelsen at bruker-markør/radius-sirkel IKKE flytter seg krever en ekte browser — `ServiceMap`
  er `dynamic(...,{ssr:false})`. Koden følger nøyaktig samme isolerte-effekt-mønster som tidligere
  visuelt bekreftet for `FitBounds` (denne filen) og rute-highlighting (`TrailMap.tsx`), men selve
  denne spesifikke animasjonen er ikke observert av agent

---

## Neste steg

| Agent | Oppgave | Blokkert av |
|-------|---------|-------------|
| Bruker | Visuell test i browser av `samlet-sok-lokasjon` (alle 6 punktene i proposal.md): Oslo som default + GPS-prompt ved fersk last, Smart søk AV (adressesøk uendret), Smart søk PÅ ("yoga drammen"-scenario), vanlig flis+tag-flyt uendret, bydel-UI helt borte | — |
| PM | Sjekk mot suksesskriterier i proposal.md, oppdater CLAUDE.md, arkiver `samlet-sok-lokasjon` til specs/done/ | Venter på bruker sin visuelle test |
| Bruker | Visuell test i browser: 8 fliser, Tur-flisen visuelt identisk med de andre (bilde-cycling/hover/touch-swipe), klikkbar uten lokasjon, navigerer til `/tur` | — |
| PM | Sjekk mot suksesskriterier i proposal.md, oppdater CLAUDE.md, arkiver `tur-flis-forside` til specs/done/ | Venter på bruker sin visuelle test |
| *(senere)* | tur-ruteliste: ~70% av flersegment-ruter grupperes korrekt nå, men noen kjente ruter grupperes fortsatt ikke riktig — bruker vil komme tilbake til dette. Spec'en forblir i specs/active/ | — |
| ~~Bruker~~ | ~~Kjør `sql/26_settlements_is_city.sql` + push-script~~ — **kjørt 2026-06-18, 108/108, 0 feilet** | — |
| Frontend | Vis byer distinkt på `/tur`-kartet (egen markørstil + legend-toggle "Vis kun byer"), `lib/settlementsDb.ts` får `isCity`-felt | — |
| *(valgfritt)* | sok-fallback-kjede er arkivert (mekanismen bekreftet via Tier 3-kaskade + arkitektur), men en ekte Tier 2-banner (søk på "yoga [bynavn]" der lokal dekning faktisk finnes) er aldri visuelt observert pga. tilgjengelig testdata — prøv selv om du vil se det live | — |
| Bruker | Kjør `sql/27_search_unanchored_tags.sql` i Supabase SQL Editor (sok-her-knapp — tag-filter på Tier 3). **Ikke kritisk lenger** — frontend la til en retry-fallback, så Tier 3 fungerer (uten tag-filter) selv om denne ikke kjøres ennå | — |
| Bruker | Visuell test i browser: reproduser scenarioet (Oslo → søk "Drammen" i Sport → "Søk her i stedet" på et treff → huk av Ishockey), bekreft korrekt filtrering og at toppfanen viser Drammen | — |
| PM | Sjekk mot suksesskriterier i proposal.md, oppdater CLAUDE.md, arkiver `sok-her-knapp` til specs/done/ | Venter på bruker sin visuelle test |

---

## Aktiv feature

*(ingen feature pågår — se specs/active/ for å starte en)*

---

## API-kontrakter (gjeldende)

> Oppdateres av backend-agenten når endepunkter endres. Frontend-agenten leser dette før implementasjon.

*(ingen kontrakter registrert ennå)*

---

## Modell-endringer (gjeldende)

> Oppdateres av backend-agenten når databaseskjema eller TypeScript-typer endres.

*(ingen endringer registrert ennå)*

---

## Komponent-endringer (gjeldende)

> Oppdateres av frontend-agenten når komponenter endres på en måte som kan påvirke andre.

*(ingen endringer registrert ennå)*

---

## Historikk

> Fullførte handoffs arkiveres her (nyeste øverst).

### Feature fullført: søk-fallback-kjede (2026-06-18)
- Fritekstsøk finner nå navnetreff og stedsnavn-treff utenfor brukerens lokasjonsmarkør (Tier 1/2/3),
  uten å permanent flytte markøren. `search_services()` selv uendret — kun trigger-utvidelse + ny
  frittstående `search_services_unanchored()` (`sql/24_search_fallback_tiers.sql`)
- Tier 2 bygget mot `settlements`-tabellen (961 tettsteder + 108 byer) i stedet for opprinnelig
  planlagt hardkodet byliste — bedre dekning, ingen ny infrastruktur
- Reell bug funnet og fikset under verifisering: `similarity()` ga 0 treff på korte søkeord mot lang
  `search_text` — byttet til `word_similarity()` (se gotcha i CLAUDE.md)
- Tier 3-mekanismen bekreftet med ekte data (2 reelle treff, riktig "Utenfor ditt område"-badge);
  en ekte Tier 2-banner ble ikke visuelt observert pga. tilgjengelig testdata, men mekanismen er
  bekreftet riktig via kaskade-adferden
- Spec arkivert til `specs/done/sok-fallback-kjede/`
- CLAUDE.md oppdatert under "Nylig levert" + ny gotcha om `similarity()` vs `word_similarity()`

### Feature fullført: tettsteder-kart (2026-06-18)
- 961 tettsteder importert fra Wikipedias "Tettsteder i [fylke]"-sider (15 fylker), togglbart
  punktlag på `/tur` (lilla `CircleMarker`), alle suksesskriterier bekreftet av bruker
  (stikkprøve Drammen: 125 680 innbyggere/59.75°N/10.13°E, visuell test av kart/toggle/popup)
- Nøkkelfunn fra research-fasen: befolkningsdata finnes kun i rendret HTML (ikke wikitext),
  "grå/parentes"-signalet er faktisk CSS-klassene `rtdelvis`/`kommsplit`, 15 fylkesider (ikke 19
  som først antatt) — se CLAUDE.md for full gotcha
- Nye filer: `sql/25_settlements.sql`, `scripts/parse-wikipedia-settlements.ts`,
  `scripts/push-wikipedia-settlements.ts`, `lib/settlementsDb.ts`, `app/api/settlements/route.ts`,
  utvidelse av `components/TrailMap.tsx`
- Frittstående — ingen kobling til søk/`categoryConfig.ts`. Den pausede spec'en
  `specs/active/sok-fallback-kjede/` er fortsatt uberørt og uavhengig
- Spec arkivert til `specs/done/tettsteder-kart/`
- CLAUDE.md oppdatert under "Nylig levert" + ny gotcha-seksjon for Wikipedia-tettsted-parsing

### Incident løst: search_services() funksjonskollisjon (2026-06-30)
- Root cause: `sql/21_add_utendors_category.sql` ble bygget fra utdatert `01_postgis_and_search.sql`
  (15-param, uten `p_offset`/bildekolonner) og manglet `DROP FUNCTION`-linjene for gamle signaturer.
  To overlappende `search_services()`-overloads i databasen → PostgREST: "Could not choose the best
  candidate function" på ALLE kategorier.
- Fiks: `sql/23_fix_search_services_overload.sql` — dropper de 3 feilaktige signaturene, gjenoppretter
  korrekt 16-param-versjon (med `p_offset`, `cover_image_url`, `logo_image_url`, `utendors`-grenen).
  Backend opprettet filen byte-for-byte mot PMs spesifikasjon; **kjørt og bekreftet av bruker 2026-06-30**.
- CLAUDE.md oppdatert med utvidet gotcha om at `01_postgis_and_search.sql` ikke er kilden til sannhet,
  og at `DROP FUNCTION` for gamle signaturer er obligatorisk ved enhver signaturendring.

### Sideprosjekt fullført: Geonorge turruter / `/tur` (2026-06-30)
- 163 781 ruter importert nasjonalt (137 516 fotrute, 12 135 skiløype, 11 742 sykkelrute, 2 388 annet), 0 feil
- Frittstående delsystem — **ingen** endring i `services`, `search_services()`, `matchingDb.ts`,
  `categoryConfig.ts`, `domain.ts`. Ingen kobling til hovedsøket eller tag-systemet (bevisst, bekreftet med bruker)
- Nye filer: `sql/22_trails.sql` (tabell `trails` + RLS + RPC `get_trails_in_bbox()`, kjørt av bruker
  inkl. én indeks-fix), `scripts/parse-geonorge-trails.ts`, `scripts/push-geonorge-trails.ts`,
  `lib/trailsDb.ts`, `app/api/trails/route.ts` (rate-limitet via `lib/rateLimit.ts`),
  `components/TrailMap.tsx`, `app/tur/page.tsx`
- Nye npm-avhengigheter: `sax`, `proj4` (+ typedefs) — lette, ingen native bindings
- Verifisert end-to-end med Playwright
- **Kjent begrensning (ikke bug)**: `/api/trails` ber om 2000 rader, men PostgREST kapper svar til
  1000 — i tette byområder kan ruter mangle i synlig viewport til bruker zoomer inn
- **Ikke en automatisk jobb**: engangsimport, ingen cron. Re-kjøring av samme to scripts er trygt
  (idempotent via `source_local_id`-upsert) hvis Kartverkets data skal friskes opp senere
- CLAUDE.md oppdatert under "Nylig levert" + ny gotcha-seksjon for EPSG:3035-akserekkefølge og partiell-indeks-fellen

### Feature fullført: forside-kategorier (2026-06-30)
- Spec arkivert til `specs/done/forside-kategorier/`
- CLAUDE.md oppdatert under "Nylig levert"
- Alle suksesskriterier i proposal.md bekreftet

---

## Slik oppdaterer du denne filen

**Backend-agent** — etter fullført task:
```
### Backend ([dato])
- Lagt til endepunkt: GET /api/providers/nearby?lat=&lng=&radius=
  - Returnerer: { providers: Provider[], total: number }
- Endret Provider-type: nytt felt `verified_at: string | null`
- Breaking: /api/search returnerer nå paginert ({ data, page, total })
```

**Frontend-agent** — etter fullført task:
```
### Frontend ([dato])
- Refaktorert ProviderCard: ny prop `showDistance?: boolean`
- Søk-state flyttet til URL-params (?q=&lat=&lng=)
- Ny komponent: VerifiedBadge (src/components/ui/VerifiedBadge.tsx)
```

**PM-agent** — etter arkivert feature:
```
### Feature fullført: [feature-navn] ([dato])
- Spec arkivert til specs/done/[feature-navn]/
- CLAUDE.md oppdatert
```
