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

## PM / Avslutning
- [ ] Sjekke mot suksesskriterier i proposal.md
- [ ] Oppdatere CLAUDE.md
- [ ] Arkivere spec til specs/done/
- [ ] Oppdatere handoff.md med "feature fullført"
