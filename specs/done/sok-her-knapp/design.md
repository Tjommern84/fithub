# "Søk her i stedet" + tag-filter-fiks – Teknisk design

## Berørte domener
- 01 Search & Discovery

## Databaseendringer
Ny migrasjon `sql/27_search_unanchored_tags.sql`:
- `DROP FUNCTION IF EXISTS search_services_unanchored(text, double precision, double precision, int);` (eksakt gammel signatur, FØR `CREATE OR REPLACE` — samme gotcha som alltid, se CLAUDE.md)
- `CREATE OR REPLACE FUNCTION search_services_unanchored(p_query text, p_lat double precision DEFAULT NULL, p_lon double precision DEFAULT NULL, p_tags text[] DEFAULT NULL, p_limit int DEFAULT 20)` — samme funksjonskropp som i `sql/24_search_fallback_tiers.sql`, med ett nytt filter lagt til i `WHERE`-klausulen: `AND (p_tags IS NULL OR s.tags && p_tags)`
- `GRANT EXECUTE ON FUNCTION search_services_unanchored(text, double precision, double precision, text[], int) TO anon, authenticated;` — ny signatur (parameterrekkefølge endret: `p_tags` lagt til FØR `p_limit` for å unngå å bryte eksisterende posisjonelle kall — bekreft at JS-kallet bruker navngitte parametre, ikke posisjonelle, slik at rekkefølge ikke spiller noen rolle uansett)

## Komponenter

### `lib/matchingDb.ts`
- **Bugfiks A** (Tier 2, i `searchServicesWithFallback()`): endre
  ```ts
  query: settlement.remainder || params.query,
  ```
  til
  ```ts
  query: settlement.remainder || undefined,
  ```
  slik at et konsumert stedsnavn (tom remainder) gir et rent lokasjons+tag-søk i Drammen, ikke et nytt (og potensielt feilslående) tekstsøk på selve stedsnavnet.
- **Bugfiks B**: `UnanchoredSearchParams` får nytt felt `tags?: string[]`. `searchServicesUnanchored()` sender `p_tags: params.tags && params.tags.length > 0 ? params.tags : null` til RPC-kallet (samme mønster som `searchServices()` allerede bruker for `p_tags`)
- I `searchServicesWithFallback()`: Tier 3-kallet (`searchServicesUnanchored({...})`) utvides til å sende `tags: params.tags`

### `app/resultater/ResultsView.tsx`
- Knappen "📍 Sentrer på kart" → **"📍 Søk her i stedet"**, ny `onClick`-håndtering:
  - Hent `lat`/`lon` fra treffet (som før)
  - Hent et stedsnavn-label: `item.service.city ?? item.service.name` (RankedService) eller `item.city ?? item.name` (UnanchoredService) — kun en visningslabel for toppfanen, påvirker ikke selve søket
  - Kall `setLocation({ label, city: ..., lat, lon, source: 'search', radius: location?.radius ?? 10, bydel: null })` fra `useLocation()`
  - Bygg nye URL-params: behold `cat`, `tags`, `radius`; **fjern** `q`; sett `lat`/`lon`/`location`/`city` til det nye stedet
  - `router.push('/resultater?' + nyeParams)` — full navigasjon, samme mønster som `handleViewToggle`/`toggleTag`
- `focusedCoords`/`FlyToPoint`-mekanismen fra forrige leveranse (`components/ServiceMap.tsx`) **fjernes** — ikke lenger relevant siden knappen nå gjør en reell navigasjon (ny side, nytt kart sentrert via eksisterende `FitBounds`) i stedet for å panorere det eksisterende kartet

## Avhengigheter på tvers av domener
- Bruker må kjøre `sql/27_search_unanchored_tags.sql` før Tier 3-tag-filtrering fungerer i produksjon
- Bugfiks A krever ingen SQL-endring — ren TypeScript-fiks
