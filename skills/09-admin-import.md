# Domene 9 – Admin & Dataimport

## Formål
Håndterer adminpanel for intern drift og alle importskript for innhenting av tjenesteleverandørdata fra eksterne kilder.

## Filer

### Admin-panel
| Fil | Rolle |
|-----|-------|
| `app/admin/page.tsx` | Admin-dashboard – metrikker, invitasjoner, feedback, feil |
| `app/admin/actions.ts` | Server actions for admin-operasjoner |
| `lib/adminHelper.ts` | Admin-rollesjekk via `ADMIN_EMAIL` env-variabel |
| `lib/cacheInvalidation.ts` | Cache-invalidering ved dataupsert |
| `lib/serviceCache.ts` | Redis/in-memory cache for tjenester |

### Importskript (kjøres med `npx tsx scripts/<navn>.ts [--dry-run]`)
| Script | Kilde | Formål | Estimert antall |
|--------|-------|--------|----------------|
| `fetch-feel24.ts` | Feel24 nettside | Treningssentre | ~117 |
| `fetch-sporty.ts` | Sporty.no `__NEXT_DATA__` | Treningssentre | ~99 |
| `fetch-impulse.ts` | WP REST API | Trondheim-sentre | 13 |
| `fetch-mova.ts` | MOVA listeside | Treningssentre | ~90 |
| `fetch-3t.ts` | 3T listeside | Treningssentre | 18 |
| `push-sats.ts` | Manuell | SATS | – |
| `push-evo-missing.ts` | Manuell | EVO-mangler | – |
| `find-gym-locations.ts` | Google Places (Serper) | Kjeder – finn | – |
| `push-gym-locations.ts` | Google Places (Serper) | Kjeder – push | – |
| `find-pt-providers.ts` | Google Places (Serper) | PT-ere – finn | – |
| `push-pt-providers.ts` | Google Places (Serper) | PT-ere – push | – |
| `find-sport-clubs.ts` | Google Places (Serper) | Idrettslag – finn | – |
| `push-sport-clubs.ts` | Google Places (Serper) | Idrettslag – push | – |
| `find-osm-facilities.ts` | OpenStreetMap | Anlegg – finn | – |
| `push-osm-facilities.ts` | OpenStreetMap | Anlegg – push | – |
| `import-brreg.ts` | SSB/BRREG CSV | Org-register | – |
| `geocode-brreg-services.ts` | Nominatim | Koordinater for BRREG | – |

## Nøkkelflyter

### Kjøre import
```
npx tsx scripts/fetch-feel24.ts --dry-run   ← test uten DB-skriving
npx tsx scripts/fetch-feel24.ts             ← faktisk import

Script henter data fra ekstern kilde
  → Normaliserer og mapper til Service-format
  → Upsert til services-tabellen via serviceSupabase.ts
  → cacheInvalidation.ts trigges for oppdaterte tjenester
  → Logging til konsoll (antall opprettet/oppdatert/feilet)
```

### find + push-mønster (Google Places / OSM)
```
find-*.ts:
  → Søker ekstern API etter steder
  → Lagrer rådata til JSON-fil eller midlertidig tabell

push-*.ts:
  → Leser fra JSON/tabell
  → Normaliserer og mapper
  → Upsert til services-tabellen
```

### Cache-invalidering
```
Import kjøres
  → cacheInvalidation.ts kalles med liste over oppdaterte service_id-er
  → serviceCache.ts sletter/oppdaterer cache-innslag
  → Neste søk henter fersk data
```

### Admin-tilgang
```
Bruker navigerer til /admin
  → adminHelper.ts sjekker innlogget brukers e-post mot ADMIN_EMAIL env-var
  → Hvis ikke admin → redirect til forsiden
  → Admin ser metrikker, invitasjoner, feedback og feilogg
```

## Kritiske gotchas

- **Alltid kjør `--dry-run` først**: Alle import-skript støtter `--dry-run`. Kjør alltid dette og verifiser output før faktisk import.
- **`serviceSupabase.ts` i alle skript**: Import-skript bruker service-role-klient for å bypass RLS. Pass på at API-nøkkel ikke leakker — skript kjøres kun lokalt eller i sikre CI/CD-pipelines.
- **Cache-invalidering etter import**: Glem aldri å invalidere cache etter store imports. `serviceCache.ts` kan returnere stale data i timevis uten invalidering.
- **WKT lon-først i alle skript**: Alle skript som setter koordinater MÅ bruke `SRID=4326;POINT(${lon} ${lat})`. Feil rekkefølge gir geografisk feil søkeresultater.
- **City-normalisering i skript**: Bruk `normalizeCity()` fra `lib/matching.ts` (Domene 1) for konsistent by-matching mot `service_coverage`-tabellen.
- **Admin-sjekk er env-basert**: `ADMIN_EMAIL` MÅ settes i produksjonsmiljø. Mangler den, vil ingen ha admin-tilgang.
- **Nominatim rate limit**: `geocode-brreg-services.ts` kaller Nominatim — implementer delay mellom kall (min 1 sek per kall per Nominatim bruksvilkår).

## SQL-migrasjonsrekkefølge (referanse)
```
00_schema.sql           → kjerneskjema
01_postgis_and_search   → søkefunksjon (GRANT etter DROP+CREATE!)
02_rls.sql              → row-level security
03_seed.sql             → testdata
04–11_*.sql             → kolonner, migrasjoner, backfill
12_group_sessions.sql   → gruppeøkter (kjøres i Supabase SQL Editor)
```

## Avhengigheter til andre domener
- **Domene 1** – `normalizeCity()` og `matching.ts`-logikk brukes i geocoding-skript
- **Domene 7** – `serviceSupabase.ts` brukes i alle skript; `domain.ts`-typer for datamapping
- **Domene 6** – admin kan trigge e-post-utsendelse fra adminpanelet

## Vanlige oppgaver

### Kjøre full re-import for én kjede
```bash
npx tsx scripts/fetch-feel24.ts --dry-run   # verifiser
npx tsx scripts/fetch-feel24.ts             # kjør
```
Husk: sjekk at `cacheInvalidation.ts` trigges, og verifiser i Supabase at data ser korrekt ut.

### Legg til nytt importskript
1. Kopier struktur fra eksisterende skript (f.eks. `fetch-feel24.ts`)
2. Implementer datahenting og normalisering
3. Sørg for `--dry-run`-støtte
4. Bruk `serviceSupabase.ts` for DB-skriving
5. Call `cacheInvalidation.ts` etter upsert
6. Dokumenter estimert antall og kilde i denne skill-filen

### Debugging av import som feiler
1. Kjør med `--dry-run` og logg rådata fra ekstern kilde
2. Sjekk om ekstern API/nettside har endret struktur (vanligste årsak)
3. Verifiser at koordinater er lon-først i WKT
4. Sjekk Supabase for constraint-brudd (duplikate navn, manglende påkrevde felt)

### Gi en ny bruker admin-tilgang
1. Sett `ADMIN_EMAIL` i miljøvariabler (eller legg til e-post i admin-sjekk-logikken i `adminHelper.ts` hvis multi-admin støttes)
2. Deploy
3. Bruker navigerer til `/admin` og vil nå ha tilgang
