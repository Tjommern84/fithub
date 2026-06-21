# Homepage-rebrand – Tasks

## Frontend
- [x] `tailwind.config.js`: ny `brand.*`-fargepalett
- [x] `lib/ui.ts` + `components/ui/Button.tsx`: ny `variant="brand"`
- [x] `components/AuthButton.tsx`: "Bli medlem" → `variant="brand"`, "Logg inn" hover-farge
- [x] `components/TopNav.tsx`: 3-kolonne rad 1 (`grid-cols-[auto_1fr_auto]`), ny sentrert nav (4 lenker, `hidden md:flex`), logo restyle (`font-heading text-brand-forest`). Rad 2 (`SearchLocationBar`, allerede i `Suspense` fra forrige runde) uendret
- [x] `components/Footer.tsx`: fargeinvertering til mørk stil (`bg-brand-forest`, `text-white/70`/`text-white`), struktur/lenker uendret
- [x] Ny `components/home/HomeHero.tsx`
- [x] Ny `components/home/HomeValueProps.tsx`
- [x] Ny `components/home/HomeNearbyActivities.tsx` (client, `searchServices()`, feilhåndtering, tomt-state) — **avgjørelse utover spec-detaljnivå**: brukte eksisterende delte `serviceTypeLabels` fra `lib/resultFilters.ts` i stedet for å importere `TYPE_LABELS` direkte fra `app/resultater/page.tsx` som design.md antydet. Grunn: å importere et navngitt export fra en `page.tsx`-fil inn i en `'use client'`-komponent risikerer å trekke server-only-kode fra hele page.tsx sin modulgraf inn i klient-bundlen — nøyaktig den typen build-only-feil som ble flagget fra forrige runde. `serviceTypeLabels` er allerede bevist trygt importert av andre client-komponenter (`ResultsView.tsx`)
- [x] `app/page.tsx`: ny komposisjon (Hero → ValueProps → NearbyActivities → CategoryGrid)
- [x] `components/CategoryGrid.tsx`: `<h1>` → `<h2>` (kun tag, ingen andre endringer)
- [x] `app/globals.css`: `scroll-behavior: smooth`
- [x] Nye `app/om-oss/page.tsx`, `app/tilbydere/page.tsx`, `app/magasin/page.tsx`
- [x] `npx tsc --noEmit` grønt
- [x] `npm run build` grønt — **ingen** Suspense-relatert feil denne runden (ingen av de nye `home/`-komponentene bruker `useSearchParams()`/`usePathname()`/`useRouter()` — kun `useLocation()`). Alle 485 sider generert, inkl. de 3 nye rutene
- [x] Manuell test (startet dev-server selv siden den ikke kjørte — se note i handoff.md): forsiden har nøyaktig 1 `<h1>` ("Beveg deg mer"), CategoryGrid sin `<h2>` uendret innhold, alle 4 navlenker, verditilbud rendrer, footer mørk bakgrunn bekreftet. Nye sider (`/om-oss`, `/tilbydere`, `/magasin`) returnerer 200. Stikkprøve på `/resultater?cat=trene-selv`: header/tag-panel bekreftet uendret. **Begrensning**: "Aktiviteter nær deg" kan ikke verifiseres i SSR-HTML siden `location` er `null` til klient-hydrering kjører (korrekt og forventet adferd, ikke en feil) — selve kortrendringen med ekte data krever en browser

## Frontend — tillegg etter visuell sammenligning med mockup
- [x] `components/home/HomeHero.tsx`: fikset `<h1>` til 3 linjer ("Oppdag aktiviteter." / "Finn fellesskap." / "Beveg deg mer." i kobber), undertekst tilbake til brief-teksten. Restrukturert slik at `overflow-hidden` kun ligger på bakgrunnsbilde-wrapperen (ikke hele seksjonen) — nødvendig for at den nye søkebaren faktisk kan flyte synlig over grensen mot neste seksjon
- [x] `components/home/HomeValueProps.tsx`: byttet tekst til "Finn aktiviteter / Bli med andre / Følg det du liker" med eksakt kopi fra design.md. Byttet ikoner for de to nye titlene (gruppe-ikon, bjelle-ikon) siden de gamle (graf, pil) ikke matchet det nye fellesskaps-temaet — tittel/beskrivelses-teksten er ordrett som spesifisert
- [x] Ny `components/home/HomeHeroSearchBar.tsx` (`'use client'`): tekstinput (lokal state), "Min posisjon"-knapp (enkel `navigator.geolocation.getCurrentPosition()` — ingen reverse-geocoding/forslagsliste, kun rå koordinater + generisk "Min posisjon"-label), ekte `<select>` fra `CATEGORIES`, dekorativ "Når som helst"-`<span>` (kommentert TODO i koden), sirkulær oransje submit-knapp. Submit bygger `/resultater?q=&cat=&location=&lat=&lon=&radius=` og navigerer med `router.push`; faller gracefully tilbake til kun tilgjengelige params hvis `location` er `null`
- [x] Ny `components/ConditionalSearchBar.tsx`: `usePathname()` + skjuler `SearchLocationBar` kun på `/`. `TopNav.tsx` bytter til å bruke denne i stedet for direkte `<Suspense><SearchLocationBar/></Suspense>` — holder `TopNav.tsx` selv som ren server component
- [x] `npx tsc --noEmit` grønt
- [x] `npm run build` grønt — ingen nye Suspense-relaterte feil (ny `usePathname()`-bruk er isolert til den lille `ConditionalSearchBar`-wrapperen, ikke `TopNav.tsx` selv, akkurat som spesifisert)
- [x] Manuell test mot eksisterende dev-server (port 3000, ikke startet/restartet av meg): hero viser alle 3 linjer + riktig undertekst, verditilbud viser ny tekst, søkebar-segmenter (input/posisjon/kategori/når-som-helst/knapp) bekreftet i markup, `Smart søk`-checkbox (SearchLocationBar) bekreftet **fraværende** på `/` men **present** på `/resultater`. Alle 5 testede ruter stabilt 200 (én transient 404 på `/tilbydere` første gang — reprodusert ikke ved 3 påfølgende forsøk, sannsynligvis dev-serverens Fast Refresh som kolliderte med `npm run build`-kjøringen på samme filsystem akkurat da)

## PM / Avslutning
- [x] Sjekke mot suksesskriterier i proposal.md
- [x] Oppdatere CLAUDE.md
- [x] Arkivere spec til specs/done/
- [x] Oppdatere handoff.md med "feature fullført"
