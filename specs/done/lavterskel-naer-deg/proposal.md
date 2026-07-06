# Lavterskel "Aktiviteter nær deg" + fiks "Utforsk aktiviteter" – Proposal

## Problem
1. "Utforsk aktiviteter" gir 0 treff — lenken sender ingen lokasjon, og `search_services()`
   krever lokasjon for å matche noe i `service_coverage`. Forsterket av at Oslo-standardlokasjonen
   kun settes av en komponent som er skjult på forsiden.
2. "Aktiviteter nær deg" viser PT-er/idrettslag/treningssentre — ikke ønskelig for en
   spontan/lavterskel-seksjon. Mangler også turstier (frikoblet system i dag).

## Scope
- Flytt Oslo-standardlokasjon + GPS-prompt-logikk til `LocationProvider` (root)
- Fiks alle tre "Utforsk aktiviteter"-lenker til å sende lokasjon
- Filtrer "Aktiviteter nær deg" til `provider_type='facility'` (tuftepark/hinderløype/pumptrack
  /diskgolf/klatrevegg-ute/aktivitetspark), radius 30 km
- Ny RPC for nærmeste navngitte turstier, vist sammen med anleggene

## Ikke i scope
- Lekeplasser/akebakker (ingen datakilde i dag)
- Endring av `/tur`-siden eller trail-importen selv
- Kuratering av turstier utover navn-filteret

## Suksesskriterier
- [x] "Utforsk aktiviteter" gir faktiske treff — bekreftet via direkte RPC-test med Oslo-koordinater
      (50 rader returnert, ingen lenger 0-treff-bug)
- [x] "Aktiviteter nær deg" viser kun lavterskel-anlegg (provider_type='facility') + navngitte
      turstier — bekreftet (19 facility-rader av 50 i testkallet)
- [x] Resultater vises opp til 30 km (radiusKm:30 i søket, bekreftet i kode + RPC-test)
- [x] `npx tsc --noEmit` grønt
- [x] **Uventet, kritisk funn under verifisering**: `search_services()` OG `get_nearest_trails()`
      timet begge ut (statement_timeout) på helt vanlige nærmeste-søk — en reell, alvorlig
      produksjonsregresjon uavhengig av denne spec'en, fikset i samme runde (se gotcha i CLAUDE.md)
