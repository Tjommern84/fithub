# FitHub – Handoff

> Delt tavle mellom alle agenter. Oppdateres etter hvert fullført arbeid.
> PM-agenten leser denne for å forstå status. Coding-agenter oppdaterer den når de er ferdige.

---

## Siste oppdateringer

### Backend
*(ingen endringer registrert ennå)*

### Frontend
*(ingen endringer registrert ennå)*

---

## Neste steg

| Agent | Oppgave | Blokkert av |
|-------|---------|-------------|
| *(senere)* | tur-ruteliste: ~70% av flersegment-ruter grupperes korrekt nå, men noen kjente ruter grupperes fortsatt ikke riktig — bruker vil komme tilbake til dette. Spec'en forblir i specs/active/ | — |
| Frontend | Vis byer distinkt på `/tur`-kartet (egen markørstil + legend-toggle "Vis kun byer"), `lib/settlementsDb.ts` får `isCity`-felt | — |
| *(utsatt)* | `app/dashboard/services/[id]/edit/page.tsx` kan ha samme id-encoding-bug som ble fikset i `anlegg-uten-tilbyder` (params.id i en client component, annen kontekst, ikke verifisert) — relevant for tilbydere med æøå i egen tjeneste-ID | — |
| PM | **Ikke avklart**: er det bekreftet at "Aktiviteter nær deg" og kategori-flisene faktisk får en lokasjon på en helt fersk `/`-last, nå som `SearchLocationBar` (som tidligere satte Oslo-standard) er skjult der via `ConditionalSearchBar`? Ikke rapportert som et problem i praksis, men aldri eksplisitt bekreftet løst — verifiser ved behov | — |
| *(valgfritt)* | sok-fallback-kjede: en ekte Tier 2-banner (søk på "yoga [bynavn]" der lokal dekning faktisk finnes) er aldri visuelt observert pga. tilgjengelig testdata — prøv selv om du vil se det live | — |

---

## Aktiv feature

*(ingen feature pågår — se specs/active/ for å starte en)*

---

## API-kontrakter (gjeldende)

> Oppdateres av backend-agenten når endepunkter endres. Frontend-agenten leser dette før implementasjon.

*(ingen kontrakter registrert ennå)*

---

## Modell-endringer (gjeldende)

> Oppdateres av backend-agenten når databaseskjema eller TypeScript-typer endres.

*(ingen endringer registrert ennå)*

---

## Komponent-endringer (gjeldende)

> Oppdateres av frontend-agenten når komponenter endres på en måte som kan påvirke andre.

*(ingen endringer registrert ennå)*

---

## Historikk

> Fullførte handoffs arkiveres her (nyeste øverst).

### Feature fullført: illustrasjoner-og-rapporter (2026-06-21)
- Navnebasert ikon-gjenkjenning (`lib/serviceIllustrations.tsx`, 12 idretter + type-fallback) for
  tjenestekort uten `cover_image_url`. "Rapporter feil"-knapp (`ReportIssueModal.tsx`) på
  `/resultater`-kort + tilbyderside, ny `services.reported_at` + `service_reports` (`sql/30`,
  kjørt av bruker 2026-06-21), `search_services()` filtrerer på `reported_at IS NULL`
- Reell bug funnet og fikset under verifisering: rapporter-lenken på profilsiden var feilaktig
  skjult for tjenester uten kontaktfelt
- **Se CLAUDE.md-gotcha**: umiddelbar skjuling ved første rapport er en bevisst forenkling som
  må revurderes før launch (misbrukspotensial)
- Spec arkivert til `specs/done/illustrasjoner-og-rapporter/`

### Feature fullført: anlegg-uten-tilbyder (2026-06-20)
- Ny `provider_type` skiller anlegg fra bedrifter. Fant og fikset en større id-encoding-bug under
  Steg 0 (41% av anleggs-ID-er affisert av at Next.js ikke dekoder ikke-ASCII path-segmenter) —
  se egen gotcha i CLAUDE.md. `orgnr` lagres bevisst ikke for anlegg (UNIQUE-constraint-konflikt)
- Migrasjonene `sql/28_provider_type.sql` + `sql/29_search_services_provider_type.sql` kjørt av
  bruker 2026-06-20
