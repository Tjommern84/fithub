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

## Tillegg 2 (2026-06-22): koblings-basert gruppering for resterende ~30%

**Undersøkt og avkreftet**: bruker foreslo å hente hele ruten via Geonorge sitt nedlastingsAPI i
stedet for den fragmenterte dataen vi har. Avkreftet empirisk — `scripts/parse-geonorge-trails.ts`
bekrefter at hver `<Fotrute>`/`<Sykkelrute>`/`<Skiløype>`-GML-feature ALLEREDE er et eget, komplett
element med eget `rutenavn` — dette ER Turrutebasen sin offisielle datamodell (et nettverk av
navngitte kant-segmenter), ikke noe nedlastingsAPI-et ville gitt en alternativ, sammenslått versjon
av. Ingen ny import-kilde løser problemet.

**Rotårsak for de resterende ~30%, bekreftet empirisk** (node-script mot ekte data, 1000 segmenter
i et Oslo-område): blant 1092 par segmenter som FAKTISK deler et endepunkt (samme `trail_type`,
fysisk sammenhengende) har 281 par (~26%) helt forskjellig `name` — sannsynlig årsak er at
Turrutebasen samles inn kommune for kommune, og en rute som krysser en kommunegrense kan ha fått
ulikt `rutenavn` på hver side. Case/diakritikk-varianter (f.eks. "Årvollåsen" vs "ÅRvollåsen")
finnes også, men er sjeldne (1-2 per 1000) — ikke hovedårsaken.

**Bekreftet av bruker med et konkret eksempel**: rundt Jarmyra (Jar, Bærum) er en rute delt opp i
mange "Ukjent"-navngitte segmenter — disse er i dag BEVISST utelatt fra all gruppering (egen
`id::${trail.id}`-fallback-nøkkel for `name === 'Ukjent'`). Bruker observerte samme fysiske
sammenheng visuelt og foreslo selv koblings-basert kjeding.

**Fiks — koblings-basert kjeding, lagt PÅ TOPP av eksisterende navne-gruppering:**
- Etter at de eksisterende navne-baserte gruppene er bygget (uendret), kjør et nytt kjede-pass:
  to grupper av SAMME `trailType` slås sammen hvis et segment i gruppe A deler et endepunkt
  (innenfor ~30 m, ekte meter-avstand via Leaflet `distanceTo`, ikke naiv grad-avstand) med et
  segment i gruppe B — uavhengig av om navnene matcher, og uavhengig av om ett/begge er "Ukjent".
- **Sikkerhetsregel mot feil sammenslåing ved ekte kryss**: kjed KUN sammen hvis nøyaktig TO
  segmenter (fra to forskjellige navnegrupper) møtes i det punktet. Hvis ≥3 segmenter fra
  forskjellige navnegrupper møtes samme sted, er det sannsynligvis et reelt trekryss i en
  marka/nettverk — IKKE slå sammen der. Bevisst konservativt: bedre å la noen ekte fortsettelser
  stå ugruppert enn å slå sammen faktisk forskjellige ruter.
- **Representativt navn for en kjedet gruppe**: navnet til den STØRSTE konstituerende
  navne-undergruppen (flest segmenter). Hvis kjeden inkluderer "Ukjent"-segmenter sammen med
  navngitte: bruk det ekte navnet (ikke "Ukjent") så lenge minst én undergruppe har et ekte navn.
  Kun hvis HELE kjeden er "Ukjent" forblir gruppen "Ukjent" — fortsatt én rad i stedet for mange.
- Ytelse: bruk et rutenett/bucket-oppslag på avrundede koordinater for endepunkt-matching, ikke en
  naiv O(n²)-løkke over alle segmentpar — viewport er begrenset til typisk noen hundre–~2000
  segmenter (samme PostgREST-cap som alltid), men en ren dobbel-løkke bør likevel unngås.
- `fitBounds`/summert lengde/avstand utvides til å dekke ALLE segmenter i den ferdig kjedede
  gruppen (samme mønster som eksisterende navne-gruppering, bare over et større sammenslått sett).
- `selectedGroupKey` må være stabil for en sammenslått gruppe (deterministisk uavhengig av
  beregningsrekkefølge — f.eks. sortert kombinasjon av de underliggende navne-grupperingsnøklene).

**Ikke i scope**: kildedata/import-endring (uendret fra Tillegg 1), 100% perfekt gruppering (den
konservative "kun-to-møtes"-regelen lar noen ekte edge-cases stå ugruppert, akseptert bevisst).

**Verifiseringsnotat**: "Gulskgen – Konnerudkollen" (det opprinnelige eksempelet fra Tillegg 1) er
ALLEREDE korrekt gruppert i dagens kode (bekreftet: alle 24 segmenter har identisk navn+type) —
IKKE testpunkt for denne fiksen. Bruk Jarmyra-området (Jar, Bærum, ca. 59.91°N/10.54°E) i stedet.

## Tillegg 3 (2026-06-22): skjul korte ruter (<1 km)

**Bakgrunn**: etter Tillegg 2 (koblings-basert kjeding) klaget bruker over et rotete kart — mange
korte, separate Geonorge-snutter visuelt oppå hverandre gjør det vanskelig å finne en lang,
nylig importert UT.no-rute i samme område.

**Fiks**: ny `hideShortTrails`-checkbox (default PÅ/skjult) i samme legend-rad som
type-/Tettsteder-toggles. Filtrerer `chainedVisible.groups` på `totalLengthKm` (SAMLET lengde
etter kjeding, ikke enkeltsegmenter — en lang rute bygget av mange korte segmenter, f.eks.
"Gulskgen - Konnerudkollen", skal ikke brytes opp eller skjules siden den totalt er over 1 km).
`totalLengthKm === null` (ingen segmenter i gruppen har lengdedata i kildedata) vises uansett —
usikker lengde er ikke det samme som bekreftet kort. Samme filtrerte sett (`keptTrailIds`) brukes
til både Polyline-rendering og listepanelet.

**Verifisert mot ekte data**: "Gulskgen - Konnerudkollen" (35 segmenter, 3,81 km) og begge
UT.no-rutene (8,73 km / 13,74 km) forblir synlige. I en testbbox ved Konnerud ville 160 av 202
grupper (under 1 km) blitt skjult — betydelig opprydding.

## Separat, lavere prioritet (egen oppgave senere, IKKE i denne rundens scope)
"Aktiviteter nær deg" på forsiden (`components/home/HomeNearbyActivities.tsx`, bruker
`getNearestTrails()`/`get_nearest_trails()`-RPC fra `lavterskel-naer-deg`-spec'en) viser samme
turrute-navn flere ganger som separate kort — bekreftet av bruker med skjermbilde
("Gulskgen – Konnerudkollen" ×3). Denne koden har ALDRI hatt gruppering bygget inn. Lagt i kø.
