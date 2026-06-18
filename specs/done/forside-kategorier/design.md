# Forside-kategorier – Teknisk design

## Berørte domener
- 01 Search & Discovery (search_services SQL-funksjon)
- 02 Frontpage & Categories (categoryConfig, CategoryGrid)

## API-endepunkter
Ingen nye endepunkter. `search_services()` RPC utvides med én CASE-gren (se Databaseendringer).

## Databaseendringer
Ny migrasjon `sql/21_add_utendors_category.sql`:
- `CREATE OR REPLACE FUNCTION search_services(...)` — full funksjonskropp kopiert fra `sql/01_postgis_and_search.sql`, med én tillegslinje i CASE-blokken:
  ```sql
  WHEN 'utendors' THEN ARRAY['outdoor']
  ```
- Re-kjør `GRANT EXECUTE ON FUNCTION search_services(...) TO anon, authenticated;` med identisk 15-parameter signatur (kritisk gotcha — uten denne feiler RPC for anon/authenticated).
- Ingen eksisterende rader i `services` endres. Ren additiv endring.
- **Må køres mot Supabase før/sammen med frontend-deploy** — uten denne returnerer `cat=utendors` 0 treff.

## Komponenter
- `lib/categoryConfig.ts`:
  - `MainCategory` union: legg til `'utendors'`
  - `trene-selv.label` → `'Egentrening'`
  - `trene-sammen.label` → `'Gruppetime'`
  - `aktivitet-sport`: `label`→`'Sport'`, `description`→`'Idrettslag og sportsklubber i hele Norge'`, fjern tags Utetrening/Tuftepark/Paraidrett, `images` → alle 3 filer fra `Idrettslag & Sport/` (bytt ut lånt Outdoor-bilde med `pexels-pspov-3046582.webp`)
  - `paraidrett`: behold alt unntatt `images` → 3 filer fra `/bilder/HC/` (`pexels-andrew-mcmurtrie-2303639-3997914.jpg`, `pexels-kampus-6763808.jpg`, `pexels-mikhail-nilov-7697828.jpg`)
  - Ny entry `utendors` (sist i array): label "Utendørs", tags Tuftepark/Utetrening/Fellestimer (plassholder), grønn theme (samme palett som `/tuftepark/[city]`), images fra `/bilder/Outdoor/` (alle 3 filer), `serviceTypes: ['outdoor']`
  - `CATEGORY_LABELS` og `parseMainCategory()` oppdateres tilsvarende
- `components/CategoryGrid.tsx`:
  - `ACCENT`-record: legg til `utendors` (grønn, forskjøvet fra aktivitet-sports emerald/teal)
  - `handleCardClick`: ingen endring (utendors → normal `doNavigate`, paraidrett-redirect uendret)
  - Grid-layout: ingen kodeendring (generisk indeks/lengde-logikk; Utendørs blir nå siste odd-tile som spenner 2 kolonner)
- `lib/resultFilters.ts`: oppdater `categoryLabels`-map (linje 139-144) — IKKE typesikret, må oppdateres manuelt
- `app/tuftepark/[city]/page.tsx`: linje 72 og 228 — endre `cat=aktivitet-sport`/`cat=trene-sammen` lenker til `cat=utendors`. Linje 60 (datahenting) **røres ikke**.

## Avhengigheter på tvers av domener
- Backend må kjøre SQL-migrasjonen (steg 1) FØR frontend-endringene deployes, ellers viser Utendørs-flisen 0 treff i produksjon.
- Frontend-endringene i seg selv er ikke avhengig av at SQL er kjørt for å kompilere/bygge — kun for korrekt funksjonalitet i prod.
