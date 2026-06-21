# Tur-flis på forsiden – Teknisk design

## Berørte domener
- 02 Frontpage & Categories

## API-endepunkter
Ingen. Ren navigasjons-/UI-endring.

## Databaseendringer
Ingen.

## Komponenter — alt i `components/CategoryGrid.tsx`

### `CategoryCard` endres IKKE i logikk/rendering — kun typen for `config.key` utvides
Flisen skal være **visuelt og funksjonelt identisk** med de 7 andre (samme bilde-cycling, hover, touch-swipe, layout). `CategoryCard` bruker internt kun disse feltene fra `config`: `key` (til `ACCENT`-oppslag + dot-indikator-key), `label`, `description`, `tags`, `images`. Den bruker ALDRI `config` til navigasjon — det styres av `onClick`-prop fra kalleren. Det betyr komponenten kan gjenbrukes 1:1 for Tur-flisen uten at selve komponentfilen endres i logikk:

- Utvid kun TypeScript-typen for `config`-prop og `ACCENT`-recordet fra `MainCategory` til `MainCategory | 'tur'` (ren typeannotasjon, ingen runtime-endring, ingen risiko for de 7 eksisterende — de bruker fortsatt eksakt samme `CategoryConfig`-objekter som i dag)
- `lib/categoryConfig.ts`, `MainCategory`, `CATEGORIES`, `parseMainCategory()` røres IKKE — `'tur'` finnes ALDRI i søkekategori-systemet, kun som en lokal, ekstra streng-literal i `CategoryGrid.tsx` sin egen type-union for denne ene komponentbruken

### Ny flise-data (lokal konstant i `CategoryGrid.tsx`, ikke i `categoryConfig.ts`)
```ts
const TUR_TILE = {
  key: 'tur' as const,
  label: 'Turruter',
  description: 'Fotruter, skiløyper og sykkelruter i hele Norge',
  tags: [
    { label: 'Fotrute', value: 'fotrute' },
    { label: 'Skiløype', value: 'skiloype' },
    { label: 'Sykkelrute', value: 'sykkelrute' },
  ],
  images: [
    '/bilder/tur/pexels-424fotograf-169879395-14500356.webp',
    '/bilder/tur/pexels-imagevain-2346018.webp',
    '/bilder/tur/pexels-orlando-s-197680330-11518760.jpg',
    '/bilder/tur/pexels-simon73-29749447.jpg',
  ],
};
```
Lagt til i `ACCENT`-recordet: en `'tur'`-nøkkel med ny accent-farge (forslag: stein/varm grå, distinkt fra alle 7 eksisterende temaer — spesielt fra "Utendørs" sin grønne).

### Grid-rendring og klikk-håndtering
Render `[...CATEGORIES, TUR_TILE].map(...)`. I `handleCardClick`/render-loopen: spesialcase `key === 'tur'` slik at `onClick` blir `() => router.push('/tur')` (rett navigasjon, ingen `doNavigate`/`search_services()`-involvering) og `disabled` alltid er `false` for denne ene flisen — uavhengig av om `location` er satt. Alle 7 andre fliser uendret (`disabled={!location}`, `onClick={() => handleCardClick(cat.key)}`).

Med 8 fliser totalt (jevnt tall) blir `col-span-2`-spesialtilfellet for siste/odd-flis naturlig en no-op — ingen endring nødvendig der.

### Lokasjon og rutevisning på /tur selv
`/tur` (via `TrailMap.tsx`) henter allerede brukerens GPS-posisjon og sentrerer kartet der (med Drammen som fallback) — dette er eksisterende, uendret funksjonalitet. Den klikkbare rutelisten (sortert nærmest-først, med sentrer-og-fremhev-på-klikk) er allerede spesifisert og under bygging i `specs/active/tur-ruteliste/` — denne spec'en (tur-flis-forside) leverer KUN inngangen fra forsiden, ikke noe av kart-/liste-funksjonaliteten selv.

### Bevisst designvalg: Tur-flisen er ALDRI disabled
De 7 søkekategoriene er disabled (grayscale, ikke-klikkbar) til bruker har satt lokasjon, fordi de navigerer til `/resultater` med lat/lon. Tur-flisen omgår dette helt — `/tur` henter sin egen GPS-posisjon uavhengig av forsidens `LocationContext`. Dette betyr Tur-flisen er fargerik og klikkbar fra første rendering, mens de andre 7 er grayscale til lokasjon er satt — bevisst, ikke en bug.

## Avhengigheter på tvers av domener
Ingen — frontend-only, ingen backend-involvering.
