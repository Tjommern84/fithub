# Stasjonære anlegg uten tilbyder – Tasks

## Backend
- [x] **Steg 0 (først, ingen kode) — FULLFØRT, men avdekket et scope-gap som blokkerer Steg 1-6 som spesifisert. Se "⚠️ Funn som krever PM-avgjørelse" nedenfor før videre arbeid.**

### Steg 0 — funn (empirisk, ikke gjettet)

**1. Reproduksjon: BEKREFTET REELL.** Hallermoen-raden (`id: anl_72910_hallermoen_skole_hinderløype`)
finnes i `services`, `is_active=true`, hentes korrekt av ANON-klienten ved direkte query
(`.eq('id', '...').maybeSingle()` — samme kode-mønster som `fetchServiceById()`). Likevel viser
`/tilbyder/<id>` "Vi fant dessverre ikke denne tilbyderen." ved direkte last. Verifisert med to
uavhengige HTTP-klienter (curl OG Node sin innebygde `fetch()`, for å utelukke shell-/curl-spesifikke
escaping-artefakter) — samme resultat begge veier.

**2. Rotårsak isolert til kategori 2 (id-encoding-mismatch) ved eliminering:**
- `service_cache`: ingen stale rad (`service_id` = riktig kolonnenavn, ikke `id` som først antatt
  — `lib/serviceCache.ts` bekreftet). Sjekket — tom, **utelukket**
- RLS: ANON-klienten (samme nøkkel appen bruker) hentet raden problemfritt — **utelukket**
- ISR-cache på selve Next.js-siden: `Cache-Control: no-store, must-revalidate` på responsen, og
  `next dev` cacher ikke ISR-data i utviklingsmodus uansett — **utelukket** (ikke i opprinnelig
  sjekkliste, men en rimelig fjerde kandidat jeg utelukket underveis)
- **Mønster bekreftet**: en sammenlignbar `anl_`-rad UTEN spesialtegn ("Hellfjell golfbane",
  `anl_48504_hellfjell_golfbane`) laster PERFEKT via identisk kode-/rutebane. Hallermoen-raden
  (med "ø" i id) feiler KONSEKVENT, uavhengig av om URL-en er korrekt prosent-enkodet
  (`%C3%B8`) eller ikke. Dette isolerer feilen til id-er med ikke-ASCII-tegn (æøå) spesifikt
- **Kunne IKKE fastslå eksakt kodelinje** uten diagnostisk kode (forbudt under Steg 0). Det jeg
  KAN bekrefte med sikkerhet: et sted mellom URL-segmentet og `.eq('id', id)`-kallet i
  `fetchServiceById()`/`resolveService()` mister/endrer ikke-ASCII-tegn slik at oppslaget ikke
  matcher den lagrede raden, selv om identisk streng fungerer i et frittstående script

**3. Faktisk omfang (paginert telling — PostgREST sin 1000-rads-cap ga først feilaktig lave tall,
rettet med `range()`-paginering):**
- `anl_%`: **5020 rader totalt** (ikke 1000 som første, ikke-paginerte telling viste)
- `tp_%` (tuftepark): **18 rader** — **`tu_%` finnes IKKE** (0 treff). Design.md sin Steg 1-SQL
  (`WHERE id LIKE 'anl_%' OR id LIKE 'tu_%' OR ...`) refererer til et prefiks som ikke eksisterer
  — riktig prefiks er `tp_%` (dekker `tp_oslo_%`). **Må rettes i design.md før Steg 1 kjøres.**
- **Kategori-feilplassering**: alle 5020 `anl_%`-rader har `main_category='aktivitet-sport'`
  (konsistent, ikke i seg selv "feil"), men **0 av 5020 har NOEN `service_types`-rad** —
  bekrefter proposal.md sin hypotese fullt ut: ALLE anlegg mangler `type='outdoor'`-taggen og
  dukker derfor aldri opp under tag-filtrert "Utendørs"-søk. `tp_%` (tuftepark) er IKKE
  affisert — alle 18 har allerede korrekt `service_types`
- **Ikke-ASCII-risiko**: **2064 av 5038** `anl_%`+`tp_%`-id-er (≈41 %) inneholder æøå og er
  dermed potensielt utsatt for SAMME "ingen tilbyder"-bug som Hallermoen, ikke et engangstilfelle

### ⚠️ Funn som krever PM-avgjørelse før Steg 1-6 fortsetter

