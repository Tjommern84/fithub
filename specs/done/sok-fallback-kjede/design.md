# Søk-fallback-kjede – Teknisk design

## Berørte domener
- 01 Search & Discovery (kjernen i denne featuren)
- 02 Frontpage & Categories (resultatside-UI)

## API-endepunkter
Ingen nye HTTP-endepunkter. To Supabase RPC-funksjoner involvert:
- `search_services()` — **uendret**, kun kalt med andre argumenter i Tier 2 (rekoordinert)
- `search_services_unanchored()` — **ny**, Tier 3

## Databaseendringer
Ny migrasjon `sql/24_search_fallback_tiers.sql` (neste ledige nummer, verifisert — `22_trails.sql` og `23_fix_search_services_overload.sql` finnes allerede):

**Seksjon A — trigger-utvidelse**: `CREATE OR REPLACE FUNCTION public.services_set_search_text()` (samme struktur som `sql/20_function_search_path.sql`), body utvides til å inkludere `city` og `address`:
```sql
NEW.search_text := lower(
  coalesce(NEW.name,'') || ' ' || coalesce(NEW.description,'') || ' ' ||
  coalesce(array_to_string(NEW.tags,' '),'') || ' ' ||
  coalesce(NEW.city,'') || ' ' || coalesce(NEW.address,'')
);
```

**Seksjon B — engangs-backfill** (samme mønster som `sql/11_backfill_tags.sql` "Rebuild search_text"):
```sql
UPDATE services SET search_text = lower(
  coalesce(name,'') || ' ' || coalesce(description,'') || ' ' ||
  coalesce(array_to_string(tags,' '),'') || ' ' ||
  coalesce(city,'') || ' ' || coalesce(address,'')
);
```

**Seksjon C — ny frittstående funksjon `search_services_unanchored`** (Tier 3):
- **Obligatorisk** `DROP FUNCTION IF EXISTS search_services_unanchored(text, double precision, double precision, int);` FØR `CREATE OR REPLACE` (samme regel som forårsaket forrige incident — eksplisitt kommentert i filen)
- Signatur: `p_query text, p_lat double precision DEFAULT NULL, p_lon double precision DEFAULT NULL, p_limit int DEFAULT 20`
- Returnerer: `service_id, name, type, description, city, address, tags, rating_avg, rating_count, price_level, website, phone, email, orgnr, cover_image_url, logo_image_url, lat, lon, distance_km, similarity_score`
- **Ingen join til `service_coverage`** — kun `FROM services s WHERE is_active = true AND search_text % normalized_query`
- `distance_km` = `ST_Distance(base_location, user_point)/1000` hvis koordinater finnes, ellers NULL (ingen dekningssemantikk)
- `ORDER BY similarity(search_text, normalized_query) DESC, distance_km ASC NULLS LAST`
- Samme `#variable_conflict use_column`, `LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public` som `search_services()`
- `GRANT EXECUTE ON FUNCTION search_services_unanchored(text, double precision, double precision, int) TO anon, authenticated;` rett etter

**Filheader-krav**: eksplisitt kommentar øverst i filen: "Denne migrasjonen endrer IKKE `search_services()`. Se `sql/23_fix_search_services_overload.sql` for siste korrekte versjon — skal ikke endres her."

Backend-agent oppretter filen, kjøres manuelt av bruker (se CLAUDE.md-regel).

## Komponenter

### `lib/settlementsDb.ts` — ny eksportert funksjon (OPPDATERT — erstatter opprinnelig `detectCityInQuery` mot 34-by-listen)
```ts
findSettlementInQuery(query: string): Promise<{ name: string; lat: number; lon: number; remainder: string } | null>
```
Tokeniserer søketeksten på whitespace, sjekker hvert ord mot `settlements.name` (case-insensitivt
DB-oppslag — tabellen finnes allerede fra tettsteder-kart-leveransen, ~961+ steder). `remainder` =
original query minus det matchede tokenet. Returnerer `null` hvis ingen token matcher.