- Spec arkivert til `specs/done/anlegg-uten-tilbyder/`

### Feature fullført: homepage-rebrand (2026-06-19/20)
- Ny forside-komposisjon (Hero/Verditilbud/Aktiviteter nær deg/CategoryGrid), nye brand-fargetokens,
  ny stor søkebar i hero, nye sider /om-oss /tilbydere /magasin
- Driftslærdom: `npm run build` samtidig med aktiv `npm run dev` korrumperer `.next` — se
  feedback-memory om dev-server-koordinering mellom PM og kodeagenter
- Spec arkivert til `specs/done/homepage-rebrand/`

### Feature fullført: samlet søk/lokasjon-felt (2026-06-19)
- `SearchLocationBar` erstatter `LocationBar` + to embedded søkefelt. "Smart søk"-veksling,
  Oslo-standard + GPS-prompt, Oslo-bydel fjernet helt
- Spec arkivert til `specs/done/samlet-sok-lokasjon/`

### Feature fullført: søk her-knapp + tag-filter-fiks (2026-06-19)
- Fikset 2 reelle bugs i søk-fallback-kjeden (Tier 2-query-fallback, Tier 3 manglet tag-støtte)
- `sql/27_search_unanchored_tags.sql` kjørt av bruker
- Spec arkivert til `specs/done/sok-her-knapp/`

### Feature fullført: turruter-flis på forsiden (2026-06-19)
- 8. flis lenker til `/tur`, gjenbruker `CategoryCard` uendret
- Spec arkivert til `specs/done/tur-flis-forside/`

### Feature fullført: søk-fallback-kjede (2026-06-18)
- Fritekstsøk finner nå navnetreff og stedsnavn-treff utenfor brukerens lokasjonsmarkør (Tier 1/2/3),
  uten å permanent flytte markøren. `search_services()` selv uendret — kun trigger-utvidelse + ny
  frittstående `search_services_unanchored()` (`sql/24_search_fallback_tiers.sql`)
- Tier 2 bygget mot `settlements`-tabellen (961 tettsteder + 108 byer) i stedet for opprinnelig
  planlagt hardkodet byliste — bedre dekning, ingen ny infrastruktur
- Reell bug funnet og fikset under verifisering: `similarity()` ga 0 treff på korte søkeord mot lang
  `search_text` — byttet til `word_similarity()` (se gotcha i CLAUDE.md)
- Tier 3-mekanismen bekreftet med ekte data (2 reelle treff, riktig "Utenfor ditt område"-badge);
  en ekte Tier 2-banner ble ikke visuelt observert pga. tilgjengelig testdata, men mekanismen er
  bekreftet riktig via kaskade-adferden
- Spec arkivert til `specs/done/sok-fallback-kjede/`
- CLAUDE.md oppdatert under "Nylig levert" + ny gotcha om `similarity()` vs `word_similarity()`

### Feature fullført: tettsteder-kart (2026-06-18)
- 961 tettsteder importert fra Wikipedias "Tettsteder i [fylke]"-sider (15 fylker), togglbart
  punktlag på `/tur` (lilla `CircleMarker`), alle suksesskriterier bekreftet av bruker
  (stikkprøve Drammen: 125 680 innbyggere/59.75°N/10.13°E, visuell test av kart/toggle/popup)
- Nøkkelfunn fra research-fasen: befolkningsdata finnes kun i rendret HTML (ikke wikitext),
  "grå/parentes"-signalet er faktisk CSS-klassene `rtdelvis`/`kommsplit`, 15 fylkesider (ikke 19
  som først antatt) — se CLAUDE.md for full gotcha
- Nye filer: `sql/25_settlements.sql`, `scripts/parse-wikipedia-settlements.ts`,
  `scripts/push-wikipedia-settlements.ts`, `lib/settlementsDb.ts`, `app/api/settlements/route.ts`,
  utvidelse av `components/TrailMap.tsx`
- Frittstående — ingen kobling til søk/`categoryConfig.ts`. Den pausede spec'en
  `specs/active/sok-fallback-kjede/` er fortsatt uberørt og uavhengig
