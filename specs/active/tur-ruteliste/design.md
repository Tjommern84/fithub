# Klikkbar ruteliste på /tur – Teknisk design

## Berørte domener
- 02 Frontpage & Categories (kartside — ikke kategorisystemet)

## API-endepunkter
Ingen nye. Bruker eksisterende `/api/trails` (allerede viewport-hentet via `handleBoundsChange`).

## Databaseendringer
Ingen. Bevisst — unngår enhver risiko for ny SQL-signaturkollisjon (se CLAUDE.md-gotcha om `search_services()`-incidenten). Avstandsberegning gjøres klientsidig.

## Komponenter — alt i `components/TrailMap.tsx`

### Nye state-variabler
- `visibleTypes: Record<TrailType, boolean>` — alle `true` initialt. Eneste sannhetskilde for both kart-linjer og liste.
- `selectedTrailId: string | null`

### Avledet data (useMemo)
- `visibleTrails` — `trails.filter(t => visibleTypes[t.trailType])`, brukes av BÅDE Polyline-loopen og listen
- `sortedTrailList` — for hver rute i `visibleTrails`: minste `L.latLng(center).distanceTo(...)` over alle punkter i `trail.coordinates` (Leaflets innebygde metode, ingen ny avhengighet), sortert stigende
- `selectedTrail` — slått opp fra full `trails`-array via `selectedTrailId`

### Kart-sentrering ved valg — `SelectionWatcher`-komponent
Ny intern komponent, parallell til eksisterende `BoundsWatcher`: `useMap()` + `useEffect` som kaller `map.fitBounds(L.latLngBounds(trail.coordinates), { maxZoom: 16 })` når valgt rute endres. Rendres som barn av `MapContainer`, samme mønster som `BoundsWatcher` — ingen ref-håndtering av kartinstansen i parent.

### Fremheving — Polyline-rendering
- Ingen valgt: uendret (`weight: 3, opacity: 0.8`)
- Valgt rute: `weight: 6, opacity: 1`
- Andre ruter når noe er valgt: `weight: 3, opacity: 0.4`
- Eksisterende `Popup` i hver `Polyline` røres ikke
- Valgfritt (kan droppes uten at noe brekker): `eventHandlers={{ click: () => setSelectedTrailId(trail.id) }}` for å gjøre linjeklikk på kartet konsistent med listevalg

### Infoboks
Egen `<div>` over listepanelet (IKKE absolutt-posisjonert oppå kartet — unngår z-index-konflikt med Leaflet-kontroller), vises kun når `selectedTrail !== null`. Gjenbruker eksakt samme felter som dagens Popup (navn, type, vedlikeholder, lengde). Valgfri lukk-knapp som nullstiller `selectedTrailId`.

### Type-toggles
Erstatt den statiske legend-loopen med checkboxes, identisk mønster som dagens `showSettlements`-toggle — én per `TrailType`.

### Listepanel-layout
- Wrapper: `flex flex-col lg:flex-row gap-4`
- Kart-div: eksisterende klasser + `lg:flex-1`
- Liste-div: `w-full lg:w-80 lg:shrink-0`, scrollbar med `max-height: 560` (matcher kartets høyde)
- Listeelement: `<button>` (ikke `div` — tastaturtilgjengelighet), viser fargeprikk + navn + type + lengde + avstand. Valgt: `bg-slate-100`. Avstandsformat: `< 1 km` under 1000m, ellers `.toFixed(1)} km` (matcher eksisterende konvensjon i `ResultsView.tsx`, IKKE komma-desimal)

### Tomme tilstander
- Ingen ruter i viewport: "Ingen ruter i dette området."
- Alle typer skjult: "Alle rutetyper er skjult — slå på en type for å se ruter."

## Avhengigheter på tvers av domener
Ingen — frontend-only, ingen backend-involvering, ingen blokkerende SQL-steg.

---

## Tillegg etter visuell test (2026-06-18): gruppering av rutesegmenter

**Funn**: Geonorge sin Turrutebase deler hver rute i mange korte segmenter mellom kryss/knutepunkter
— hvert segment er en egen rad i `trails` (egen `id`, egne `coordinates`), men deler samme `name`
(`rutenavn` fra kildedata, satt i `scripts/parse-geonorge-trails.ts` linje 169). På kartet smelter
segmentene visuelt sammen (samme farge, ingen synlig skjøt), men i en flat liste blir hvert segment
sin egen rad — f.eks. "Gulskgen – Konnerudkollen" gjentatt 7+ ganger med ulik (liten) avstand/lengde.//
**Dette er en egenskap i kildedataene, ikke en bug i grupperings-/sorteringslogikken som ble bygget.**

**Fiks — gruppering i listen, IKKE i SQL/data:**
- Grupper `visibleTrails` på `(name, trailType)` (kun når `name` er satt og ikke-tom — usignerte
  "Ukjent rute"-segmenter grupperes IKKE, siden de sannsynligvis er urelaterte og en feilaktig
  sammenslåing der er verre enn ingen sammenslåing)
- Gruppe-representant: `name`, `trailType`, `maintainer` (fra første segment — anta konsistent
  innad i en gruppe), `totalLengthKm` (sum av `lengthKm` over alle segmenter i gruppen, `null`
  behandlet som 0 i summen), `distanceMeters` (minimum over ALLE segmenters nærmeste punkt til
  brukerens posisjon — ikke bare første segment)
- Gruppe-nøkkel (for `key`/seleksjon): `${trailType}::${name}` — stabil streng, ikke en `id`
- **Seleksjon endres fra "valgt rute-id" til "valgt gruppe-nøkkel"**: `selectedGroupKey: string | null`
  i stedet for `selectedTrailId`. Highlight-logikken i Polyline-loopen sjekker om
  `${trail.trailType}::${trail.name}` matcher `selectedGroupKey` — alle segmenter i gruppen
  fremheves samtidig, ikke bare ett
- `SelectionWatcher`/`fitBounds` må nå ta bounds over ALLE segmentenes `coordinates` i den valgte
  gruppen (union av punkter), ikke bare ett segments — bruk `L.latLngBounds([])` og `extend()` for
  hvert segments koordinater, eller flat-map alle koordinater før `latLngBounds(...)`
- Infoboksen viser gruppens summerte `totalLengthKm`, ikke ett enkelt segments lengde

**Ikke i scope for denne fiksen**: å endre kildedataene eller importskriptene (`sql/22_trails.sql`,
`scripts/parse-geonorge-trails.ts`, `scripts/push-geonorge-trails.ts`) til å slå sammen segmenter i
databasen — det er en mye større endring (krever geometrisk sammenslåing av LineStrings) og gir ingen
ekstra verdi utover det klientsidig gruppering allerede løser for listevisningen.
