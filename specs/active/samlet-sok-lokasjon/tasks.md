# Samlet søk/lokasjon-felt i toppfanen – Tasks

## Frontend
- [x] Ny `components/SearchLocationBar.tsx`: porter geokoding/radius/GPS-logikk fra `LocationBar.tsx`, legg til `smartSearch`-toggle (localStorage `sdem_smart_search_v1`), fjern Oslo-bydel-`<select>` og "Endre"-knapp, kompakt visning selv klikkbar (label-området er en egen `<button>`, radius/✕ er egne sidestilte knapper — unngår nestede interaktive elementer)
- [x] Default-lokasjon Oslo + samtidig GPS-prompt-banner ved første lasting uten lagret lokasjon. **Viktig race-fiks (ikke i opprinnelig spec-detalj)**: sjekker `localStorage.getItem(LOCATION_STORAGE_KEY)` direkte i stedet for `location`-state fra context, siden barn-komponenters `useEffect` kjører FØR foreldre-komponenters i React — en naiv `location === null`-sjekk i `SearchLocationBar` ville alltid trigget før `LocationProvider` sin egen gjenopprettings-effekt fikk kjørt, og overskrevet en faktisk lagret lokasjon med Oslo på hver lasting
- [x] `components/TopNav.tsx`: bytt til `SearchLocationBar`
- [x] `components/CategoryGrid.tsx`: fjernet embedded søkefelt (`searchQuery`/`handleSearch`) + geo-prompt-banner (`geoPrompt`/`GEO_PROMPT_KEY`/`handleGeoAccept`/`handleGeoSkip`/`reverseGeocodeTop`), fjernet `bydel` fra `doNavigate`. Ubrukt `useEffect`-import fjernet
- [x] `app/resultater/ResultsView.tsx`: fjernet embedded søkefelt (`inputQuery`/`handleSearchSubmit`/"× Fjern søk"), fjernet `bydel: null` fra `handleSearchHere`
- [x] `lib/locationContext.tsx`: fjernet `bydel` fra `LocationState`
- [x] `app/resultater/page.tsx`: fjernet `rawBorough`-parsing og bydel-tekst i header
- [x] Slettet `components/LocationBar.tsx` — bekreftet 0 gjenværende imports først (én treff i grep var en falsk positiv mot `SearchLocationBar`)
- [x] `npx tsc --noEmit` grønt
- [x] Manuell test (mot allerede kjørende dev-server på port 3000 — **ikke startet ny instans, ikke restartet, ingen portkonflikt**): forsiden viser "Smart søk"-checkbox, gamle søkefelt-placeholder/bydel-select/"Endre"-knapp er borte, `/resultater` viser ikke lenger det gamle embedded søkefeltet. **Begrensning**: selve Oslo-default-effekten (grønn prikk i idle-visning) kan ikke verifiseres via curl siden den krever klient-side hydrering (`useEffect` kjører ikke under SSR) — bekreftet i stedet at SSR-fallbacken (edit-modus med adressefelt) rendres korrekt, som er forventet adferd før hydrering

## PM / Avslutning
- [ ] Sjekke mot suksesskriterier i proposal.md
- [ ] Oppdatere CLAUDE.md
- [ ] Arkivere spec til specs/done/
- [ ] Oppdatere handoff.md med "feature fullført"
