# FitHub – Handoff

> Delt tavle mellom alle agenter. Oppdateres etter hvert fullført arbeid.
> PM-agenten leser denne for å forstå status. Coding-agenter oppdaterer den når de er ferdige.

---

## Siste oppdateringer

### Backend + Frontend (2026-07-02 — HTTP 500-eliminering, sql/38)

Basert på PM-analyse av 983 Supabase-logglinjer (16 HTTP 500 på search_services, 1 HTTP 555
på service_cache). To leveranser, begge uten å starte dev-server (ikke nødvendig for SQL-fil
og en enkelt try/catch-endring i en server component).

**Rotårsak**: sql/34 fikset `reasons`-subqueryen (late projection), men én korrelert
EXISTS-subquery ble stående i `scored_services`:
```sql
(type_candidate = 'any' OR type_candidate = '' OR EXISTS (
  SELECT 1 FROM service_types st WHERE st.service_id = rs0.id AND st.type = type_candidate
)) AS type_match
```
Kjørte for alle ~3 500 coverage-matchede kandidater → ~1,75 s overhead → samlet API-tid
~3,2–4 s → sporadisk statement_timeout → HTTP 500 ved spesifikk servicetype-filter + stor by.

**`sql/38_fix_type_match_subquery.sql`** (ny, **ikke kjørt mot Supabase ennå**):
- Legger til `type_matched_services AS MATERIALIZED (SELECT service_id FROM service_types
  WHERE NOT (type_candidate IN ('any', '')) AND type = type_candidate)` som ny CTE
- Erstatter EXISTS-subqueryen i `scored_services` med `LEFT JOIN type_matched_services te
  ON te.service_id = rs0.id` + `(type_candidate IN ('any', '') OR te.service_id IS NOT NULL)`
- Effekt: når type_candidate = 'any' (flertallet av kall) → CTE er tom → JOIN gir NULL →
  type_match = TRUE for alle (tilnærmet null overhead). Når type_candidate = 'styrke' el.l.
  → service_types-settet hentes ÉN gang via idx_service_types_type → hash-join mot
  kandidatsettet, ikke 3 500 individuelle oppslag
- 16-param-signatur og 26-kolonne RETURNS TABLE **uendret** fra sql/34 → ingen GRANT-/
  overload-problemer. DROP + CREATE + GRANT inkludert som alltid
- `npx tsc --noEmit`: grønt (SQL-fil, ikke TypeScript)

**`app/resultater/page.tsx`**:
- Import av `logError` fra `lib/errorLogger` lagt til
- Catch-blokken rundt `searchServicesWithFallback()` kaller nå `void logError(...)` med
  `source='route'`, `context='search_services_rpc'`, feilmelding, stack og søkeparametere
  (city, lat, lon, mainCategory, serviceType, query) som metadata
- Fremtidige 500-feil dukker opp i Sentry + `app_errors`-tabellen, ikke bare i Vercel-console
- `npx tsc --noEmit`: grønt

**Neste steg (bruker)**:
1. Kjør `sql/38_fix_type_match_subquery.sql` i Supabase SQL Editor
2. Kjør EXPLAIN ANALYZE-spørringen fra kommentaren i filen og bekreft at "Index Scan on
   service_types" forsvinner fra per-rad-loopen i scored_services
3. Monitorér Supabase-loggene 48 timer for 500-feil

**HTTP 555 / service_cache**: Separat, uresponsiv issue. `getServiceSupabase()` returnerer
null (ikke anon) ved manglende env var — ingen kode-bug. Sannsynligvis bot/crawler som
treffer PostgREST direkte. RLS er allerede korrekt konfigurert (sql/19). Ingen kodeendring.

### Backend — sql/37_services_lat_lon_columns.sql kjørt og bekreftet

`lat`/`lon double precision` lagt til på `services` via trigger (`services_sync_lat_lon`,
`BEFORE INSERT OR UPDATE OF base_location`). `GENERATED ALWAYS AS STORED` ble avvist —
`geography::geometry`-casten er ikke garantert IMMUTABLE i dette PostGIS-oppsettet. Trigger-
mønsteret er identisk med `services_set_search_text`. Engangs-UPDATE kjørte (~32k rader).
Bekreftet via `anl_48504_hellfjell_golfbane`: `lat: 65.925509, lon: 13.312472` ✓

### Frontend (2026-06-29 — kart med markør på anlegg-profilsider uten bilde)

Ny, frittstående oppgave (ikke knyttet til en aktiv spec) — backend legger til `lat`/`lon` som
genererte kolonner på `services`, ny migrasjon ikke kjørt mot DB ved skrivende stund. Dev-server
kjørte allerede på port 3000 — **ikke startet/restartet**.

- **`lib/domain.ts`**: `lat?: number | null; lon?: number | null;` lagt til på `Service`
- **Ny `components/ProfileLocationMap.tsx`** (`'use client'`): minimal `MapContainer` + én
  `Marker`, ingen radius-sirkel/brukerposisjon (annen kontrakt enn `ServiceMap.tsx`, bevisst ikke
  importert derfra — kun marker-ikon-webpack-fiksen kopiert, som instruert). Rendres som
  `absolute inset-0` — drop-in-erstatning for gradient-/bilde-branchen i `ProviderClient.tsx`,
  ikke en selvstendig-stilt boks
- **`app/tilbyder/[id]/page.tsx`**: `lat`/`lon` lagt til i et eget
  `SERVICE_SELECT_WITH_LOCATION` (ikke i `SERVICE_SELECT` selv) + `mapServiceRow`
- **Kritisk fanget proaktivt, ikke i oppgaveteksten**: et `.select()` mot en kolonne som ikke
  finnes ennå feiler PostgREST sin spørring i SIN HELHET (ikke bare de to feltene) — å bare
  legge `lat, lon` rett i eksisterende `SERVICE_SELECT` ville gjort at **alle**
  tilbyder-profilsider viste "ingen tilbyder" til migrasjonen kjøres, ikke bare manglet kartet.
  Løst med samme retry-mønster som `searchServices()` sin `p_borough`-retry: `fetchServiceById()`
  prøver med lat/lon først, og faller tilbake til en spørring uten dem ved feil
- **`ProviderClient.tsx`**: ny gren i bilde-seksjonen FØR gradient-fallback — viser
  `ProfileLocationMap` (dynamic import, `ssr:false`, samme mønster som `ResultsView.tsx` bruker
  for `ServiceMap`) når `isFacility && !cover_image_url && lat/lon finnes`. Gradient-fallbacken
  selv er **uendret**, kun flyttet til en ny `else`-gren
- `npx tsc --noEmit`: grønt
- **`npm run build`: grønt, kjørt med isolert `distDir`** (`.next-build-verify`, satt
  temporært i `next.config.js`, revertert umiddelbart etter — bekreftet med `git diff` at filen
  er tilbake til original). Lærdom fra en tidligere runde der `npm run build` mot delt `.next`
  korrumperte den kjørende dev-serverens chunk-referanser — unngått denne gangen
- **Verifisert mot ekte (ennå-ikke-migrert) data**: bekreftet direkte i Supabase at
  `services.lat`/`lon` faktisk IKKE finnes ennå (`column services.lat does not exist`). Lastet et
  facility-anlegg uten bilde (`anl_48504_hellfjell_golfbane`) — 200 OK, navn vises, **ingen
  krasj**, og siden viser korrekt gradient-fallback (ikke leaflet-markup) siden lat/lon er
  `null` etter retry-fallback. Dette bekrefter retry-fiksen faktisk er den koden som kjører, ikke
  bare antatt
