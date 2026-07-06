# Klikkbar ruteliste på /tur – Tasks

## Frontend
- [x] `components/TrailMap.tsx`: nye state-variabler (`visibleTypes`, `selectedTrailId`) + `useMemo`-avledet `visibleTrails`/`sortedTrailList`/`selectedTrail`
- [x] Ny `SelectionWatcher`-komponent (parallell til `BoundsWatcher`) for `fitBounds` ved valg — `useEffect`-dependency på `trail?.id` (ikke objektet) for å unngå at viewport-refetch re-trigger `fitBounds` og kjemper mot brukerens pan/zoom
- [x] Polyline-rendering: fremhevings-logikk (valgt/dempet/normal), basert på `visibleTrails`. `eventHandlers.click` gjør linjeklikk på kart konsistent med listevalg
- [x] Infoboks-komponent over listepanelet, vist når `selectedTrail !== null`, med lukk-knapp
- [x] Type-legend → reelle checkboxes (samme mønster som `showSettlements`)
- [x] Listepanel: responsiv layout (`flex-col lg:flex-row`), klikkbare listeelementer (`<button>`), tomme tilstander
- [x] `npx tsc --noEmit` grønt
- [x] `/tur` og `/api/trails` verifisert 200 OK med korrekt data-shape
- [x] Full interaktiv test i browser — **funnet problem**: rute-segmenter fra Turrutebasen vises som separate listeoppføringer i stedet for én samlet rute (se "Tillegg etter visuell test" i design.md)
- [x] Grupper `visibleTrails` på `(name, trailType)` i listen — summert lengde, minimum avstand over alle segmenter, gruppe-nøkkel i stedet for enkelt-id
- [x] Endre `selectedTrailId` → `selectedGroupKey`, oppdater highlight-logikk til å matche alle segmenter i gruppen
- [x] Oppdater `SelectionWatcher`/`fitBounds` til å ta bounds over ALLE segmenters koordinater i valgt gruppe
- [x] Infoboks viser gruppens summerte lengde
- [x] `npx tsc --noEmit` grønt
- [x] **Kritisk fix funnet under egen verifisering** (ikke i opprinnelig design.md-tillegg): kildedata bruker literalen `"Ukjent"` (ikke `null`/tom streng) for navnløse segmenter — bekreftet i `scripts/parse-geonorge-trails.ts:58`. Uten spesialhåndtering ville `getGroupKey` ha slått sammen 104 urelaterte "Ukjent"-segmenter til én falsk gruppe. Lagt til eksplisitt `name !== 'Ukjent'`-sjekk.
- [x] Ny visuell test i browser — **delvis bekreftet av bruker (~70%)**: de fleste flersegment-ruter grupperes nå korrekt til én oppføring, men noen kjente ruter grupperes fortsatt ikke riktig (eksempel ikke spesifisert av bruker ennå). **Bevisst utsatt** — bruker vil heller prioritere tur-flis-forside nå og komme tilbake til resten av grupperingsfeilene senere. IKKE lukk denne spec'en — la stå i specs/active/ til gjenstående tilfeller er undersøkt

## Frontend — Tillegg 2 (koblings-basert kjeding, 2026-06-22)
- [x] Ny `buildChainedGroups()`-funksjon i `TrailMap.tsx`, kjørt PÅ TOPP av eksisterende
      `getGroupKey()`-navne-gruppering (uendret): union-find over navne-gruppe-nøkler, slår sammen
      to grupper av samme `trailType` når et segment i den ene deler endepunkt (≤30m, ekte
      meter-avstand via `L.latLng().distanceTo()`) med et segment i den andre
- [x] Sikkerhetsregel implementert som teller DISTINKTE navne-grupper (ikke rå segmentantall) som
      møtes i et endepunkt: eksakt 2 → kjed sammen, 3+ → la stå (reelt kryss)
- [x] Representativt navn: største navngitte undergruppe vinner over "Ukjent" uavhengig av
      størrelse; blant navngitte, størst segmentantall vinner. "Ukjent" kun hvis HELE kjeden er
      navnløs
- [x] Rutenett-bucket (celle ≈0,0005°/55m, 3×3-nabolagssjekk) for endepunkt-matching — ikke O(n²)
- [x] `fitBounds` (via `SelectionWatcher`), summert lengde og minimumsavstand dekker nå alle
      segmenter i den ferdig kjedede gruppen (samme mønster som før, over et større sett)
- [x] `selectedGroupKey` er en sortert kombinasjon av underliggende navne-gruppenøkler
      (`chain::key1|key2|...`) — deterministisk uavhengig av union-find sin tilfeldige root-rekkefølge
