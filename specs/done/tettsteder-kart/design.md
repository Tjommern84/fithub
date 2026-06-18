# Tettsteder-lag på /tur-kartet – Teknisk design

## Berørte domener
- 02 Frontpage & Categories (kartside, ikke kategorisystemet)
- 07 Infrastructure & Shared (ny tabell, rate-limited API-rute)

## API-endepunkter
- Ny: `GET /api/settlements?minLon=&minLat=&maxLon=&maxLat=` — nær kopi av `app/api/trails/route.ts`, samme bbox-validering og rate-limit (`isRateLimited('settlements:'+ip, 60, 60_000)`)

## Databaseendringer
Ny migrasjon `sql/25_settlements.sql` (IKKE 24 — reservert av pauset `sok-fallback-kjede`-spec):
- Tabell `settlements`: `id, source ('wikipedia'), source_local_id (tettstedsnummer), name, county, municipality, population, geom geography(Point,4326), created_at`
- GIST-indeks på `geom`
- **Ikke-partiell** unik indeks på `(source, source_local_id)` (samme gotcha som turrute-prosjektet — partiell indeks matcher ikke Supabase sin `upsert(onConflict:...)`)
- RLS: `settlements_public_read` (SELECT-only, ingen write-policy — kun service-role skriver)
- Ny RPC `get_settlements_in_bbox(p_min_lon, p_min_lat, p_max_lon, p_max_lat, p_limit DEFAULT 2000)` — `ST_Intersects`, returnerer `id, name, municipality, population, geojson` (Point-GeoJSON)
- `GRANT EXECUTE ... TO anon, authenticated;` rett etter
- Bruker kjører manuelt i Supabase SQL Editor (standard arbeidsflyt)

## Komponenter

### Steg 1 (FØRST, ingen kode) — verifisering
Backend sjekker og dokumenterer i handoff.md før parser skrives:
- Er tabellstrukturen konsistent over alle ~19 fylkesider?
- Kan samme tettstedsnummer dukke opp på to fylkesider (grensetettsteder)? → avgjør dedup-behov
- Bekreft tolkning av grå/parentes-folketall ("gjelder områder utenfor fylket") — bruk alltid ikke-grå-versjonen
- Bekreft DMS-koordinatformat er konsistent over alle sider

### `scripts/parse-wikipedia-settlements.ts`
- Henter og parser alle ~19 fylkesider. Enkel ikke-streamende parse (triviell filstørrelse vs. turrutenes 477MB GML)
- Radklassifisering: enkel rad vs. aggregatrad ("Tilsammen" — lagre KUN denne, hopp over nestede underområde-rader)
- DMS → desimalgrader, én delt konverteringsfunksjon
- Dedup på tettstedsnummer tvers av sider
- Output: NDJSON `{sourceLocalId, name, county, municipality, population, lon, lat}`

### `scripts/push-wikipedia-settlements.ts`
- Modellert på `scripts/push-geonorge-trails.ts`: samme `.env.local`-loader, `--dry-run`/`--batch=`, idempotent upsert på `(source, source_local_id)`

### `lib/settlementsDb.ts`
- `Settlement`-type: `{id, name, municipality, population, lat, lon}`
- `getSettlementsInBounds(bbox, limit)` — kaller `get_settlements_in_bbox`, parser Point-GeoJSON direkte

### `components/TrailMap.tsx`
- Nytt: `settlements`-state, `showSettlements`-state (default på)
- `handleBoundsChange` fyrer parallelt (ikke-blokkerende) fetch til `/api/settlements` ved siden av `/api/trails`
- Render: `CircleMarker` + `Popup` (navn, kommune, folketall)
- Toggle-checkbox i eksisterende legend-stripe
- Ingen befolkningsterskel/zoom-gate i v1 — legg til kun hvis manuell test viser overbelastning
- `TRAIL_COLORS`, `TRAIL_LABELS`, `Polyline`, bruker-posisjon-markør: **uendret**

## Avhengigheter på tvers av domener
- Steg 1 (verifisering) MÅ være ferdig før parser-scriptet skrives
- Bruker må kjøre `sql/25_settlements.sql` før tettstedslaget gir reelle treff i `/tur`
- Helt frikoblet fra `specs/active/sok-fallback-kjede/` — ingen avhengighet noen vei
