# Domene 2 – Forside & Kategorier

## Formål
Håndterer forsiden, kategorinettet, lokasjonspicking og global navigasjon – inngangspunktene der brukeren starter sin reise.

## Filer
| Fil | Rolle |
|-----|-------|
| `app/page.tsx` | Forside – rendrer `CategoryGrid` |
| `app/layout.tsx` | Root layout – fonter, providers, `TopNav`, `Footer` |
| `components/CategoryGrid.tsx` | 5-flis kategorigrid + GPS-lokasjon + Oslo bydel-velger |
| `components/TopNav.tsx` | Toppmeny med `LocationBar` og `AuthButton` |
| `components/LocationBar.tsx` | Stedssøk med Nominatim-autocomplete |
| `components/AuthButton.tsx` | Logg inn/ut-knapp (Supabase auth) |
| `components/Footer.tsx` | Bunntekst |
| `lib/categoryConfig.ts` | 5 kategorier med tags, temafarger og bilder |
| `lib/locationContext.tsx` | React Context for brukerens aktive lokasjon |
| `lib/osloBoroughs.ts` | Oslo bydels-data med koordinater |

## Nøkkelflyter

### Bruker velger kategori
```
Bruker lander på /
  → CategoryGrid rendres med 5 kategorier fra categoryConfig.ts
  → Bruker klikker kategori
  → GPS-lokasjon hentes (eller fallback til Oslo sentrum)
  → Navigerer til /resultater?cat=...&lat=...&lon=...
```

### Lokasjonspicking
```
Bruker skriver sted i LocationBar
  → Nominatim-autocomplete kalles
  → Bruker velger forslag
  → locationContext oppdateres med ny lat/lon
  → Alle søk bruker ny lokasjon
```

### Oslo bydel-valg
```
Bruker velger bydel i CategoryGrid
  → osloBoroughs.ts slår opp koordinater for bydelen
  → locationContext oppdateres
  → Søk avgrenses til bydel
```

## Kritiske gotchas

- **Dynamiske Tailwind-farger**: Kategorifarger fra `categoryConfig.ts` MÅ settes via `style={{ backgroundColor: theme.bg, color: theme.accent }}` — ikke som dynamiske klassestrenger. Tailwind purger klasser som ikke er statisk tilstede i koden.
- **locationContext er global state**: Endringer her påvirker søk overalt i appen. Vær forsiktig med å nullstille verdier — bruk alltid fallback til Oslo sentrum hvis koordinater mangler.
- **GPS-feil håndtering**: Nettleser kan avslå GPS. `CategoryGrid` må alltid ha fallback-koordinater (Oslo sentrum: `lat: 59.9139, lon: 10.7522`).
- **5-flis grid**: `categoryConfig.ts` er hardkodet til 5 kategorier. Grid-layoutet i `CategoryGrid.tsx` antar 5 fliser — endres antallet må CSS også oppdateres.

## Avhengigheter til andre domener
- **Domene 1** – `CategoryGrid` er startpunktet for alle søk, sender params til `/resultater`
- **Domene 5** – `AuthButton` bruker Supabase auth fra bruker-domenet
- **Domene 7** – bruker `supabaseClient.ts` for auth-state, `lib/ui.ts` for Tailwind-konstanter

## Vanlige oppgaver

### Legg til ny kategori
1. Legg til nytt objekt i `lib/categoryConfig.ts` med `id`, `label`, `tags[]`, `theme` (bg + accent) og `image`
2. Oppdater CSS-grid i `CategoryGrid.tsx` (5-flis layout må justeres)
3. Verifiser at temafarger settes via `style={{}}` og ikke som Tailwind-klasser
4. Test GPS-flyt og manuelt lokasjonssøk for ny kategori

### Endre lokasjonssøk (LocationBar)
1. Rediger `components/LocationBar.tsx`
2. Nominatim-kall går via `lib/geocode.ts` (Domene 1) — ikke dupliser geocoding-logikk her
3. Oppdater `locationContext.tsx` hvis nye felt trengs i lokasjons-objektet
4. Test autocomplete-debounce og tastaturnavigasjon

### Legg til ny Oslo-bydel
1. Legg til bydel med koordinater i `lib/osloBoroughs.ts`
2. Test at koordinatene treffer riktig geografisk område i søkeresultatene

### Oppdatere navigasjonen (TopNav)
1. Rediger `components/TopNav.tsx`
2. Globale layout-endringer (fonter, providers) gjøres i `app/layout.tsx`
3. Husk at `TopNav` rendres på alle sider — test alle hovedflyter etter endringer
