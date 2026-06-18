# "Sentrer kart på treff" – Proposal

## Sammendrag
Legg til en knapp på hvert søkeresultat-kort på `/resultater` som sentrerer kartet på det stedet, uten å flytte brukerens lokasjonsmarkør eller søkeradius-sirkel.

## Hva
- Ny knapp ("📍 Sentrer på kart") på `ServiceCard` og `UnanchoredServiceCard` i `app/resultater/ResultsView.tsx` — vises kun når treffet har `lat`/`lon`
- Klikk: kartet panorerer/zoomer til det stedet (via en ny, separat effekt i `ServiceMap.tsx` — påvirker IKKE den eksisterende bruker-lokasjon/radius-sirkel-logikken)
- På mobil (der kart/liste er et toggle): klikk bytter automatisk til kartvisning slik at brukeren faktisk ser resultatet

## Hvorfor
Brukeren fant treff i et annet område (f.eks. søkte "Drammen" mens lokasjon var Oslo) og ønsker å raskt se akkurat det treffet på kartet, uten å måtte lete etter riktig markør manuelt.

## Scope
- `components/ServiceMap.tsx`: ny `focusedCoords`-prop + separat "fly til punkt"-effekt
- `app/resultater/ResultsView.tsx`: ny lokal state, knapp på begge kort-komponenter, kobling til mobil-视visningstoggle

## Ikke i scope
- Endring av eksisterende lokasjon/radius-sirkel-logikk (`FitBounds` i `ServiceMap.tsx`)
- Endring av `/tur`-kartet eller `TrailMap.tsx`
- SQL/API-endringer (rent klientsidig, all data finnes allerede i `RankedService`/`UnanchoredService`)

## Suksesskriterier
- [ ] Knapp vises kun på kort som har koordinater
- [ ] Klikk sentrerer/zoomer kartet til riktig sted, uten å flytte brukerens markør eller radius-sirkel
- [ ] Klikk på mobil bytter automatisk til kartvisning
- [ ] `npx tsc --noEmit` grønt
