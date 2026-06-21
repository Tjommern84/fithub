# Homepage-rebrand – Teknisk design

Full design er allerede detaljert i plan-filen fra planleggingen — gjengitt her for spec-sporbarhet.

## Berørte domener
- 02 Frontpage & Categories (forsiden, header/footer)

## Databaseendringer
Ingen. "Aktiviteter nær deg" gjenbruker eksisterende `searchServices()`/`search_services()` uendret.

## Steg 1 — `tailwind.config.js`
Ny `brand`-palett i `theme.extend.colors`: `forest:#0A1A0E`, `forestLight:#163322` (ny), `copper:#D4872A`, `copperHover:#B86F1E` (ny), `beige:#f7f4ef`, `cream:#F5EFE3` (ny). Ikke rør `lib/categoryConfig.ts`.

## Steg 2 — `components/TopNav.tsx`
Rad 1: `grid grid-cols-[auto_1fr_auto]` (logo | sentrert nav | AuthButton). Ny `<nav className="hidden md:flex gap-6">`: Utforsk aktiviteter→`/resultater`, Tilbydere→`/tilbydere`, Magasin→`/magasin`, Om oss→`/om-oss`. Logo: `font-heading text-brand-forest`. Header-bakgrunn forblir lys (`bg-white/80 backdrop-blur`). Rad 2 (`SearchLocationBar`) uendret.

## Steg 3 — `components/ui/Button.tsx` + `lib/ui.ts` + `components/AuthButton.tsx`
Ny `variant="brand"` på Button (ny `buttonBrand`-konstant i `lib/ui.ts`, struktur som `buttonPrimary` men `bg-brand-copper hover:bg-brand-copperHover`). "Bli medlem" → `variant="brand"`. "Logg inn" → kun `hover:text-brand-forest`. Ingen logikkendring.

## Steg 4 — `components/Footer.tsx`
Fargeinvertering: `bg-white`→`bg-brand-forest`, `text-slate-*`→`text-white/70`/`text-white`. Struktur/lenker/innhold uendret.

## Steg 5 — `app/page.tsx` + ny `components/home/`
```
<main className="bg-brand-beige">
  <script ...websiteLd />
  <HomeHero />
  <HomeValueProps id="hvordan-funker-det" />
  <HomeNearbyActivities />
  <CategoryGrid />
</main>
```
`CategoryGrid.tsx` sin `<h1>` → `<h2>` (kun tag, ikke klasser/innhold) — Hero får sidens eneste `<h1>`.

### `HomeHero.tsx` (server component)
Fullbredde naturbilde (`public/bilder/Outdoor/` eller `tur/`), forest-tonet gradient, `<h1>` med "Beveg deg mer" i `text-brand-copper`, undertekst, to CTA-er ("Utforsk aktiviteter"→`/resultater` som `variant="brand"`-knapp, "Se hvordan Fithub fungerer"→`#hvordan-funker-det` anker). Ingen duplisert søkefelt — `SearchLocationBar` lever kun i TopNav.

### `HomeValueProps.tsx` (server component)
`<section id="hvordan-funker-det">`, 3-kolonne grid, håndrullede inline SVG-ikoner (ingen ny ikon-pakke).

### `HomeNearbyActivities.tsx` (`'use client'`)
`useLocation()` → `useEffect` → `searchServices({lat,lon,sort:'nearest',limit:10})`. Håndter: `location===null` (skeleton/ingenting), feil (try/catch, vis feilmelding — `searchServices()` kaster i dag), 0 treff (`return null`). Horisontal scroll, kort: bilde/avstand/type-tag (del `TYPE_LABELS` fra `app/resultater/page.tsx`)/navn/rating+pris. Hjerte-ikon: lokal `useState`, ingen backend (kommentert som placeholder). Kort-klikk: sjekk om en tjeneste-detaljside finnes før lenkemål bestemmes.

## Steg 6 — Nye sider
`app/om-oss/page.tsx`, `app/tilbydere/page.tsx` (kun `mailto:`-CTA, ingen ny form), `app/magasin/page.tsx` ("kommer snart"). Samme mønster som `app/vilkar/page.tsx`/`app/kontakt/page.tsx`.

