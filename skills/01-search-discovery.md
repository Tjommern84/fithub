# Domene 1 – Søk & Oppdagelse

## Formål
Håndterer alt som skjer når en bruker søker etter trenings- og aktivitetstilbud: URL-parsing, filtrering, geografisk matching og visning av resultater.

## Filer
| Fil | Rolle |
|-----|-------|
| `app/resultater/page.tsx` | Server component – parser URL-params, kaller `searchServices()`, sender data til `ResultsView` |
| `app/resultater/ResultsView.tsx` | Client component – tag-filter, kart, servicekort, paginering, gruppetimer-seksjon |
| `app/resultater/loading.tsx` | Skeleton-UI under lasting |
| `lib/matchingDb.ts` | `searchServices()` – kaller Supabase RPC `search_services()` |
| `lib/matching.ts` | Haversine-avstand, by-koordinater, `normalizeCity()` |
| `lib/resultFilters.ts` | Parser for `serviceType`/`venue`/`sort` fra URL-params |
| `lib/geocode.ts` | Nominatim API-wrapper for by-geocoding med fallback-logikk |
| `sql/01_postgis_and_search.sql` | SQL-funksjon `search_services()` (14 params) + GRANT EXECUTE |

## Nøkkelflyter

### Søkeflyt (ende til ende)
```
CategoryGrid
  → navigerer til /resultater?cat=...&lat=...&lon=...
  → page.tsx parser URL-params
  → kaller searchServices() i matchingDb.ts
  → matchingDb.ts kaller Supabase RPC search_services()
  → resultater returneres og sendes til ResultsView
  → ResultsView rendrer kart + kortliste + filtre
```

### Geocoding-flyt
```
Bruker skriver by-navn
  → geocode.ts kaller Nominatim API
  → fallback-rekkefølge: city → town → municipality → village
  → koordinater lagres i locationContext
  → koordinater sendes som ?lat=...&lon=... i URL
```

### Filterflyt
```
Bruker klikker tag/filter i ResultsView
  → resultFilters.ts parser ny URL-state
  → page.tsx re-kjøres med nye params
  → ny søk mot search_services() med oppdaterte filtre
```

## Kritiske gotchas

- **GRANT EXECUTE**: Etter enhver `DROP + CREATE` av `search_services()` MÅ du kjøre `GRANT EXECUTE ON FUNCTION search_services(...) TO anon, authenticated`. Uten dette feiler alle søk stille.
- **WKT lon-først**: Geografipunkter skrives alltid `SRID=4326;POINT(${lon} ${lat})` — lon ALLTID før lat. Byttes de om gir PostGIS feil resultater uten feilmelding.
- **City-normalisering**: Bruk alltid `locationLabel.split(',')[0].trim().toLowerCase()` før DB-oppslag. Rå Nominatim-strenger inneholder komma og variert casing som bryter matching.
- **Nominatim fallback**: Implementer alltid fallback-rekkefølgen `city → town → municipality → village`. Mange norske steder mangler `city`-feltet.
- **Dynamiske Tailwind-farger**: Bruk `style={{ color: theme.accent }}` for kategorifarger — ikke dynamiske klassestrenger som `text-${color}` (Tailwind purger disse).

## Avhengigheter til andre domener
- **Domene 2** – `CategoryGrid` trigger søk, sender kategoriparam og koordinater
- **Domene 7** – bruker `supabaseClient.ts` for DB-kall, `lib/domain.ts` for TypeScript-typer (`Service`, `ServiceType`)
- **Domene 3** – `ResultsView` viser gruppetimer-seksjon i søkeresultatene

## Vanlige oppgaver

### Legg til nytt søkefilter
1. Legg til ny URL-param i `lib/resultFilters.ts` – definer parser og default-verdi
2. Oppdater `search_services()` i `sql/01_postgis_and_search.sql` med ny parameter (husk: funksjonen har 14 params, legg til på riktig plass)
3. Kjør GRANT EXECUTE på nytt etter SQL-endring
4. Legg til filter-UI i `ResultsView.tsx`
5. Test at URL-state og back-button fungerer korrekt

### Endre sorteringslogikk
1. Finn relevant sorteringslogikk i `search_services()` SQL-funksjonen
2. Oppdater `lib/resultFilters.ts` hvis ny sort-verdi skal eksponeres i URL
3. Test med både koordinat-søk og by-søk (de bruker ulik distanseberegning)

### Debugging av søk som returnerer 0 resultater
1. Sjekk at GRANT EXECUTE er satt (vanligste årsak)
2. Logg faktiske params sendt til `searchServices()` i `matchingDb.ts`
3. Verifiser at koordinater er lon-først i WKT
4. Sjekk at by-navn er normalisert før oppslag
5. Test RPC direkte i Supabase SQL Editor med hardkodede params

### Legg til nytt felt i søkeresultatkort
1. Sørg for at feltet returneres av `search_services()` SQL-funksjonen
2. Oppdater TypeScript-typen `Service` i `lib/domain.ts`
3. Oppdater `matchingDb.ts` hvis feltet trenger mapping/transformasjon
4. Legg til visning i `ResultsView.tsx` / servicekort-komponent
