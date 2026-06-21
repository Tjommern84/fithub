# Homepage-rebrand – Proposal

## Sammendrag
Ny forside før kategorivelgeren: hero, verditilbud, "aktiviteter nær deg", ny header/footer-merkevarestil — første steg i en rebrand til en "nordisk aktivitetsplattform". Resultatsidene redesignes IKKE denne runden.

## Hva
- Ny `HomeHero`, `HomeValueProps`, `HomeNearbyActivities` over eksisterende `CategoryGrid`
- Nye `brand.*`-fargetokens i Tailwind (gjenbruker eksisterende hex fra `categoryConfig.ts`)
- Ny sentrert navigasjon i `TopNav.tsx` (Utforsk aktiviteter/Tilbydere/Magasin/Om oss)
- Restylet `AuthButton`/`Footer` med ny merkevarefarge
- Nye sider: `/om-oss`, `/tilbydere`, `/magasin` (sistnevnte "kommer snart")

## Hvorfor
Forberede FitHub for en bredere retning (fellesskap/oppdagelse, ikke bare tjenestesøk). Se full UI-brief fra bruker i samtalehistorikken/plan-filen.

## Scope
- `tailwind.config.js`, `components/TopNav.tsx`, `components/AuthButton.tsx`, `components/ui/Button.tsx`, `lib/ui.ts`, `components/Footer.tsx`
- Ny `components/home/` (HomeHero, HomeValueProps, HomeNearbyActivities)
- `app/page.tsx`, `app/globals.css`
- Nye `app/om-oss/page.tsx`, `app/tilbydere/page.tsx`, `app/magasin/page.tsx`

## Ikke i scope
- `lib/categoryConfig.ts`, `app/resultater/*`-innhold (resultatside-redesign kommer senere)
- `SearchLocationBar.tsx`/`CategoryGrid.tsx` sin interne logikk (kun CategoryGrid sin posisjon på siden endres, samt h1→h2)
- Favoritter/følg-funksjonalitet (kun visuell placeholder), ekte arrangement-data, mobil hamburgermeny

## Suksesskriterier
- [x] Hero (3-linjers overskrift, riktig undertekst) og verditilbud (riktig fellesskaps-tekst) rendrer korrekt
- [x] Ny hero-søkebar fungerer (tekst/posisjon/kategori → riktig `/resultater`-URL), toppbaren skjult kun på `/`
- [x] `CategoryGrid` uendret og fullt funksjonell, nå lavere på siden, kun én `<h1>` på siden
- [x] Header: sentrert nav (4 lenker) + restylet AuthButton, samme funksjonalitet
- [x] Footer: ny mørk stil bekreftet, alle eksisterende lenker bevart
- [x] Stikkprøve på `/resultater?cat=trene-selv`: header/tag-panel bekreftet uendret
- [x] Mobil: responsive klasser (`flex-col sm:flex-row`, `hidden md:flex`) bekreftet i kode — ikke separat skjermbilde-verifisert av bruker, lav risiko (standard Tailwind-mønster brukt konsekvent ellers i appen)
- [x] `npx tsc --noEmit` OG `npm run build` grønt
- [x] Manglende bilder på "Aktiviteter nær deg"-kort — **bevisst utsatt, ikke en feil**: krever en egen vurdering av hvilke tjenester som mangler `cover_image_url`, utenfor denne spec'ens scope
