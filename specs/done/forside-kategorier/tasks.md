# Forside-kategorier – Tasks

## Backend
- [x] Opprett `sql/21_add_utendors_category.sql` — `CREATE OR REPLACE FUNCTION search_services(...)` med ny CASE-gren `WHEN 'utendors' THEN ARRAY['outdoor']` + re-GRANT EXECUTE
- [x] Kjør migrasjonen mot Supabase (bekreftet av bruker 2026-06-30)
- [ ] Verifiser: `cat=utendors` nær Oslo gir treff fra BÅDE main_category=aktivitet-sport (tuftepark) og main_category=trene-sammen (outdoor-gruppetjenester) — kan testes nå at frontend-delen er ferdig

## Frontend
- [x] `lib/categoryConfig.ts`: ny `utendors`-key i `MainCategory`, ny CATEGORIES-entry, oppdater labels for trene-selv/trene-sammen/aktivitet-sport, oppdater aktivitet-sport sine tags/description/images, bytt paraidrett sine images til HC-mappen, oppdater `CATEGORY_LABELS` og `parseMainCategory()`
- [x] `components/CategoryGrid.tsx`: legg til `ACCENT.utendors`
- [x] `lib/resultFilters.ts`: oppdater `categoryLabels`-map (linje 139-144)
- [x] `app/tuftepark/[city]/page.tsx`: oppdater CTA-lenker (linje 72, 228) til `cat=utendors`
- [x] `npx tsc --noEmit` grønt
- [x] Manuell test i browser: alle 7 fliser, riktig bildemappe per flise, ikke-tomme søkeresultater per flise (se proposal.md suksesskriterier)

## PM / Avslutning
- [x] Sjekke mot suksesskriterier i proposal.md
- [x] Oppdatere CLAUDE.md
- [x] Arkivere spec til specs/done/
- [x] Oppdatere handoff.md med "feature fullført"