- [x] `npx tsc --noEmit`: grønt
- [x] Manuell verifisering mot ekte data ved Jarmyra (bbox 59.895-59.925°N, 10.51-10.57°E, 269
      segmenter hentet via kjørende dev-server, logikk replikert i frittstående Node-script siden
      ingen browser-tilgang): **179 navne-grupper → 83 kjedede grupper**. Største kjede samler 124
      segmenter (inkl. mange "Ukjent") under 5 ulike navn — nøyaktig kommunegrense-artefaktet
      spec'en beskrev. Representant-navn bekreftet korrekt: "Pilegrimsled i Vestfold
      (Tunsbergleden)" (40 segmenter, størst navngitt undergruppe i kjeden) vinner over de fire
      andre. **164 endepunkt-møter korrekt avvist** som reelle kryss (3+ grupper) — eksempel
      verifisert med 5 grupper møtt i ett punkt, IKKE slått sammen, akkurat som sikkerhetsregelen
      krever

## Frontend — Tillegg 3 (skjul korte ruter, 2026-06-22)
**Bakgrunn**: etter Tillegg 2 (kjeding) klaget bruker over at kartet er rotete — mange korte,
separate Geonorge-snutter ligger visuelt oppå hverandre og gjør det vanskelig å finne en lang,
nylig importert UT.no-rute i samme område.
- [x] Ny `hideShortTrails`-state (default `true`/skjult) — implementert som reversibel checkbox
      (samme mønster som type-/Tettsteder-toggles), ikke en hardkodet regel
- [x] Filtrerer på `group.totalLengthKm` (SAMLET lengde etter kjeding), ikke enkeltsegmenter —
      lange ruter bygget av mange korte Geonorge-segmenter (f.eks. "Gulskgen - Konnerudkollen")
      brytes ikke opp. `totalLengthKm === null` (ingen segmenter i gruppen har lengdedata)
      behandles som "vis uansett" — usikker lengde ≠ bekreftet kort
- [x] Samme filtrerte sett (`keptTrailIds`) brukes til BÅDE Polyline-rendering og listepanelet
- [x] `npx tsc --noEmit`: grønt
- [x] Manuell verifisering mot ekte data: "Gulskgen - Konnerudkollen" (35 segmenter, 3,81 km
      totalt) korrekt KEPT. UT.no-ruten "Fottur fra Fossum til Lysaker" (8,73 km, eget
      enkeltsegment) korrekt KEPT. I en testbbox ved Konnerud (202 navne-grupper): 160 grupper
      under 1 km ville blitt skjult, 42 beholdt — betydelig opprydding, konsistent med brukerens
      "rotete kart"-klage

## Tester / QA
> All "manuell verifisering" over er gjort av frontend-agenten via curl/Node-simulering —
> ALDRI i en ekte browser (ingen browser-tilgang). Dette er nøyaktig den typen gjenstående
> verifiseringsgap `ROLLE_TESTER.md` er laget for å lukke før denne spec'en kan arkiveres.
- [x] Bekreft i ekte browser: klikk i listepanelet sentrerer/fremhever kartet korrekt på valgt
      rute-gruppe (Tillegg 1), inkl. kjedede grupper over kommunegrenser (Tillegg 2) — **PASS**,
      se handoff.md
- [x] Bekreft `hideShortTrails`-checkboxen (Tillegg 3) faktisk filtrerer kartet visuelt, ikke bare
      listen — **PASS**, se handoff.md
- [ ] Undersøk det uavklarte ~70%-funnet fra bruker (linje 19 over): finn et konkret eksempel på
      en rute som fortsatt feilgrupperes, og avgjør om det er et nytt mønster `getGroupKey()`/
      `buildChainedGroups()` ikke dekker, eller en isolert datakvalitetshendelse — **IKKE
      BEKREFTET/AVKREFTET**, se handoff.md. Fortsatt åpen, krever et konkret rutenavn fra bruker
- [x] Mobil-viewport: bekreft listepanel/kart-layout (`flex-col lg:flex-row`) fungerer som
      forventet under `lg`-brytpunktet — **PASS**, se handoff.md
- [x] Rapporter PASS/FAIL pr. punkt i `handoff.md`, eskaler eventuelle funn til frontend før PM
      arkiverer

## PM / Avslutning
- [ ] Sjekke mot suksesskriterier i proposal.md
- [ ] Oppdatere CLAUDE.md
- [ ] Arkivere spec til specs/done/
- [ ] Oppdatere handoff.md med "feature fullført"