- **Begrensning**: selve kartet+markøren med ekte koordinater er ikke visuelt observert (krever
  at bruker kjører migrasjonen først) — kun "krasjer ikke uten data"-banen er verifisert, som
  instruert

### Test (2026-06-29 — tur-ruteliste: browser-verifisering, se ROLLE_TESTER.md)

Kjørt i ekte Chromium (Playwright, headless, ikke chromium-cli — ikke tilgjengelig i dette
Windows-miljøet, brukte `node_modules/playwright` direkte fra prosjektroten i stedet). Dev-server
startet av tester-agenten selv (ingen instans kjørte før), kjører fortsatt på port 3000.

- **Listepanel-klikk → fitBounds/highlight (Tillegg 1+2): PASS.** Klikket på
  "Turruter i Moelvmarka - Tilslutning" (kjedet gruppe, 54,2 km totalt over mange Geonorge-segmenter
  — nettopp den typen kommunegrense-kjeding Tillegg 2 skal håndtere). Etter klikk: valgt rute fikk
  `stroke-width=3`/`stroke-opacity=1`, alle andre synlige ruter falt til `stroke-width=1`/
  `stroke-opacity=0.4` (bekreftet via DOM-inspeksjon av `path.leaflet-interactive`-attributter,
  ikke bare visuelt). Infoboks dukket opp med korrekt navn + lengde. Kartets viewport endret seg
  synlig mellom skjermbilde før/etter klikk (fitBounds kjørte).
- **`hideShortTrails`-checkbox filtrerer KARTET, ikke bare listen (Tillegg 3): PASS.** Med
  checkboxen i default-tilstand (`checked=true`, korte ruter skjult): 1123 polylines i en
  zoomet-ut Hedmark/Stange-visning. Avkrysset (`checked=false`, viser alt): 1401 polylines —
  +278 ruter ble synlige på selve kartet, ikke kun i listepanelet. Reverserbar (krysset på igjen,
  tellingen gikk tilbake).
- **Det uavklarte ~70%-grupperingsfunnet: IKKE bekreftet eller avkreftet.** Søkte gjennom listen i
  to forskjellige zoomet-ut visninger (40 og 63 oppføringer) etter duplikate ikke-"Ukjent"
  navngitte grupper (tegn på at `getGroupKey()`/`buildChainedGroups()` har feilet) — fant null
  duplikater i begge. Mange "Ukjent"-rader vises fortsatt enkeltvis (forventet, bevisst
  IKKE gruppert per design). **Dette utelukker ikke brukerens opprinnelige observasjon** —
  testet kun 2 vilkårlige viewports, ikke det spesifikke området/ruten bruker så problemet i.
  Uten et konkret rutenavn fra bruker (se tasks.md linje 19, aldri spesifisert) er dette punktet
  fortsatt åpent. **Anbefaling**: be bruker peke ut nøyaktig rute/område neste gang de ser det.
- **Mobil-viewport (390×844, under `lg`-brytpunkt): PASS.** `flex-col lg:flex-row`-containeren
  fikk bekreftet `computedStyle.flexDirection === 'column'`. Kart (356×558px) og listepanel
  (356px bredt, scrollbart) begge synlige og stablet vertikalt, ingen overlapp.
- Ingen konsollfeil (`page.on('console')`/`pageerror`) gjennom noen av testene.
- Tasks.md oppdatert: 3 av 4 browser-punkter krysset av, det 4. (~70%-funnet) latt åpent med
  forklaring. Ingen produksjonskode endret.

**Neste steg**: PM kan arkivere de 3 bekreftede punktene som ferdige. Det åpne
grupperings-spørsmålet bør IKKE blokkere arkivering av resten av spec'en (i tråd med brukerens
tidligere beslutning om å utsette det, se linje 19 i tasks.md) — men bør stå i en egen liten
oppfølgings-rad til et konkret eksempel dukker opp.

### Frontend (2026-06-22 — bugfiks: turrute-duplikater i "Aktiviteter nær deg")

Bugfiks i `components/home/HomeNearbyActivities.tsx` — ikke knyttet til en aktiv spec.
`lavterskel-naer-deg` (som introduserte denne komponenten/koden) er allerede arkivert til
`specs/done/`, så noterer direkte her i stedet for å gjenåpne en avsluttet spec. Dev-server
kjørte allerede på port 3000 — **ikke startet/restartet**.

- **Bug**: `get_nearest_trails()`-RPC-en returnerer rå, ufragmenterte Geonorge-segmenter — samme
  turrute (f.eks. "Gulskgen - Konnerudkollen") dukket opp som flere separate kort med litt
  forskjellig avstand/lengde. Ingen gruppering fantes i denne kodeveien, i motsetning til
  `/tur` sin `TrailMap.tsx` (som nå har en fungerende `getGroupKey()`-basert fiks)
- **Viktig forskjell fra `/tur`-fiksen**: `get_nearest_trails()` returnerer KUN
  `id/name/trail_type/length_km/distance_km` — ingen geometri/koordinater. Den avanserte
  koblings-baserte kjedingen (`buildChainedGroups()` i `TrailMap.tsx`, som bruker
  segment-endepunkter) er derfor ikke mulig her — og ikke nødvendig for et lite
  "nærmeste 10"-forslagsfelt. Enkel navne+type-gruppering (samme prinsipp som `/tur` sin
  opprinnelige "Tillegg 1"-fiks) er tilstrekkelig
- **Ny `groupNearestTrails()`** i `HomeNearbyActivities.tsx`: grupperer på `(trailType, name)`.
  For hver gruppe: MINSTE `distanceKm` (nærmeste segment), SUM `lengthKm` (null bidrar ikke til
  summen, men resultatet er `null` — ikke `0` — hvis ALLE segmenter i gruppen mangler lengdedata)
- **"Ukjent"-rader grupperes BEVISST IKKE** — egen `id::`-nøkkel pr. rad, akkurat som i dag.
  Uten geometri her (i motsetning til `/tur`) er det ingen måte å bekrefte at to "Ukjent"-rader
  er fysisk samme rute — en feilaktig sammenslåing ville vært verre enn ingen sammenslåing
- Resten av komponenten uendret: sortering på avstand, maks-antall kort, merge med
  facility-kortene skjer fortsatt etter samme mønster — kun selve trail-listen er gruppert
  FØR `trailCards` bygges
- `npx tsc --noEmit`: grønt
- **Verifisert mot ekte data**: kalte `get_nearest_trails()` direkte (Supabase RPC, anon-klient,
  samme som appen bruker) for et punkt nær Konnerud (59.745°N, 10.17°E, radius 5km, limit 50).
  Fant 4 rå rader for "Gulskgen - Konnerudkollen" (avstander 1.02/1.40/1.42/1.42 km, lengder
  0.407/0.104/0.143/0.166 km) → etter gruppering: **1 rad**, `distance_km=1.02` (korrekt MIN),
  `length_km=0.82` (korrekt SUM av de 4). 50 rå rader → 10 grupperte rader totalt i testen.
  "Ukjent"-logikken bekreftet urørt (0 i begge, kode-gjennomgang bekrefter riktig `id::`-rute)
