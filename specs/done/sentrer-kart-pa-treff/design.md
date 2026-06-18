# "Sentrer kart på treff" – Teknisk design

## Berørte domener
- 01 Search & Discovery (resultatside)

## API-endepunkter / databaseendringer
Ingen. Rent klientsidig — `lat`/`lon` finnes allerede på `RankedService` og `UnanchoredService`.

## Komponenter

### `components/ServiceMap.tsx`
- Ny prop: `focusedCoords?: { lat: number; lon: number } | null`
- Ny barn-komponent (parallell til eksisterende `FitBounds`, samme `useMap()`-mønster):
  ```tsx
  function FlyToPoint({ coords }: { coords: { lat: number; lon: number } | null }) {
    const map = useMap();
    useEffect(() => {
      if (!coords) return;
      map.flyTo([coords.lat, coords.lon], 15);
    }, [coords, map]);
    return null;
  }
  ```
- Rendres som `<FlyToPoint coords={focusedCoords ?? null} />` ved siden av eksisterende `<FitBounds .../>`
- **Viktig**: dette er en HELT separat effekt fra `FitBounds`. Bruker-markøren og radius-sirkelen
  forblir på sin opprinnelige posisjon — kun selve kamera-viewporten flyttes. Ingen endring i
  `FitBounds`, `Circle`, eller bruker-`Marker`

### `app/resultater/ResultsView.tsx`
- Ny lokal state: `const [focusedCoords, setFocusedCoords] = useState<{lat:number;lon:number}|null>(null)`
- Send `focusedCoords={focusedCoords}` til `<ServiceMap />`
- Ny knapp på `ServiceCard` (nær "Se full profil →"-lenken, samme border-top-footer-rad) og
  `UnanchoredServiceCard` (samme plassering) — krever at begge komponentene får en ny prop,
  f.eks. `onCenterMap: (coords: {lat:number;lon:number}) => void`, sendt ned fra `ResultsView`
- Knappetekst: **"📍 Sentrer på kart"** (gjenbruker 📍-emojien fra adresselinjen for konsistens),
  `title`-attributt: "Sentrer kartet på dette stedet" (for skjermlesere/tooltip)
- Vises kun når `item.lat != null && item.lon != null` (samme guard som kartmarkørene allerede bruker)
- `onClick`: kaller `onCenterMap({lat: item.lat, lon: item.lon})` → setter `focusedCoords` i
  `ResultsView`. Hvis `view !== 'map'` (mobil-toggle, lest fra URL-param) → kall også
  `handleViewToggle('map')` i samme klikk, slik at brukeren faktisk ser kartet

## Avhengigheter på tvers av domener
Ingen — frontend-only, ingen backend-involvering.
