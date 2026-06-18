# Tur-flis på forsiden – Proposal

## Sammendrag
Legg til en 8. flis på forsiden som lenker til `/tur` (turruter + tettsteder-kartet), med bilder fra `public/bilder/tur/`. Gjør forsidegrid-et jevnt (8 fliser, ingen col-span-2-spesialtilfelle).

## Hva
- Ny flise "Turruter" i `components/CategoryGrid.tsx` — **visuelt og funksjonelt identisk** med de 7 andre (samme `CategoryCard`-komponent, samme bilde-cycling/hover/touch-swipe — ingen ny komponent, ingen visuell forskjell)
- Klikk navigerer direkte til `/tur` — **ikke** gjennom `doNavigate`/`search_services()`, og **ikke** låst bak lokasjonsvalg (siden `/tur` allerede henter sin egen GPS og sentrerer kartet der)
- Bilder fra `public/bilder/tur/` (4 filer)
- Den klikkbare rutelisten på `/tur` selv (nærmest-først, klikk-for-å-fremheve) er en separat, allerede pågående spec (`specs/active/tur-ruteliste/`) — denne spec'en leverer kun forside-inngangen

## Hvorfor
`/tur` (turruter + tettsteder) er en ferdig, fungerende side uten noen inngang fra forsiden i dag. En 8. flis gjør den synlig, og 8 (jevnt tall) ser bedre ut i 2-kolonne-gridet enn 7 (som tvinger siste flise til å spenne 2 kolonner).

## Scope
- `components/CategoryGrid.tsx`: ny flise-data (`TUR_TILE`-konstant) + utvidet `ACCENT`-type/record (`MainCategory | 'tur'`) + spesialcase i klikk-/disabled-håndtering. `CategoryCard`-komponenten selv endres ikke i logikk — kun typeannotasjonen utvides

## Ikke i scope
- `lib/categoryConfig.ts` / `MainCategory`-typen — Tur-flisen er bevisst IKKE en søkekategori, skal ikke inn i `CATEGORIES`, `parseMainCategory()`, eller `search_services()`
- Endring av `/tur`-siden selv

## Suksesskriterier
- [ ] 8 fliser vises i et jevnt 4×2-grid, ingen flis spenner 2 kolonner
- [ ] Tur-flisen bruker bildene fra `public/bilder/tur/`, med samme hover/touch-cycling som de andre
- [ ] Tur-flisen er klikkbar og navigerer til `/tur` UTEN at lokasjon må være satt først
- [ ] De 7 eksisterende kategori-flisene er visuelt og funksjonelt uendret
- [ ] `npx tsc --noEmit` grønt