- **Begrensning**: selve UI-kortene på forsiden (at duplikatene faktisk er borte visuelt) er
  ikke observert i browser av agent — kun RPC-data-/grupperingslogikken er verifisert direkte.
  Siden komponentens egen RPC-kall bruker `limit=10` (uendret), kan det totale antall viste kort
  bli noe LAVERE enn 10 når duplikater kollapser (forventet og akseptert konsekvens, ikke noe
  jeg endret — instruksen var eksplisitt å beholde eksisterende limit/merge-oppførsel)

### Frontend (2026-06-22 — tur-ruteliste: Tillegg 3, skjul korte ruter)

Implementert ad-hoc-forespørsel (lagt til som "Tillegg 3" i `specs/active/tur-ruteliste/`
design.md + tasks.md for sporbarhet), kun i `components/TrailMap.tsx`. Dev-server kjørte
allerede på port 3000 — **ikke startet/restartet**. Kun `curl`/`fetch` mot den, ingen
`npm run build` (samme forsiktighet som forrige runde).

- Ny `hideShortTrails`-state, default `true` (skjult) — **valgte toggle over hardkodet regel**:
  brukerens motivasjon var ren opprydding, men en reversibel checkbox (samme mønster som
  eksisterende type-/Tettsteder-toggles i samme fil) gir en vei tilbake uten kodeendring, til
  praktisk talt null ekstra kompleksitet
- Filtrerer på `group.totalLengthKm` (SAMLET lengde etter Tillegg 2 sin kjeding), ikke
  enkeltsegmenter — en lang rute bygget av mange korte Geonorge-segmenter (f.eks.
  "Gulskgen - Konnerudkollen") brytes ikke opp eller skjules siden den totalt er over 1 km.
  `totalLengthKm === null` (ingen segmenter i gruppen har lengdedata i kildedata) vises uansett —
  vurdert og besluttet: usikker lengde er ikke det samme som bekreftet kort, og å skjule data vi
  rett og slett ikke vet noe om ville vært en feilaktig konklusjon, ikke en konservativ en
- Samme filtrerte sett (`keptTrailIds`, avledet fra de samme `chainedVisible.groups` som allerede
  driver listepanelet) brukes til BÅDE Polyline-rendering og listepanelet — ett sannhetssted,
  konsistent med resten av filens eksisterende arkitektur
- `npx tsc --noEmit`: grønt
- **Manuell verifisering mot ekte data** (curl/Node mot kjørende dev-server, ingen browser):
  - "Gulskgen - Konnerudkollen" (riktig skrivemåte bekreftet — ikke "Gulskogen" som i tidligere
    samtale): 35 segmenter, **3,81 km totalt** → korrekt KEPT (langt over 1km-grensen)
  - UT.no-ruten "Fottur fra Fossum til Lysaker langs Lysakerelva": 8,73 km, ett sammenhengende
    segment (UT.no-import er ikke fragmentert som Geonorge) → korrekt KEPT
  - I en testbbox ved Konnerud (202 navne-grupper totalt): **160 grupper under 1 km ville blitt
    skjult, 42 beholdt** — betydelig opprydding, konsistent med brukerens "rotete kart"-klage
- **Begrensning**: visuell bekreftelse av selve kart-/liste-opplevelsen (at det FAKTISK ser
  mindre rotete ut, at checkboxen fungerer interaktivt) krever en browser — ikke observert av
  agent. Algoritme-/filtreringskorrekthet er verifisert mot ekte data, ikke gjettet

### Backend (2026-06-22) — GPX-import fra UT.no, proof of concept

Dev-server kjørte allerede på port 3000 — ikke rørt. Ny `scripts/parse-gpx-trails.ts` — bevisst
enkel regex-parsing (ikke `sax`/DOM), siden filene er små (<100KB) og strukturen triviell
(ett `<trk>`/`<trkseg>`, allerede WGS84, allerede sammenhengende — ikke fragmentert som
Geonorge). Leser alle `.gpx`-filer i `turer/`, ingen filnavn hardkodet.

- **Begge filer importert og verifisert direkte i DB** (dry-run kjørt først, deretter ekte):
  - `fottur-fra-fossum-til-lysaker-langs-lysakerelva-trip.gpx` → "Fottur fra Fossum til Lysaker
    langs Lysakerelva", 626 punkter, **8.73 km**, `trail_type='fotrute'`
  - `idyllisk-kajakktur-langs-e39-i-lind-s-trip.gpx` → "Idyllisk kajakktur langs E39 i Lindås",
    119 punkter, **13.74 km**, `trail_type='annet'` (ingen bedre passende verdi i dagens
    `CHECK`-constraint for kajakk — IKKE utvidet enum'en for ett testtilfelle, som instruert)
  - Begge: `source='ut.no'`, `source_local_id`=filnavn uten extension, `maintainer='UT.no'`,
    `marked`/`difficulty`=NULL. Ingen ny SQL-migrasjon — `source`-kolonnen og dens
    ikke-partielle unike indeks på `(source, source_local_id)` finnes allerede (`sql/22_trails.sql`).
  - 2 rader bekreftet i `trails` via direkte `SELECT` (service-role).
- **Ingen ekte Geonorge-duplikat funnet for Lysakerelva-ruten**: bbox-søk (59.91–59.97°N,
  10.55–10.65°E, via `get_trails_in_bbox` — indeksakselerert, trygt å kjøre) ga 621 Geonorge-
  segmenter i området, 11 unike navn. Det ENE treffet på eksakt navnet "Fottur fra Fossum til
  Lysaker langs Lysakerelva" var min egen nylig importerte `ut.no`-rad selv (samme `id`,
  bekreftet ved sammenligning) — ikke en separat Geonorge-rad. **Men 10 ANDRE navngitte
  Geonorge-ruter finnes i samme område** og kan fysisk overlappe/krysse den nye stien uten å
  dele navn: "Kyststi Bærum kommune", "KyststiOslo", "Kystruta", "Maerradalsbekken-langs",
  "Bestumkilen - Vassholmen - Langåra", "Bogstadvannet rundt", "Revisjon Bærumsmarka",
  "Pilegrimsleden-Gudbrandsdalsleden", "Pilegrimsled i Vestfold (Tunsbergleden)", "Ukjent" —
  **verdt en visuell sjekk på `/tur` for å se om noen av disse fysisk følger samme elvestrekning**.
- **Driftslærdom, ikke spesifikt for denne oppgaven**: et direkte navne-likhetssøk
  (`eq('source','geonorge').eq('name', '...')`) mot HELE `trails`-tabellen (163 781 rader,
  ingen indeks på `name`) timet ut — samme mønster som resten av denne sesjonens
  perf-saker. Unngikk dette ved å bruke det allerede bbox-/indeksavgrensede resultatet i
  stedet for å kjøre flere tunge ad-hoc-spørringer mot hele tabellen.
- Ingen automatisk identifisering/fjerning av overlappende Geonorge-fragmenter gjort — bevisst
  utelatt som instruert, det er en egen, større oppgave som krever treffsikker geografisk/
  navnemessig matching og bør vurderes etter at bruker har sett resultatet visuelt.
- `npx tsc --noEmit`: 0 feil.
- **Ingen SQL-migrasjon i denne oppgaven** — ingenting å markere som "bruker må kjøre".

### Frontend (2026-06-22 — tur-ruteliste: Tillegg 2, koblings-basert kjeding)

