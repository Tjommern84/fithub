# Forside-kategorier (7 fliser) – Proposal

## Sammendrag
Omstrukturerer forsidens kategorigrid: ny Utendørs-flise, Paraidrett-flisen får riktige bilder, og tre kategorier får nye visningsnavn.

## Hva
- Ny flise "Utendørs" (tuftepark + utetrening + plassholder for fellestimer)
- Paraidrett-flisen bruker bildene i `/public/bilder/HC/` i stedet for lånte bilder
- Visningsnavn endres: Trene selv→Egentrening, Trene sammen→Gruppetime, Aktivitet & sport→Sport
- "Sport" skal romme alle sportsklubber (idrettslag) — tuftepark/utetrening-tags flyttes ut til Utendørs

## Hvorfor
Dagens "aktivitet-sport" blander idrettslag og friluft/tuftepark i én flise, og Paraidrett-flisen bruker feil bilder. Brukeren vil ha klarere kategorisering og en dedikert inngang for utendørs/tuftepark-tilbud, med fellestimer forberedt som fremtidig oppmeldingstjeneste.

## Scope
- `lib/categoryConfig.ts`, `components/CategoryGrid.tsx`, `lib/resultFilters.ts`, `app/tuftepark/[city]/page.tsx`
- Én additiv SQL-migrasjon (`sql/21_add_utendors_category.sql`) som legger til en CASE-gren i `search_services()`

## Ikke i scope
- Renaming av tekniske key-strenger, URL-slugs eller DB-migrasjon av eksisterende `main_category`-verdier
- Bygging av fellestimer-oppmeldingstjenesten (kun plassholder-tag)
- Endring av Paraidrett sin redirect-til-aktivitet-sport-logikk

## Suksesskriterier
- [x] 7 fliser vises på forsiden med riktig bilde per kategori (ingen lånte bilder fra feil mappe)
- [x] Hver flise gir ikke-tomme søkeresultater (Paraidrett og Utendørs inkludert) — verifisert i prod etter SQL-migrasjon
- [x] `npx tsc --noEmit` går grønt
- [x] `/tuftepark/[city]` fortsatt fungerer, CTA-lenker peker til ny Utendørs-kategori
