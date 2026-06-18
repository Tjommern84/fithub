# Søk-fallback-kjede (Tier 1/2/3) – Proposal

## Sammendrag
Søk med fritekst skal kunne finne treff på navn (f.eks. "Lindmann Yoga") og stedsnavn (f.eks. "yoga drammen") selv når brukerens lokasjonsmarkør står et annet sted, uten å permanent flytte markøren.

## Hva
Når et fritekstsøk (`?q=...`) kjøres, prøv opptil 3 nivåer i rekkefølge, stopp ved første som gir treff:

1. **Tier 1 (forbedret eksisterende søk)**: Samme lokasjonsforankrede `search_services()`-kall som i dag, men `search_text` utvides til å inkludere `city` og `address` slik at f.eks. "yoga drammen" kan matche tekstlig innenfor brukerens egen dekningsomr åde.
2. **Tier 2 (flytt søkeområde)**: Hvis Tier 1 gir 0 treff og søketeksten inneholder et kjent bynavn (mot eksisterende 34-by-liste i `lib/matching.ts`) — fjern bynavnet fra søketeksten, kjør samme søk på nytt sentrert på den byen i stedet. Vis et tydelig varsel om at søkeområdet ble byttet. Brukerens lagrede lokasjon endres IKKE permanent.
3. **Tier 3 (nasjonalt navnetreff)**: Hvis Tier 1 og 2 begge gir 0 treff — kjør et helt nytt, frittstående søk uten dekningsbegrensning, kun på tekstlikhet mot navn/beskrivelse/tags/by/adresse. Vis disse merket "Utenfor ditt område" med by/adresse synlig per kort.

Kategori/tag-nettlesing uten fritekst er helt uberørt (ingen endring i adferd, ingen ekstra kall).

## Hvorfor
I dag blir et perfekt navnetreff (f.eks. "Lindmann Yoga" i Drammen) luket bort hvis brukerens lokasjonsmarkør står i Oslo, fordi `search_services()` krever dekningsmatch FØR tekstsøket vurderes. Brukere som vet nøyaktig hva de leter etter får null treff, uten forklaring.

## Scope
- Ny SQL-migrasjon `sql/24_search_fallback_tiers.sql` (trigger-utvidelse + backfill + ny frittstående Tier-3-funksjon — **ingen endring i `search_services()` selv**)
- `lib/matching.ts` (`detectCityInQuery`), `lib/matchingDb.ts` (`searchServicesUnanchored`, `searchServicesWithFallback`, nye typer)
- `app/resultater/page.tsx`, `app/resultater/ResultsView.tsx`, `lib/domain.ts` (`city`-felt)

## Ikke i scope
- Endring av `search_services()` selv (eksplisitt unngått etter forrige incident — se CLAUDE.md)
- Geokoding-API-kall for stedsnavn-gjenkjenning (kun mot eksisterende 34-by-liste)
- Permanent endring av brukerens lagrede lokasjon/`LocationContext`
- Endring av kategori/tag-nettlesing uten fritekst

## Suksesskriterier
- [x] Tier 3-mekanismen (nasjonalt navnetreff, "Utenfor ditt område"-badge) bekreftet med ekte data — "Lindmann Yoga" selv finnes ikke i databasen (fiktivt eksempel), men "yoga drammen" kaskaderte korrekt til Tier 3 og fant 2 reelle treff med riktig badge
- [x] Tier 2-mekanismen (gjenkjenn stedsnavn → rekoordiner søket) bekreftet — "yoga drammen" fant "Drammen" og søkte der på nytt; ingen reell yoga-dekning i Drammen i denne databasen ga 0 treff der, så kjeden kaskaderte videre til Tier 3 (riktig adferd, men selve "Tier 2 lykkes med banner"-scenarioet ble ikke observert med tilgjengelig data)
- [x] Brukerens lagrede lokasjon endres aldri permanent — sikret arkitektonisk (rekoordinering er 100% intern i `searchServicesWithFallback()`, rører aldri `LocationContext`/URL), ikke separat klikk-testet siden det ikke er en synlig UI-tilstand å observere
- [x] Kategori-nettlesing uten `q`-param: 200 OK, uendret adferd
- [x] Fritekstsøk med ekte Tier 1-treff ("Yogic Shala"): 1 kort, ingen banner/badge — pixel-likt med dagens adferd
- [x] `npx tsc --noEmit` grønt