- Spec arkivert til `specs/done/tettsteder-kart/`
- CLAUDE.md oppdatert under "Nylig levert" + ny gotcha-seksjon for Wikipedia-tettsted-parsing

### Incident løst: search_services() funksjonskollisjon (2026-06-30)
- Root cause: `sql/21_add_utendors_category.sql` ble bygget fra utdatert `01_postgis_and_search.sql`
  (15-param, uten `p_offset`/bildekolonner) og manglet `DROP FUNCTION`-linjene for gamle signaturer.
  To overlappende `search_services()`-overloads i databasen → PostgREST: "Could not choose the best
  candidate function" på ALLE kategorier.
- Fiks: `sql/23_fix_search_services_overload.sql` — dropper de 3 feilaktige signaturene, gjenoppretter
  korrekt 16-param-versjon (med `p_offset`, `cover_image_url`, `logo_image_url`, `utendors`-grenen).
  Backend opprettet filen byte-for-byte mot PMs spesifikasjon; **kjørt og bekreftet av bruker 2026-06-30**.
- CLAUDE.md oppdatert med utvidet gotcha om at `01_postgis_and_search.sql` ikke er kilden til sannhet,
  og at `DROP FUNCTION` for gamle signaturer er obligatorisk ved enhver signaturendring.

### Sideprosjekt fullført: Geonorge turruter / `/tur` (2026-06-30)
- 163 781 ruter importert nasjonalt (137 516 fotrute, 12 135 skiløype, 11 742 sykkelrute, 2 388 annet), 0 feil
- Frittstående delsystem — **ingen** endring i `services`, `search_services()`, `matchingDb.ts`,
  `categoryConfig.ts`, `domain.ts`. Ingen kobling til hovedsøket eller tag-systemet (bevisst, bekreftet med bruker)
- Nye filer: `sql/22_trails.sql` (tabell `trails` + RLS + RPC `get_trails_in_bbox()`, kjørt av bruker
  inkl. én indeks-fix), `scripts/parse-geonorge-trails.ts`, `scripts/push-geonorge-trails.ts`,
  `lib/trailsDb.ts`, `app/api/trails/route.ts` (rate-limitet via `lib/rateLimit.ts`),
  `components/TrailMap.tsx`, `app/tur/page.tsx`
- Nye npm-avhengigheter: `sax`, `proj4` (+ typedefs) — lette, ingen native bindings
- Verifisert end-to-end med Playwright
- **Kjent begrensning (ikke bug)**: `/api/trails` ber om 2000 rader, men PostgREST kapper svar til
  1000 — i tette byområder kan ruter mangle i synlig viewport til bruker zoomer inn
- **Ikke en automatisk jobb**: engangsimport, ingen cron. Re-kjøring av samme to scripts er trygt
  (idempotent via `source_local_id`-upsert) hvis Kartverkets data skal friskes opp senere
- CLAUDE.md oppdatert under "Nylig levert" + ny gotcha-seksjon for EPSG:3035-akserekkefølge og partiell-indeks-fellen

### Feature fullført: forside-kategorier (2026-06-30)
- Spec arkivert til `specs/done/forside-kategorier/`
- CLAUDE.md oppdatert under "Nylig levert"
- Alle suksesskriterier i proposal.md bekreftet

---

## Slik oppdaterer du denne filen

**Backend-agent** — etter fullført task:
```
### Backend ([dato])
- Lagt til endepunkt: GET /api/providers/nearby?lat=&lng=&radius=
  - Returnerer: { providers: Provider[], total: number }
- Endret Provider-type: nytt felt `verified_at: string | null`
- Breaking: /api/search returnerer nå paginert ({ data, page, total })
```

**Frontend-agent** — etter fullført task:
```
### Frontend ([dato])
- Refaktorert ProviderCard: ny prop `showDistance?: boolean`
- Søk-state flyttet til URL-params (?q=&lat=&lng=)
- Ny komponent: VerifiedBadge (src/components/ui/VerifiedBadge.tsx)
```

**PM-agent** — etter arkivert feature:
```
### Feature fullført: [feature-navn] ([dato])
- Spec arkivert til specs/done/[feature-navn]/
- CLAUDE.md oppdatert
```
