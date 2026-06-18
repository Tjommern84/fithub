# Samlet søk/lokasjon-felt i toppfanen – Teknisk design

## Berørte domener
- 02 Frontpage & Categories (forsiden, toppfanen)
- 01 Search & Discovery (resultatsiden sin søkejobb flyttes inn i toppfeltet)

## API-endepunkter / databaseendringer
Ingen. Ren frontend-omstrukturering — gjenbruker eksisterende `/api/geocode` og `searchServicesWithFallback()`.

## Komponenter

### Ny: `components/SearchLocationBar.tsx`
Erstatter `components/LocationBar.tsx` i `TopNav.tsx`. Bygger videre på eksisterende `LocationBar`-logikk:

- **`smartSearch: boolean`** state, default `false`, persistert i `localStorage` (egen nøkkel, f.eks. `sdem_smart_search_v1`)
- **Toggle-UI**: liten avhukbar knapp/checkbox ved feltet, tekst "Smart søk", med kort forklarende tooltip
- **`smartSearch === false`** (standard): identisk med dagens `LocationBar.tsx`-oppførsel (geokodings-forslagsliste via `/api/geocode`, `applySuggestion` setter lokasjon direkte) — MINUS Oslo-bydel-`<select>` og "Endre"-knappen
- **`smartSearch === true`**: ingen forslagsliste. Submit sender tekst som `q`-param (samme parameterbygging som dagens `CategoryGrid.handleSearch`/`ResultsView.handleSearchSubmit`) — trigger `searchServicesWithFallback()`
- **Idle-visning** (begge modus): grønn prikk + stednavn + radius. Radius alltid klikkbar (uendret dropdown fra `LocationBar.tsx`). INGEN "Endre"-knapp — selve den kompakte visningen er klikkbar/fokuserbar for å starte redigering
- **GPS-knapp**: portert fra `LocationBar.tsx` (`useGPS`/`reverseGeocode`) — eneste GPS-inngang i appen
- **Default + auto-GPS-prompt**: ved første lasting uten lagret lokasjon — sett `location` til Oslo (`cityCoordinates.oslo` fra `lib/matching.ts`) umiddelbart, og vis samtidig én synlig banner/prompt ("Tillat stedstjenester for å bruke din posisjon i stedet for Oslo"). Godkjenning overskriver Oslo med ekte GPS-posisjon. Dette er det ENE GPS-prompt-systemet i appen (erstatter både `LocationBar`s passive knapp-only og `CategoryGrid`s tidligere separate banner)

### `components/TopNav.tsx`
Bytt `<LocationBar />` → `<SearchLocationBar />`. Resten av layout (to rader) uendret.

### `components/CategoryGrid.tsx`
Fjern: `searchQuery`-state, `handleSearch`, søkefelt-JSX, `geoPrompt`-state, `GEO_PROMPT_KEY`, `handleGeoAccept`/`handleGeoSkip`, banner-JSX. I `doNavigate`: fjern `if (location.bydel) p.set('bydel', ...)`. 8-flis-gridet og `disabled={!location}` uendret (alltid `false` nå siden Oslo er default — fliser er aldri blokkert lenger).

### `app/resultater/ResultsView.tsx`
Fjern: `inputQuery`-state, `handleSearchSubmit`, søkefelt-JSX, "× Fjern søk"-knappen. Fjern `bydel: null` fra `handleSearchHere`s `setLocation(...)`-kall.

### `lib/locationContext.tsx`
Fjern `bydel?: string | null` fra `LocationState`. Ingen migrering nødvendig — gamle `localStorage`-verdier med ekstra `bydel`-nøkkel er harmløse (typen sjekkes kun ved kompilering).

### `app/resultater/page.tsx`
Fjern `rawBorough`-parsing og bydel-tekst i header (bekreftet ren opprydding — fôret kun av kode som fjernes over).

## Avhengigheter på tvers av domener
Ingen — frontend-only, ingen backend-involvering, ingen SQL.