## Steg 7 — `app/globals.css`
Én linje: `html { scroll-behavior: smooth; }`

## Avhengigheter på tvers av domener
Ingen — frontend-only.

---

## Tillegg etter visuell sammenligning med mockup (2026-06-19)

Bruker sammenlignet faktisk resultat mot en mockup og fant tre avvik å rette nå (et fjerde — manglende bilder på aktivitetskort — er bevisst utelatt denne runden):

### A. `components/home/HomeHero.tsx` — overskrift/undertekst-fiks
`<h1>` skal være tre linjer, ikke kun "Beveg deg mer":
```
Oppdag aktiviteter.
Finn fellesskap.
<span className="text-brand-copper">Beveg deg mer.</span>
```
Undertekst tilbake til opprinnelig brief-tekst: "Fithub er Norges aktivitetsplattform for alle aldre og nivåer – ute og inne."

### B. `components/home/HomeValueProps.tsx` — tekst-fiks
Bytt tilbake til opprinnelig fellesskaps-vinkling fra brief'en (IKKE den nåværende "Søk og finn/Sammenlign/Kom i gang"):
- **Finn aktiviteter** — "Oppdag alt som skjer nær deg – fra trening og kurs til turer og friluftsliv."
- **Bli med andre** — "Finn folk å være aktiv sammen med, eller opprett din egen aktivitet."
- **Følg det du liker** — "Få varsler om nye timer, arrangementer og tilbud som passer for deg."

### C. Ny, fremtredende søkebar i hero
Ny seksjon nederst i `HomeHero.tsx` (eller egen underkomponent kalt derfra) — hvit, pille-formet, segmentert søkekomponent som visuelt overlapper grensen mellom hero og verditilbud (negativ bunn-margin på wrapperen, f.eks. `-mb-8 sm:-mb-10`, slik at den "flyter" over kanten som i mockupen).

Segmenter:
1. **Tekstinput** "Søk aktivitet, sted eller tilbyder" — fritekst, lokal state
2. **"Min posisjon"** — viser `location.label` fra `useLocation()` hvis satt, ellers "Velg posisjon". Klikk trigger en enkel, frittstående geolocation-forespørsel (IKKE full adresse-geokoding/forslagsliste — det er allerede `SearchLocationBar`s jobb, ikke duplisert her)
3. **"Alle aktiviteter"** — ekte `<select>` populert fra `CATEGORIES` (`lib/categoryConfig.ts`), setter `cat`-param ved submit
4. **"Når som helst"** — **bevisst dekorativ/ikke-funksjonell placeholder** denne runden (ingen dato-filtrering finnes i `search_services()`). Kommenter eksplisitt i koden som TODO for fremtidig fase
5. Sirkulær oransje søkeknapp — submit

Submit bygger `/resultater?q=...&cat=...&location=...&lat=...&lon=...` (samme parametermønster som resten av appen) og navigerer med `router.push`. Hvis verken tekst eller kategori er valgt: naviger med kun lokasjon (generell utforsking).

`'use client'`-komponent. Leser `useLocation()` for posisjon-segmentet og for å feste lat/lon til navigasjonen.

### D. Skjul `SearchLocationBar` (toppmeny) KUN på forsiden
Siden den nye hero-søkebaren tar over jobben på forsiden, skal den eksisterende `SearchLocationBar` i `TopNav.tsx` ikke vises der — for å unngå to synlige søkefelt stablet på samme side. Alle andre sider (inkl. `/resultater`) er uendret.

Implementasjon: ny liten klient-komponent `components/ConditionalSearchBar.tsx` som bruker `usePathname()` og rendrer `<Suspense><SearchLocationBar/></Suspense>` med mindre `pathname === '/'`. `TopNav.tsx` bytter til å rendre denne i stedet for direkte `<Suspense><SearchLocationBar/></Suspense>` — holder `TopNav.tsx` selv som server component, isolerer `usePathname()`-avhengigheten til den nye, lille wrapperen.