Design.md sin Steg 1-6-plan (provider_type/facility-modus) **fikser ikke id-encoding-bugen**.
De to problemene er ortogonale: selv med `provider_type='facility'` lagt til, vil
`/tilbyder/<id>` for de ~2064 affiserte radene fortsatt vise "ingen tilbyder", fordi oppslaget
i seg selv feiler FØR facility-modus-rendringen i det hele tatt får sjansen til å kjøre. Steg 1-6
løser et reelt, bekreftet problem (manglende `service_types` + dårlig UX for anlegg), men løser
IKKE symptomet som proposal.md siterer som motivasjon ("'Hallermoen skole, hinderløype' ... gir
'ingen tilbyder' ved klikk").

**To veier videre — trenger avgjørelse, ikke noe jeg avgjør selv siden det utvider scope:**
1. Fortsett med Steg 1-6 som planlagt NÅ (løser kategori-/UX-problemet), og lag en EGEN,
   oppfølgende spec for id-encoding-fiksen (sannsynligvis: endre `makeId()` i
   `import-anleggsregisteret.ts` til å transliterere æøå→aeoa for NYE rader, PLUSS en
   engangs-datamigrering som renamer/oppdaterer id på de ~2064 eksisterende affiserte radene —
   ikke trivielt siden `id` er primærnøkkel og potensielt referert fra `service_types`/
   `service_coverage`/`favorites` via foreign key)
2. Utvid denne spec'en til å inkludere id-encoding-fiksen som et nytt Steg 0.5/1, FØR de
   opprinnelige Steg 1-6 — mer sammenhengende, men større enkelt-leveranse

### ✅ PM-avgjørelse: vei 2 — utvid denne spec'en

Id-encoding-bugen er den faktiske rotårsaken til symptomet proposal.md siterer som motivasjon —
løses HER, ikke i en separat oppfølging. Design.md er oppdatert med nytt **Steg 0.5**, og
prefiks-feilen (`tu_%` → `anl_%`/`tp_%`) er rettet i design.md sin Steg 1.

- [x] **Steg 0.5 — LØST.** Eksakt rotårsak funnet: Next.js App Router dekoder IKKE ikke-ASCII
  path-segmenter automatisk i `params.id`. Fiks: ny `normalizeServiceId()` i
  `app/tilbyder/[id]/page.tsx` (`decodeURIComponent` + `.normalize('NFC')`, try/catch-fallback),
  kalt ved inngangspunktet i `resolveService()` (dekker cache + DB-oppslag + statisk fallback
  konsekvent). 12 av 13 `/tilbyder/${id}`-lenkesteder revidert med `encodeURIComponent`
  (inkl. `app/sitemap.ts`, JSON-LD/canonical-URL). Verifisert 16/16 i stikkprøve (Hallermoen +
  15 andre). `npx tsc --noEmit`: 0 feil. Diagnostisk kode fjernet og bekreftet borte.
  **Flagget, ikke rørt**: `app/dashboard/services/[id]/edit/page.tsx` bruker `params.id` direkte
  i en client component (annen kontekst) — kan ha samme bug, men ikke verifisert. Se eget
  oppfølgingspunkt nedenfor
- [x] `sql/28_provider_type.sql`: ny kolonne + backfill (rettet prefiks: `anl_%`/`tp_%`) + valgfri
  indeks + Steg 4 sin datakorreksjon (alle 5020 `anl_%`-rader manglet `service_types` helt)
- [x] Fiks `scripts/import-anleggsregisteret.ts`: `provider_type:'facility'`, manglende
  `service_types`-innsetting lagt til. **`orgnr` lagres IKKE** (PM-avgjørelse — UNIQUE-constraint-
  konflikt, se design.md)
- [x] Samme `provider_type`-tillegg i `push-tufteparker.ts`/`push-tufteparker-oslo.ts`
- [x] `sql/29_search_services_provider_type.sql`: `provider_type` lagt til i `search_services()`
  sin `RETURNS TABLE` (DROP+CREATE+GRANT — egen presisering: kravet kommer her av at Postgres
  ikke tillater `CREATE OR REPLACE` med endret returkolonneliste, ikke av parameteroverload)
- [x] `npx tsc --noEmit`: 0 feil (kjørt etter alle endringer)
- [x] Bruker kjørte `sql/28_provider_type.sql` + `sql/29_search_services_provider_type.sql` i Supabase SQL Editor 2026-06-20
- [ ] **Utsatt til senere sesjon (ikke blokkerende for denne spec'en)**: verifiser om `app/dashboard/services/[id]/edit/page.tsx` har samme
  id-encoding-bug for tilbydere med ikke-ASCII-tegn i sin egen tjeneste-ID, fiks om nødvendig
  (IKKE bare legg til `encodeURIComponent` blindt — kan dobbel-enkode en allerede-udekodet streng)

## Frontend
- [x] `lib/domain.ts`: ny `ProviderType = 'business' | 'facility'`-type, `provider_type?: ProviderType` på `Service`
- [x] `lib/matchingDb.ts`: `SearchServicesRow`/`mapRowToRankedService` oppdatert med `provider_type` (default `'business'` når kolonnen mangler/er `null` — ingen retry-mønster nødvendig her, i motsetning til `p_tags`-saken: dette er en RETURN-kolonne, ikke et nytt input-param, så PostgREST avviser ikke hele kallet selv om kolonnen ikke finnes ennå)
- [x] `app/tilbyder/[id]/page.tsx`: `provider_type` lagt til i `SERVICE_SELECT`/`mapServiceRow` + `localBusinessLd` sin `@type` er nå `service.provider_type === 'facility' ? 'Place' : 'LocalBusiness'`. **`normalizeServiceId()`/`resolveService()` IKKE rørt**, som instruert
- [x] `app/tilbyder/[id]/ProviderClient.tsx`: ny `isFacility`-variabel. Facility-modus: Kontakt-seksjon byttet til en enklere "Adresse"-seksjon med Google Maps-lenke (kun adresse+lenke, ingen telefon/e-post/nettside-liste), "Er du ansvarlig..."-krev-kortet byttet til en informasjonsnotis ("Dette er et offentlig tilgjengelig anlegg uten registrert tilbyder."), BÅDE "Send forespørsel"-stedene skjult (desktop-CTA-kortet og mobil sticky-bunnbar) — modalens innhold selv urørt siden begge triggere som åpner den nå er borte for facility
- [x] `app/tilbyder/[id]/actions.ts`: `claimServiceWithOrgnr()` henter nå `provider_type` i spørringen, gater på `provider_type==='facility'` **FØR** `owner_user_id`/`orgnr`-sjekkene (egen ny status `'facility'` i `ClaimWithOrgnrStatus`), bygget kun på `provider_type` — ingen kombinasjon med orgnr-tilstand, som instruert
- [x] `app/tilbyder/krev/[serviceId]/page.tsx`: henter `provider_type`, viser dedikert "Kan ikke kreves"-side for anlegg (plassert FØR login-sjekken — ingen vits i å be om innlogging for noe som uansett ikke kan kreves)
- [x] `components/home/HomeNearbyActivities.tsx`: "Offentlig anlegg"-badge (grønn tekst) erstatter rating-stjerne for facility-kort, avstand vises uendret for begge typer
- [x] `npx tsc --noEmit`: grønt
- [x] `npm run build`: grønt (ingen kode-feil — se ⚠️ under for en driftsmessig hendelse dette utløste)
- [x] Manuell test — **delvis blokkert av at migrasjonene ikke er kjørt ennå** (forventet, varslet i oppstart-prompten): bekreftet via direkte Supabase-spørring at `services.provider_type`-kolonnen ikke finnes i live DB ennå (`sql/28` ikke kjørt). All facility-spesifikk UI (Kontakt→Adresse, Krev-notis, Send forespørsel skjult, "Offentlig anlegg"-badge, `Place`-JSON-LD) faller derfor korrekt og grasiøst tilbake til business-oppførsel akkurat nå — verifisert at IKKE noe krasjer (200 OK gjennomgående), kun at facility-grenen ennå ikke kan trigges med ekte data. Kode-gjennomgang bekrefter at betingelsene (`isFacility`/`provider_type==='facility'`) er korrekt koblet; full ende-til-ende-verifisering av facility-UI må gjøres av bruker ETTER at `sql/28_provider_type.sql` + `sql/29_search_services_provider_type.sql` er kjørt
- [x] Regresjonssjekk: vanlig anlegg-rad uten spesialtegn (`anl_48504_hellfjell_golfbane`) og `/resultater?cat=trene-selv` begge bekreftet uendret/fungerende

### ⚠️ Driftsincident under denne oppgaven (løst, men flagget eksplisitt)
`npm run build` (kjørt som instruert, for byggeverifisering) skrev til SAMME `.next`-mappe som
den allerede kjørende dev-serveren (port 3000) brukte. Dette korrumperte dev-serverens
in-memory webpack-chunk-referanser (`Cannot find module './4894.js'`) — **hele forsiden, ikke
bare anlegg-sidene, begynte å returnere 500** rett etter `npm run build` fullførte. Selv-helet
ikke etter flere forsøk/venting. **Jeg restartet dev-serveren** (drepte prosessen på port 3000,
startet en ny `npm run dev`) for å gjenopprette — bekreftet sunn igjen etterpå (homepage +
Hellfjell-siden begge 200 OK). Dette er en sannsynlig systemisk risiko ved å kjøre `npm run
build` og `npm run dev` samtidig mot samme prosjektmappe — verdt å vurdere om fremtidige
oppgaver bør bruke en isolert build-katalog (`next build` har ingen innebygd `--output-dir`,
men en `git worktree`/kopi kunne unngått kollisjonen) hvis dette gjentar seg.

## PM / Avslutning
- [x] Sjekke mot suksesskriterier i proposal.md
- [x] Oppdatere CLAUDE.md
- [x] Arkivere spec til specs/done/
- [x] Oppdatere handoff.md med "feature fullført"
