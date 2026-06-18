# "Sentrer kart på treff" – Tasks

## Frontend
- [x] `components/ServiceMap.tsx`: ny `focusedCoords`-prop, ny `FlyToPoint`-komponent (separat fra `FitBounds`, rører ikke bruker-markør/radius-sirkel)
- [x] `app/resultater/ResultsView.tsx`: ny `focusedCoords`-state, send til `ServiceMap`
- [x] `ServiceCard`: ny knapp "📍 Sentrer på kart" (kun når `lat`/`lon` finnes), nær "Se full profil →" — felles `CenterMapButton`-komponent gjenbrukt i begge kort
- [x] `UnanchoredServiceCard`: samme knapp, samme plassering
- [x] Knapp-klikk på mobil bytter også til kartvisning (`handleViewToggle('map')` hvis `view !== 'map'`)
- [x] `npx tsc --noEmit` grønt
- [x] Manuell test: bekreftet via rendret HTML at knappen vises med riktig tekst/tooltip/footer-layout på et reelt treff med koordinater. Selve flyTo-animasjonen og at bruker-markør/radius-sirkel ikke flytter seg krever en ekte browser (Leaflet er `ssr:false`) — koden følger nøyaktig samme isolerte-effekt-mønster som tidligere bekreftet for `FitBounds`/turrute-highlighting, men ikke visuelt observert av agent

## PM / Avslutning
- [x] Arkivert til specs/done/ — **erstattet/supplert** av `sok-her-knapp` (2026-06-18): knappen
  ble omdøpt til "Søk her i stedet" og endret fra å panorere det eksisterende kartet
  (`focusedCoords`/`FlyToPoint`) til å gjøre en reell navigasjon med ny lokasjon. Hele
  `focusedCoords`/`FlyToPoint`-mekanismen i `ServiceMap.tsx` er fjernet som del av den oppgaven.
- [ ] Sjekke mot suksesskriterier i proposal.md (uaktuelt — supplert før PM-runde)
- [ ] Oppdatere CLAUDE.md
- [ ] Oppdatere handoff.md med "feature fullført"