Implementert `## Frontend — Tillegg 2` i `specs/active/tur-ruteliste/tasks.md`, kun i
`components/TrailMap.tsx`. Dev-server kjørte allerede på port 3000 — **ikke startet/restartet,
ingen portkonflikt**. Kun lese-operasjoner (curl/fetch) mot den, ingen `npm run build` kjørt
denne runden (lærdom fra forrige incident unngått bevisst).

- Ny `buildChainedGroups()` kjørt PÅ TOPP av eksisterende `getGroupKey()`-navne-gruppering
  (uendret fra Tillegg 1): union-find over navne-gruppe-nøkler, slår sammen to grupper av samme
  `trailType` når et segment i den ene deler endepunkt (≤30m ekte avstand, `L.latLng().distanceTo()`,
  ikke naiv gradavstand) med et segment i den andre
- **Sikkerhetsregel**: teller DISTINKTE navne-grupper (ikke rå segmentantall) som møtes i et
  endepunkt — eksakt 2 → kjed sammen, 3+ → la stå (sannsynlig reelt trekryss). Bevisst konservativt
  tolkningsvalg der spec-teksten var litt flertydig mellom "segmenter" og "grupper" — gruppe-telling
  er den mer robuste og meningsfulle definisjonen (flere segmenter fra SAMME 2 grupper i ett punkt
  er fortsatt en trygg 2-veis kobling)
- Representativt navn: største navngitte undergruppe vinner over "Ukjent" uavhengig av størrelse;
  blant navngitte, størst segmentantall vinner. "Ukjent" kun hvis hele kjeden er navnløs
- Rutenett-bucket (celle ≈0,0005°/~55m i breddegrad-retning — alltid det største av lat/lon-celle-
  arealet uansett breddegrad, så 3×3-nabolagssjekk er trygt nok for 30m-terskelen) i stedet for
  O(n²)-løkke
- `fitBounds`/summert lengde/minimumsavstand utvidet til alle segmenter i kjedet gruppe (samme
  mønster som før, over et større sammenslått sett). `selectedGroupKey` er en sortert kombinasjon
  av underliggende navne-gruppenøkler (`chain::key1|key2|...`) — deterministisk uavhengig av
  union-find sin tilfeldige root-rekkefølge