**Begrunnelse for byttet**: `settlements`-tabellen har 961+ navngitte steder mot den opprinnelig
planlagte 34-by-listen i `lib/matching.ts` — langt bedre dekning, ingen ny infrastruktur (tabell,
RLS og Supabase-klient-mønster finnes allerede), ingen eksterne API-kall. Viktig presisering fra
research: toppens lokasjonssøk (`/api/geocode`, brukt av `LocationBar.tsx`) er IKKE en erstatning
her — den geokoder en HEL streng som én adresse, mens denne funksjonen må plukke ut ETT stedsnavn
fra en blandet søkestreng som "yoga drammen". Forskjellig oppgave, derfor egen funksjon.

**Avhengighet**: denne funksjonen bygges mot den FERDIGE `settlements`-tabellen — vent på at
backend-agentens pågående arbeid med å utvide tettstedslisten er fullført før implementasjon.

### `lib/matchingDb.ts` — nye typer og funksjoner
- `UnanchoredSearchRow` (rå RPC-rad), `UnanchoredService` (mappet, EGEN type — IKKE gjenbruk av `RankedService`, siden Tier 3-rader mangler ekte deknings-/score-semantikk)
- `FallbackNotice = { tier: 2 | 3; message: string; city?: string } | null`
- `searchServicesUnanchored(params): Promise<UnanchoredService[]>` — tynn RPC-wrapper, samme feilhåndteringsmønster som `searchServices()`
- `searchServicesWithFallback(params: SearchParams): Promise<{ results: RankedService[]; unanchoredResults: UnanchoredService[]; fallbackNotice: FallbackNotice }>`:
  - Ingen `query` → kall `searchServices(params)` direkte, returner umiddelbart (identisk med dagens adferd, ett RPC-kall)
  - Tier 1: kall `searchServices(params)`. Treff → returner umiddelbart, `fallbackNotice: null`
  - Tier 2: 0 treff + `findSettlementInQuery` (i `lib/settlementsDb.ts`) finner et sted → kall `searchServices()` på nytt med rekoordinerte `lat`/`lon`/`city`, `query: remainder || params.query`. Treff → returner med `fallbackNotice: { tier: 2, message: "Fant ingen treff nær deg — viser resultater i {Sted} i stedet", city }`
  - Tier 3: fortsatt 0 treff (eller ingen by funnet) → kall `searchServicesUnanchored()`. Treff → returner med `fallbackNotice: { tier: 3, message: "Disse resultatene ligger utenfor ditt område" }`
  - Alle tre tomme → `{ results: [], unanchoredResults: [], fallbackNotice: null }` (ekte global empty-state)
- `searchServices()` selv **uendret**

### `app/resultater/page.tsx`
- Bytt `searchServices(baseParams)`-kallet til `searchServicesWithFallback(baseParams)`, destrukturer `{ results, unanchoredResults, fallbackNotice }`
- Send `unanchoredResults` og `fallbackNotice` som nye props til `<ResultsView />`
- **Ingen** endring i `baseParams`-bygging, URL-params, eller `LocationContext` — rekoordineringen i Tier 2 er 100% intern i orchestratoren, lekker ikke til lagret lokasjon

### `app/resultater/ResultsView.tsx`
- Nye props: `unanchoredResults?: UnanchoredService[]`, `fallbackNotice?: FallbackNotice`
- `EmptyState`-trigger (linje ~618) utvides: `!hasResults && !hasSessions && (unanchoredResults?.length ?? 0) === 0`
- Ny `FallbackNoticeBanner`-komponent: vises når `fallbackNotice?.tier === 2`, informativ stil (IKKE feil-/rosa-palett), viser `fallbackNotice.message` direkte
- Ny `UnanchoredServiceCard` + egen seksjon ("Andre treff (utenfor ditt område)") for `unanchoredResults`, badge per kort: "📍 Utenfor ditt område — {city}" (nøytral/amber farge, ikke samme stil som `matchReason`-badgen)

### `lib/domain.ts`
- Legg til `city?: string | null;` på `Service`-typen (ved siden av `address`)

## Avhengigheter på tvers av domener
- Backend må opprette og bruker må kjøre `sql/24_search_fallback_tiers.sql` FØR frontend-endringene gir reelle treff i Tier 2/3 i produksjon (samme mønster som forside-kategorier-leveransen)
- Frontend-koden kompilerer og fungerer for Tier 1 (kategori-nettlesing) uavhengig av om migrasjonen er kjørt — kun Tier 2/3-stiene krever den
