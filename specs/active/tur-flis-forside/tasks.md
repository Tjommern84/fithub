# Tur-flis på forsiden – Tasks

## Frontend
- [x] `components/CategoryGrid.tsx`: legg til `TUR_TILE`-konstant (key/label/description/tags/images), bilder fra `public/bilder/tur/`
- [x] Utvid `ACCENT`-recordets type fra `Record<MainCategory,...>` til `Record<MainCategory | 'tur',...>`, legg til `'tur'`-entry (ny accent-farge, distinkt fra de 7 andre)
- [x] `CategoryCard`-komponenten selv: ingen endring i logikk/rendering — kun `config`-proppens type utvides til å akseptere `key: MainCategory | 'tur'` (ny lokal `CardConfig`-type, `Pick<CategoryConfig,...> & {key}`)
- [x] Render `[...CATEGORIES, TUR_TILE].map(...)` i grid-loopen
- [x] Spesialcase i klikk-/disabled-håndtering: `key === 'tur'` → `onClick={() => router.push('/tur')}`, `disabled={false}` alltid. Alle 7 andre uendret
- [x] Bekreft `lib/categoryConfig.ts`, `MainCategory`, `CATEGORIES`, `parseMainCategory()` er IKKE rørt — bekreftet 0 forekomster av `'tur'` i filen
- [x] **Ikke i opprinnelig spec, funnet under egen verifisering**: 2 av 4 bilder i `public/bilder/tur/` var JPG i full kameraoppløsning (2.4MB/1.4MB) — samme mønster som tidligere HC-mappe-funn. Kjørte `scripts/resize-images.ts`, konvertert til WebP (128KB/75KB), oppdatert filendelser i `TUR_TILE.images`
- [x] `npx tsc --noEmit` grønt
- [x] Manuell test: 8 fliser bekreftet i HTML (alle labels inkl. "Turruter"), Tur-bildesti verifisert. Disabled-attributt sjekket programmatisk per flise uten lokasjon satt: alle 7 søkekategorier `disabled:true`, Turruter `disabled:false`. **Begrensning**: bilde-cycling/hover/touch-swipe er uendret kode (samme `CategoryCard`), men selve den visuelle animasjonen krever browser — ikke verifiserbar av agent via curl

## PM / Avslutning
- [ ] Sjekke mot suksesskriterier i proposal.md
- [ ] Oppdatere CLAUDE.md
- [ ] Arkivere spec til specs/done/
- [ ] Oppdatere handoff.md med "feature fullført"