- `npx tsc --noEmit`: grønt
- **Manuell verifisering mot ekte data ved Jarmyra** (bbox 59.895–59.925°N, 10.51–10.57°E, 269
  segmenter hentet via kjørende dev-server sin `/api/trails`, kjedingslogikken replikert i et
  frittstående Node-script siden ingen browser-tilgang i dette miljøet):
  - **179 navne-grupper → 83 kjedede grupper** — solid reduksjon
  - Største kjede samler 124 segmenter (mange "Ukjent" + 5 forskjellige navn, inkl. "Pilegrimsled
    i Vestfold (Tunsbergleden)" og fire "Turveier ..."-varianter) — nøyaktig
    kommunegrense-artefaktet spec'en beskrev empirisk
  - Representant-navn bekreftet korrekt: "Pilegrimsled i Vestfold (Tunsbergleden)" (40 segmenter,
    størst navngitt undergruppe i kjeden) vinner over de fire andre navngitte undergruppene
  - **164 endepunkt-møter korrekt avvist** som reelle kryss (3+ grupper) — konkret eksempel
    verifisert med 5 grupper møtt i samme punkt, bekreftet IKKE slått sammen
- **Begrensning**: faktisk klikk-i-liste/kart-interaksjon (highlight, fitBounds, infoboks) er
  ikke visuelt observert av agent — kun algoritme-korrektheten er verifisert mot ekte data.
  Bruker bør bekrefte visuelt i browser at Jarmyra-området nå viser få rader i stedet for mange,
  og at et kjent trekryss ikke slås sammen feilaktig

---

## Neste steg

| Agent | Oppgave | Blokkert av |
|-------|---------|-------------|
| ~~Bruker~~ | ~~Kjør `sql/37_services_lat_lon_columns.sql`~~ — **kjørt 2026-07-02**, `lat`/`lon` bekreftet (`anl_48504_hellfjell_golfbane`: lat 65.93, lon 13.31 ✓). Gjenstår kun visuell test: facility-anlegg uten bilde skal vise kart+markør i stedet for mørk gradient | — |
| Bruker | Visuell test i browser av "Aktiviteter nær deg"-fiksen: bekreft "Gulskgen - Konnerudkollen" (eller annen tidligere duplikat-rute) nå kun vises ÉN gang på forsiden, ikke flere ganger med litt forskjellig avstand | — |
| Bruker | Visuell test i browser av tur-ruteliste Tillegg 2: Jarmyra-området (Jar, Bærum, ~59.91°N/10.54°E) skal nå vise få rader i stedet for mange "Ukjent"-segmenter; bekreft at et kjent trekryss (3+ ruter møtes) ikke slås feilaktig sammen. Algoritme-korrekthet er verifisert mot ekte data (se Frontend-loggen 2026-06-22), men selve klikk/highlight/fitBounds-interaksjonen er ikke visuelt observert av agent | — |
| Bruker | Visuell test av Tillegg 3 (skjul korte ruter): bekreft "Skjul korte ruter (<1 km)"-checkboxen faktisk fungerer interaktivt og at kartet føles mindre rotete med den PÅ (standard) — bekreft også at lange ruter (Gulskgen-Konnerudkollen, de 2 UT.no-rutene) fortsatt vises | — |
| Bruker | Sammenlign visuelt på `/tur`: de 2 nye UT.no-rutene (Fottur Fossum–Lysaker, kajakktur Lindås) mot 10 andre navngitte Geonorge-ruter i samme Lysakerelva-område ("Kyststi Bærum kommune", "KyststiOslo", "Kystruta" m.fl., se Backend-loggen 2026-06-22 GPX-import) — sjekk om noen fysisk overlapper langs elva selv om navnene er forskjellige, før noen dedupliserings-jobb vurderes | — |
| PM | Hvis Tillegg 2 bekreftes OK av bruker: sjekk mot suksesskriterier i proposal.md, arkiver `tur-ruteliste` til specs/done/ | Venter på bruker sin visuelle test |
| Frontend | Vis byer distinkt på `/tur`-kartet (egen markørstil + legend-toggle "Vis kun byer"), `lib/settlementsDb.ts` får `isCity`-felt | — |
| *(utsatt)* | `app/dashboard/services/[id]/edit/page.tsx` kan ha samme id-encoding-bug som ble fikset i `anlegg-uten-tilbyder` (params.id i en client component, annen kontekst, ikke verifisert) — relevant for tilbydere med æøå i egen tjeneste-ID | — |
| *(valgfritt)* | Kryss-punkt-undersøkelse for turstier (`trail_junctions`) — IKKE implementert, kun rapportert som funn (se `specs/done/lavterskel-naer-deg/`). Geonorge-data er sterkt fragmentert (én rute = 100+ segmenter), et naivt `ST_Intersects`-selv-join ville mest funnet segment-kjede-skjøter, ikke ekte kryss — krever egen filtreringslogikk hvis noen vil forfølge dette | — |
| *(valgfritt)* | sok-fallback-kjede: en ekte Tier 2-banner (søk på "yoga [bynavn]" der lokal dekning faktisk finnes) er aldri visuelt observert pga. tilgjengelig testdata — prøv selv om du vil se det live | — |
| Bruker | Anbefalt: gjør en rask fersk-privatfane-test av "Utforsk aktiviteter" + "Aktiviteter nær deg" på fithub.no etter denne runden er pushet live, for synlig bekreftelse utover RPC-nivå-testene PM allerede har gjort | — |

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

### Feature fullført + produksjonskritisk incident løst: lavterskel-naer-deg (2026-06-22)
- **Hovedfeature**: Oslo-standardlokasjon flyttet til `LocationProvider` (løser et tidligere
  uavklart punkt — lokasjon finnes nå garantert uansett hvilken side man lander på). Alle tre
  "Utforsk aktiviteter"-lenker (`TopNav`/`HeroTopNav`/`HomeHero`) sender nå faktisk lokasjon —
  fikser en reell 0-treff-bug. "Aktiviteter nær deg" filtrert til `provider_type='facility'`
  (tuftepark/hinderløype/pumptrack/diskgolf/aktivitetspark) + navngitte turstier, radius 30 km.
- **Uventet, alvorlig funn under verifisering**: `search_services()` og `get_nearest_trails()`
  timet BEGGE ut på helt vanlige nærmeste-søk — en reell produksjonsregresjon, uavhengig av denne
  featuren, som sannsynligvis allerede påvirket fithub.no. Løst i 6 migrasjoner (`sql/32`–`36`):
  manglende GIST-indeks, en OR-disjunksjon som hindret indeksbruk strukturelt (omskrevet til
  UNION ALL), dyre per-rad-subqueries kjørt før `LIMIT` (flyttet til etter), og for turstier:
  linje- i stedet for punkt-avstand pluss `use_spheroid=false` for å unngå dyr ellipsoide-beregning
  i volum. Diagnosen krevde ekte `EXPLAIN ANALYZE` fra bruker — gjetting traff feil to ganger på
  rad før det. Full forklaring + EXPLAIN-tall i CLAUDE.md-gotcha.
- Endte på ~300ms varmt (fra 2000-4000ms+ timeout) for begge RPC-ene.
- Spec arkivert til `specs/done/lavterskel-naer-deg/`

<!-- Eldre, detaljerte per-runde backend-logger fra denne saken (6 oppfølgingsrunder) er
     kondensert til sammendraget over — full historikk finnes i git-historikken til denne filen
     hvis detaljene trengs igjen. Arkivert under Historikk: Backend (2026-06-22, oppfølging) — get_nearest_trails() fortsatt treg etter sql/35

**Ekte EXPLAIN ANALYZE** (innhentet av bruker): `Index Scan using trails_endpoints_idx` virker
korrekt — 15 056 kandidater etter bbox-filter (19 159 vurdert: 15 056 beholdt + 4 103 fjernet).
Men **2140ms av 2147ms totalt** går til å beregne EKSAKT `ST_Distance`/`ST_DWithin` på
`::geography` for disse radene. sql/35 sin indeks-optimalisering fungerer som tiltenkt —
flaskehalsen er nå volumet av geodetiske avstandsberegninger, ikke kandidat-utvelgelsen.

- **Oppgaven foreslo**: bytt til `::geometry` + grad-basert radius (`p_radius_km/111.0`).
  **Vurdert og IKKE valgt som primærfiks** — grader bredde-/lengdegrad er ikke samme fysiske
  avstand utenfor ekvator. Ved Oslos breddegrad (~60°N) dekker 1° lengdegrad kun ~55 km
  (cos(60°)≈0,5) mot 1° breddegrad sine ~111 km — en enkelt grad-faktor brukt i begge retninger
  gir et søk som i praksis blir en ellipse strukket nord-sør, ikke en sirkel. Forskjellen er
  størst nettopp i Norge (høy breddegrad), som oppgaven selv flagget som noe å være obs på.
- **Valgt i stedet (`sql/36_nearest_trails_spheroid_false.sql`)**: behold `geography`
  (riktig meter-avstand uavhengig av breddegrad), men sett `use_spheroid=false` på BÅDE
  `ST_Distance` og `ST_DWithin`. Dette er en offisielt dokumentert PostGIS-mekanisme nettopp for
  denne avveiningen — standard (`use_spheroid=true`) bruker en iterativ ellipsoide
  geodesic-algoritme (presis, tregere); `false` bruker en enklere sfærisk beregning, vesentlig
  billigere, fortsatt ekte meter, fortsatt korrekt uavhengig av breddegrad. Presisjonstap
  (sfære vs. ellipsoide) er typisk <0,5 % — irrelevant for en "i nærheten"-funksjon.
  **Ingen ny indeks nødvendig** — `trails_endpoints_idx` fra `sql/35` brukes identisk for
  kandidat-utvelgelse uansett `use_spheroid`-verdi; kun beregningsmetoden for EKSAKT avstand på
  allerede-filtrerte rader endres.
- **Ærlig om verifisering**: jeg har IKKE empirisk bekreftet at `use_spheroid=false` faktisk er
  raskere i praksis her — ingen `EXPLAIN ANALYZE`-tilgang (samme begrensning som hele tiden).
  Valget er begrunnet i PostGIS sin dokumenterte oppførsel, ikke målt selv. Lagt inn en
  utkommentert reservefiks (grad-basert `geometry`, alternativet fra oppgaven) nederst i filen
  i tilfelle `use_spheroid=false` ikke er tilstrekkelig — krever i så fall en ny indeks
  (`trails_endpoints_geom_idx`), inkludert i den utkommenterte blokken.
- Funksjonssignatur/`RETURNS TABLE` uendret → ingen `DROP FUNCTION` nødvendig.
- `npx tsc --noEmit`: 0 feil (ren SQL).
- **Ikke kjørt mot databasen ennå.** Be bruker køre
  `EXPLAIN ANALYZE SELECT * FROM get_nearest_trails(59.9139, 10.7522, 30, 20);` på nytt og
  bekrefte total execution time er under ~500ms. Hvis ikke: bytt til reservefiksen nederst i
  `sql/36`.

### Backend (2026-06-22) — get_nearest_trails() timeout-fiks + kryss-punkt-undersøkelse

**Del 1 — fiks (`sql/35_nearest_trails_endpoints.sql`)**: `get_nearest_trails()` timte ut
(samme `57014` som `search_services()` hadde) på 163 781 rader LineString. **Ulik rotårsak fra
søk-saken** — `trails.geom` HAR allerede GIST-indeks (`trails_geom_idx`, `sql/22_trails.sql`).
Problemet er at `ST_Distance`/`ST_DWithin` mot en HEL linje er dyrere per rad enn punkt-til-punkt
(PostGIS må finne nærmeste punkt langs linjen, ikke bare regne avstand mellom to punkter).

- **Fiks**: sammenlign mot `ST_Collect(ST_StartPoint(geom::geometry), ST_EndPoint(geom::geometry))`
  — en 2-punkts MultiPoint. `ST_DWithin`/`ST_Distance` mot en MultiPoint gir automatisk MINSTE
  avstand til ett av punktene, så "nær start ELLER nær slutt" løses med ETT uttrykk.
  **Bevisst IKKE en OR/UNION av to separate betingelser** — det ville gjenskapt samme klasse
  problem som søk-timeout-saken (disjunksjon over flere indekserbare betingelser hindrer
  effektiv indeksbruk, se gotcha i CLAUDE.md). Med ett samlet uttrykk er det kun én ting å
  indeksere.
- Ny funksjonell GIST-indeks `trails_endpoints_idx` på nøyaktig dette uttrykket — den
  eksisterende `trails_geom_idx` (bygget på rå `geom`) kan ikke brukes for et annet uttrykk,
  selv om det stammer fra samme kolonne.
- Funksjonssignatur og `RETURNS TABLE` UENDRET → ingen `DROP FUNCTION` nødvendig denne gangen
  (kun kroppen + en tilleggsindeks endret, bevisst vurdert mot gotchaen, ikke en forglemmelse).
- **Avgrensning bevisst rapportert, ikke skjult**: dette finner ruter der brukeren er nær et
  ENDEPUNKT — ikke der brukeren er nær et midtpunkt på en rundtur langt fra start/slutt. Se
  Del 2 for et mulig fremtidig tillegg.
- **Kan ikke verifiseres av meg** (ingen `EXPLAIN ANALYZE`-tilgang, samme begrensning som
  søk-saken). Bruker bør køre
  `EXPLAIN ANALYZE SELECT * FROM get_nearest_trails(59.9139, 10.7522, 30, 20);` og bekrefte
  `Index Scan` mot `trails_endpoints_idx`, ikke sekvensiell skanning.

**Del 2 — undersøkelse av kryss-punkter (IKKE implementert, kun rapportert som funn)**:

- **Bekreftet empirisk**: ingen vei/road-tabell finnes i skjemaet (grep over alle `sql/*.sql`)
  — "sti møter vei" er ikke gjennomførbart med dagens data, som antatt.
- **Kan ikke gi reelle tall** — ingen vei til å kjøre et `ST_Intersects`-selv-join selv (samme
  begrensning, ingen `exec_sql`/DB-tilkobling). Reverifiserte kun rad-tall: 163 781 totalt
  (137 516 fotrute, 12 135 skiløype, 11 742 sykkelrute, 2 388 annet).
- **Vesentlig komplikasjon funnet ved resonnering, ikke ved testing**: Geonorge-dataene er
  sterkt fragmentert — en enkelt navngitt rute kan bestå av 100+ separate `trails`-rader
  (kjent fra tidligere arbeid i samme prosjekt: "Pilegrimsled i Vestfold" = 124 segmenter). Et
  naivt `ST_Intersects(a.geom, b.geom)`-selv-join ville derfor i hovedsak finne
  **segment-kjede-skjøter INNAD i samme rute** (sekvensielle segmenter som møtes
  endepunkt-til-endepunkt), ikke ekte kryss mellom forskjellige stier. Å skille reelle kryss fra
  dette krever filtreringslogikk (utelukke samme navn/rute-gruppe, utelukke rene
  endepunkt-til-endepunkt-kjedinger) som selv må utvikles og testes iterativt — ikke en
  triviell, avgrenset jobb slik oppgaven ba meg vurdere mot.
- **Konklusjon: IKKE implementert denne runden** — matcher ikke kriteriet "rimelig, avgrenset
  jobb" gitt filtreringskompleksiteten over, og jeg kan ikke verifisere skala/tid selv.
- **Anbefalt neste steg, hvis dette skal forfølges**: bruker kjører et avgrenset testforsøk
  selv (Oslo-område, IKKE landsdekkende — bekreftet trygt avgrenset, ~1000+ rader i bbox via
  `get_trails_in_bbox`, ikke 163k):
  ```sql
  WITH oslo_trails AS (
    SELECT id, name, geom FROM trails
    WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint(10.7522, 59.9139), 4326)::geography, 15000)
  )
  SELECT
    count(*) FILTER (WHERE TRUE) AS naive_intersections,
    count(*) FILTER (WHERE a.name IS DISTINCT FROM b.name) AS filtered_cross_trail_intersections
  FROM oslo_trails a
  JOIN oslo_trails b ON a.id < b.id
  WHERE ST_Intersects(a.geom::geometry, b.geom::geometry);
  ```
  Stort gap mellom de to tallene bekrefter segment-kjede-hypotesen og viser hvor mye
  filtreringsarbeid som faktisk trengs før en `trail_junctions`-tabell gir verdi.
- `npx tsc --noEmit`: 0 feil (ren SQL, ingen TS rørt).
- **`sql/35` ikke kjørt mot databasen ennå — se "Neste steg".**

### Backend (2026-06-22, runde 3) — PRODUKSJONSKRITISK INCIDENT, ekte EXPLAIN-data denne gangen
- **Bruker innhentet faktisk `EXPLAIN ANALYZE` selv** (direkte i Supabase SQL Editor) — første
  gang i denne saken med reell kjøringsplan, ikke kun reproduksjon+resonnement:
  - Hele `search_services(...)`-kallet: **2087ms** total execution time
  - Den isolerte gren C-spørringen alene (by-avstand-fallback, hot path fra `sql/33`): **392ms**,
    bekreftet `Index Scan using idx_services_base_location` (3913 → 3545 rader etter filter) —
    **sql/32 + sql/33 fungerer som tiltenkt** for selve coverage-matchingen
  - Konklusjon: de resterende **~1700ms** av de 2087ms går til resten av funksjonen — scoring/
    match-flagg/`reasons`-beregning for alle 3545 kandidater, FØR `ORDER BY`+`LIMIT` trimmer ned
    til de `p_limit` (typisk 50) radene som faktisk returneres. 2087ms er under SQL Editor sin
    egen timeout, men forklarer fortsatt hvorfor anon/authenticated-API-kallet timer ut (~3.2-4s,
    kortere statement_timeout for disse rollene + PostgREST/pooler-overhead på toppen).
- **Rotårsak**: `reasons`-kolonnen bygges via en KORRELERT subquery
  (`SELECT array_agg(reason) FROM (SELECT unnest(ARRAY[...]) ...)`) i den ytterste `SELECT`-en —
  men ytterste `SELECT` kjørte FØR `ORDER BY`+`LIMIT` i den opprinnelige strukturen (Postgres må
  produsere fullt projiserte rader for å sortere dem; en korrelert subquery i mål-listen kan ikke
  utsettes til etter en `LIMIT` som ligger UTENPÅ projeksjonen). Subqueryen kjørte derfor 3545
  ganger, ikke `max_limit` ganger.
- **Fiks**: `sql/34_fix_search_late_projection.sql` — delte opp slutten av funksjonen i to nye
  CTE-lag: `scored_services` (match-flagg+score, MÅ fortsatt kjøre på hele kandidatsettet — disse
  avgjør hvilke rader som kvalifiserer og standard-sorteringen) → `limited_services`
  (`ORDER BY ... LIMIT max_limit OFFSET ...`, NY plassering — rett etter scoring, FØR noe annet).
  Den ytterste `SELECT` (som bygger `reasons`/`match_reason`/lat/lon) leser nå KUN fra
  `limited_services` — korrelert subquery kjører maks `max_limit` (≤100) ganger i stedet for
  3545. Bevisst IKKE rørt: `goal_match`/`type_match`/`budget_match`/`venue_match`/`score`-
  beregningen ligger fortsatt FØR limit (uunngåelig — de bestemmer hvilke rader som er med og i
  hvilken rekkefølge), kun det rent kosmetiske `reasons`-feltet (og `match_reason`, flyttet for
  symmetri, ikke fordi den i seg selv var dyr) er utsatt. Ingen endring i hvilke tjenester som
  matcher eller hvilken rekkefølge de returneres i.
- 26 kolonner i `RETURNS TABLE`, 26 i endelig `SELECT`-liste — manuelt opptalt og verifisert via
  script. `npx tsc --noEmit`: 0 feil (ren SQL, ingen TS rørt).
- **IKKE kjørt mot databasen ennå — se "Neste steg", HØYESTE PRIORITET.** Kan fortsatt ikke
  verifisere selv uten direkte DB-tilgang — bruker bør kjøre samme `EXPLAIN ANALYZE`-kall som
  ga 2087ms-tallet på nytt etter denne migrasjonen, for å bekrefte at totaltiden nå er nær 392ms
  (gren C sin tid) i stedet for 2087ms.

### Backend (2026-06-22, oppfølging) — PRODUKSJONSKRITISK INCIDENT, sql/32 var IKKE nok
- **Bekreftet av bruker**: etter at `sql/32_fix_search_timeout.sql` ble kjørt (GIST-indeks på
  `services.base_location`), reproduserte det EKSAKT SAMME repro-kallet fortsatt `57014` etter
  ~3.9-8.4s ved gjentatt testing. Indeksen alene løste ikke timeouten.
- **Verifisert at jeg fortsatt ikke har noen vei til `EXPLAIN ANALYZE`**: probet 6 vanlige
  `exec_sql`-aktige RPC-navn direkte mot Supabase (`exec_sql`, `exec`, `execute_sql`, `run_sql`,
  `sql`, `pg_execute`) — alle returnerer "Could not find the function". Ingen `DATABASE_URL`,
  ingen `pg`-pakke. Bekreftet empirisk denne oppgaven, ikke bare videreført forrige agents
  konklusjon ukritisk.
- **Reverifiserte rad-tall live** (uendret siden forrige incident-logg, men kjørt på nytt for å
  utelukke datadrift): `service_coverage` totalt 33 886 (`radius`=0, `city`=23 354,
  `region`=10 532), `services`=32 401. Gjenskapte brukerens eksakte repro-kall direkte — `8387ms`,
  samme `57014`-feilkode.
- **Strukturell rotårsak identifisert (ikke bare "mangler indeks")**: `matched_coverage`-CTE-en
  bruker ÉN `SELECT ... WHERE (A OR B OR C OR D)` over en LEFT JOIN, der A-D er fire helt
  forskjellige betingelsestyper (radius/by-navn/by-avstand/region) på tvers av to tabeller. Dette
  er et kjent, dokumentert PostgreSQL-planleggerbegrensning: en disjunksjon som blander
  indekserbare betingelser fra ulike tilgangsveier hindrer typisk planleggeren i å bruke NOEN av
  indeksene effektivt, uavhengig av om de finnes og er oppdatert (`ANALYZE`) — den faller tilbake
  til å evaluere hele den joinede radmengden sekvensielt. GIST-indeksen fra `sql/32` var korrekt i
  seg selv, men kunne strukturelt ikke bli brukt av planleggeren i denne formen.
- **Fiks**: `sql/33_fix_search_union_branches.sql` — skriver om `matched_coverage` til en
  `UNION ALL` av fire isolerte sub-SELECT-er (én per opprinnelig OR-gren), med `DISTINCT ON`
  anvendt på det sammenslåtte resultatet i stedet for inni hver gren. Hver gren har nå et eget,
  uforstyrret `WHERE`, slik at planleggeren fritt kan velge indeks scan per gren (GIST på
  `radius_center` for gren A, GIST på `base_location` — fra `sql/32` — for gren C, den faktiske
  hot path-en for `p_city=NULL`-søk). Resultatmessig 100 % identisk med original-queryen — en rad
  som matcher flere grener samtidig dedupliseres uendret av `DISTINCT ON`, kun rekkefølgen
  planleggeren får jobbe i er endret. La også til `ANALYZE services; ANALYZE service_coverage;`
  på slutten av filen — adresserer brukerens første hypotese, billig og ufarlig å kjøre uansett,
  men etter all sannsynlighet IKKE tilstrekkelig alene (se forklaring i filens header-kommentar).
  Input-parameterliste og `RETURNS TABLE` UENDRET fra `sql/30` (26 kolonner, manuelt opptalt
  match mellom `RETURNS TABLE` og endelig `SELECT`-liste) — `DROP FUNCTION` kjørt likevel som
  forsiktighetsregel siden hele kroppen erstattes.
- `npx tsc --noEmit`: 0 feil (ren SQL-endring, ingen TS rørt denne oppgaven).
- **IKKE kjørt mot databasen ennå — se "Neste steg", HØYESTE PRIORITET.** Kan ikke verifiseres av
  meg uten `EXPLAIN ANALYZE`-tilgang — bruker må kjøre og selv gjenta repro-kallet (samme params
  som over) for å bekrefte responstid faktisk faller under statement_timeout.

### Backend (2026-06-22) — PRODUKSJONSKRITISK INCIDENT
- **Funn**: `search_services()` timer ut (Postgres `57014`, statement_timeout) på et helt vanlig
  "nærmeste"-søk (rene Oslo-koordinater, ingen filter). Reprodusert empirisk mot prod via anon-klienten
  — `elapsed ms: 3932`, `code: '57014'`. Dette brekker "Aktiviteter nær deg" på forsiden og sannsynligvis
  store deler av vanlig kategorisøk i PRODUKSJON akkurat nå.
- **Rotårsak bekreftet**: `services.base_location` har ALDRI hatt en GIST-indeks i noen migrasjon
  (grep over alle `sql/*.sql` — kolonnen legges til som ren `geography`-kolonne, ingen
  `CREATE INDEX ... USING GIST (base_location)` finnes noe sted). `matched_coverage`-CTE-ens tredje
  `OR`-ledd (`sc.type='city' AND ST_DWithin(s_loc.base_location, user_point, ...)`) tvinges derfor til
  sekvensiell ST_DWithin-beregning. Bekreftet at dette IKKE er en sjelden gren: service-role count viser
  `service_coverage type='city' = 23354`, `type='radius' = 0` (den eneste GIST-indekserte grenen,
  `radius_center`, brukes ALDRI i praksis), `type='region' = 10532`, `services totalt = 32401`. Når
  `p_city` er NULL (typisk for "nærmeste meg uten valgt by") faller ALLE 23 354 city-rader gjennom til
  den uindekserte ST_DWithin-grenen.
- **Fiks**: `sql/32_fix_search_timeout.sql` — legger til `CREATE INDEX idx_services_base_location ON
  services USING GIST (base_location)`. Ren indeks-tilføyelse, INGEN endring i `search_services()`s
  logikk/signatur (DROP+CREATE ikke nødvendig). Full forklaring i kommentar i migrasjonsfilen.
- Ingen `exec_sql`-RPC finnes i dette miljøet (bekreftet, jf. CLAUDE.md) — kunne derfor ikke køre
  `EXPLAIN ANALYZE` direkte. Rotårsak fastslått via (a) reproduksjon av faktisk timeout mot prod,
  (b) systematisk grep av alle migrasjonsfiler for GIST-indekser, (c) faktiske rad-tall fra
  service-role-klient som bekrefter at den uindekserte grenen er hovedveien, ikke en edge-case.
- `npx tsc --noEmit`: 0 feil (ingen TS-endring, ren SQL).
- **IKKE kjørt mot databasen ennå — se "Neste steg", HØYESTE PRIORITET.**

### Backend (2026-06-21)
- Ny migrasjon `sql/31_nearest_trails.sql`: RPC `get_nearest_trails(p_lat, p_lon, p_radius_km, p_limit)`
  - `ST_DWithin(trails.geom, punkt, radius_km*1000)` + `ORDER BY ST_Distance(...)`, samme mønster
    som radius-matching i `search_services()` (sql/29)
  - `WHERE name IS NOT NULL` — kun navngitte ruter (kvalitetsfilter, <30% av rader har navn)
  - Returnerer: `id text, name text, trail_type text, length_km numeric, distance_km double precision`
  - GRANT EXECUTE til anon, authenticated
  - Ingen TS-endring i denne tasken (ren SQL-fil) — `npx tsc --noEmit` kjørt, 0 feil
  - **Ikke kjørt mot databasen** — se "Neste steg"

### Frontend (2026-06-21)
- **Del A — Oslo-default flyttet til `LocationProvider`** (`lib/locationContext.tsx`): mount-effekten
  som allerede leste `localStorage` (`sdem_location_v1`) setter nå Oslo-default DIREKTE der hvis
  ingenting er lagret — race-condition-fiksen som tidligere bodde i `SearchLocationBar.tsx` er
  overflødig nå (det var en barn-komponent som kappet om det, ikke lenger relevant siden default'en
  nå settes i selve foreldre-effekten). Ny `geoPromptVisible`/`dismissGeoPrompt` i context-verdien;
  `SearchLocationBar.tsx` bruker disse i stedet for egen lokal state — banner-UI uendret.
- **Del B — "Utforsk aktiviteter" gir nå faktiske treff**: ny `components/ExploreActivitiesLink.tsx`
  (`'use client'`) bygger `/resultater`-href med `lat`/`lon`/`location`/`city`/`radius` fra
  `useLocation()`, fallback til ren `/resultater` kun i det millisekund-korte vinduet før
  `LocationProvider` har satt Oslo. Brukt i `TopNav.tsx`, `HeroTopNav.tsx`, `HomeHero.tsx` (erstatter
  `ButtonLink href="/resultater"` — samme `buttonForest`-styling, kun lenkebygging endret).
- **Del C — "Aktiviteter nær deg" lavterskel-filter + turstier**: `HomeNearbyActivities.tsx`
  utvidet `searchServices()`-kallet til `radiusKm: 30, limit: 50`, filtrert client-side til
  `provider_type === 'facility'`. Ny `getNearestTrails()` i `lib/trailsDb.ts` (samme mønster som
  `getTrailsInBounds()`, kaller `get_nearest_trails`-RPC) hentes parallelt og merges inn som egen
  korttype (ikon + rutetype + lengde + avstand, lenke til `/tur` — ingen pris/rating siden turstier
  ikke er en `Service`). Samlet liste sortert på avstand, kappet til 10 kort.
  **Trail-kallet feiler gracefully (tomt array)** siden `sql/31_nearest_trails.sql` ikke er kjørt
  ennå — verifisert at facility-kortene fortsatt vises uavhengig.
- `npx tsc --noEmit`: 0 feil. `npm run build` (isolert `NEXT_DIST_DIR=.next-build-check`, ryddet
  opp etterpå) grønt, 485 statiske sider generert. Delt dev-server (port 3000) verifisert fortsatt
  oppe (200) etter build.
- Ikke manuelt browser-testet i denne runden (kun curl-helsesjekk) — anbefaler PM/bruker gjør en
  rask fersk-privatfane-test av "Utforsk aktiviteter" når trail-migrasjonen er kjørt, for å se
  turstier dukke opp i "Aktiviteter nær deg".
-->

### Feature fullført: illustrasjoner-og-rapporter (2026-06-21)
- Navnebasert ikon-gjenkjenning (`lib/serviceIllustrations.tsx`, 12 idretter + type-fallback) for
  tjenestekort uten `cover_image_url`. "Rapporter feil"-knapp (`ReportIssueModal.tsx`) på
  `/resultater`-kort + tilbyderside, ny `services.reported_at` + `service_reports` (`sql/30`,
  kjørt av bruker 2026-06-21), `search_services()` filtrerer på `reported_at IS NULL`
- Reell bug funnet og fikset under verifisering: rapporter-lenken på profilsiden var feilaktig
  skjult for tjenester uten kontaktfelt
- **Se CLAUDE.md-gotcha**: umiddelbar skjuling ved første rapport er en bevisst forenkling som
  må revurderes før launch (misbrukspotensial)
- Spec arkivert til `specs/done/illustrasjoner-og-rapporter/`

### Feature fullført: anlegg-uten-tilbyder (2026-06-20)
- Ny `provider_type` skiller anlegg fra bedrifter. Fant og fikset en større id-encoding-bug under
  Steg 0 (41% av anleggs-ID-er affisert av at Next.js ikke dekoder ikke-ASCII path-segmenter) —
  se egen gotcha i CLAUDE.md. `orgnr` lagres bevisst ikke for anlegg (UNIQUE-constraint-konflikt)
- Migrasjonene `sql/28_provider_type.sql` + `sql/29_search_services_provider_type.sql` kjørt av
  bruker 2026-06-20
- Spec arkivert til `specs/done/anlegg-uten-tilbyder/`

### Feature fullført: homepage-rebrand (2026-06-19/20)
- Ny forside-komposisjon (Hero/Verditilbud/Aktiviteter nær deg/CategoryGrid), nye brand-fargetokens,
  ny stor søkebar i hero, nye sider /om-oss /tilbydere /magasin
- Driftslærdom: `npm run build` samtidig med aktiv `npm run dev` korrumperer `.next` — se
  feedback-memory om dev-server-koordinering mellom PM og kodeagenter
- Spec arkivert til `specs/done/homepage-rebrand/`

### Feature fullført: samlet søk/lokasjon-felt (2026-06-19)
- `SearchLocationBar` erstatter `LocationBar` + to embedded søkefelt. "Smart søk"-veksling,
  Oslo-standard + GPS-prompt, Oslo-bydel fjernet helt
- Spec arkivert til `specs/done/samlet-sok-lokasjon/`

### Feature fullført: søk her-knapp + tag-filter-fiks (2026-06-19)
- Fikset 2 reelle bugs i søk-fallback-kjeden (Tier 2-query-fallback, Tier 3 manglet tag-støtte)
- `sql/27_search_unanchored_tags.sql` kjørt av bruker
- Spec arkivert til `specs/done/sok-her-knapp/`

### Feature fullført: turruter-flis på forsiden (2026-06-19)
- 8. flis lenker til `/tur`, gjenbruker `CategoryCard` uendret
- Spec arkivert til `specs/done/tur-flis-forside/`

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

**Tester-agent** — etter fullført QA-runde (se `ROLLE_TESTER.md` for full rolledefinisjon):
```
### Test ([dato] — [feature])
- Suksesskriterium 1 (proposal.md): PASS — [konkret bevis/repro]
- Suksesskriterium 2: FAIL — [repro-steg] → eskalert til frontend, se "Neste steg"
- Krysset av N "Manuell test"-bokser i tasks.md (de jeg faktisk verifiserte selv, ikke arvet)
- Nye funn lagt i "Neste steg": [...]
```

**PM-agent** — etter arkivert feature:
```
### Feature fullført: [feature-navn] ([dato])
- Spec arkivert til specs/done/[feature-navn]/
- CLAUDE.md oppdatert
```
