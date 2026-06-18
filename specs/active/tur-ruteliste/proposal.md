# Klikkbar ruteliste på /tur – Proposal

## Sammendrag
Legg til et sidepanel på `/tur` med en klikkbar liste over synlige ruter (fotrute/skiløype/sykkelrute), sortert etter nærhet til posisjon. Gjør dagens statiske type-legend til reelle av/på-knapper. Klikk på en rute sentrerer og fremhever den på kartet med en infoboks.

## Hva
- Fotrute/skiløype/sykkelrute/annet-legenden under kartet blir til faktiske checkboxes (samme mekanisme som dagens Tettsteder-toggle)
- Nytt sidepanel ved siden av kartet: liste over ruter i synlig kartområde, sortert nærmest-først (avstand fra brukerens posisjon til ruten beregnes klientsidig)
- Klikk på en rute i listen: kartet sentrerer/zoomer til ruten, ruten fremheves (tykkere linje, full opasitet), andre ruter dempes, og en infoboks viser navn/type/lengde/vedlikeholder

## Hvorfor
Brukeren ønsket en oversikt over nærliggende turer med distanse og detaljer, i samme stil som resultatlisten på `/resultater` — gjør `/tur`-kartet til mer enn bare visuell utforsking.

## Scope
- `components/TrailMap.tsx` (eneste fil som endres — ingen SQL/API-endringer)

## Ikke i scope
- Høydemeter (krever eksternt høydedata-oppslag, urealistisk for 163 781 ruter — droppet av bruker)
- Endringer i `sql/22_trails.sql`, `lib/trailsDb.ts`, `app/api/trails/route.ts` — all nødvendig data finnes allerede i dagens viewport-henting
- Endring av tettsted-laget (uberørt)

## Suksesskriterier
- [ ] Type-checkboxes skjuler/viser samtidig både kartlinjer og listeoppføringer for den typen
- [ ] Listen er sortert nærmest-først relativt til brukerens posisjon
- [ ] Klikk på en rute sentrerer/zoomer kartet til ruten, fremhever den, demper andre, og viser korrekt infoboks
- [ ] Panorering/zooming oppdaterer listen automatisk via eksisterende bbox-henting — ingen ny fetch-logikk
- [ ] Responsiv: sidepanel ved siden av kartet på desktop, stables under på mobil
- [ ] `npx tsc --noEmit` grønt
