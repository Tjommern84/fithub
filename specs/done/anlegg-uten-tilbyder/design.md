# Stasjonære anlegg uten tilbyder – Teknisk design

Full design er detaljert i plan-filen fra planleggingen. Sammendrag for spec-sporbarhet:

## Berørte domener
- 09 Admin & Data Import (importscript-fiks)
- 04 Provider / Tilbyder (profilside-branching)
- 01 Search & Discovery (`search_services()` ny kolonne, datakorreksjon)

## Steg 0 — Empiriske forhåndssjekker (MÅ gjøres FØRST, ingen kode)
1. Reproduser "ingen tilbyder" på Hallermoen-raden direkte (hent ID fra Supabase, last `/tilbyder/<id>`). Hvis den laster fint — ikke fiks noe, bugen kan ikke reproduseres
2. Hvis reell: sjekk i denne rekkefølgen — `service_cache` for stale negativ rad → id-encoding-mismatch i `HomeNearbyActivities.tsx` sin lenke → RLS-policy mot radens `is_active`
3. Tell faktisk omfang av kategori-feilplassering (`main_category`/`service_types` for `anl_%`/`tu_%`-rader)

## Steg 0.5 — NY, prioritert: id-encoding-bug (æøå i tjeneste-ID-er)

**Bekreftet empirisk av backend (Steg 0)**: `/tilbyder/<id>` feiler konsekvent med "ingen tilbyder"
for ID-er som inneholder æøå (f.eks. `anl_72910_hallermoen_skole_hinderløype`), mens en
byte-identisk kode-/rutebane fungerer perfekt for rene ASCII-ID-er (`anl_48504_hellfjell_golfbane`).
**41 % av alle anlegg-ID-er (2064 av 5038) er potensielt affisert** — dette er den faktiske
rotårsaken til symptomet proposal.md siterer som motivasjon, og Steg 1-6 (provider_type/UX) løser
IKKE dette. Må fikses i denne spec'en, ikke skyves til en separat oppfølging.

Backend har IKKE funnet eksakt kodelinje (var forbudt diagnostisk kode under read-only Steg 0) —
nå tillatt. Anbefalt fremgangsmåte:
1. Legg til midlertidig diagnostisk logging i `app/tilbyder/[id]/page.tsx` (logg `params.id` sin
   rå byte-/hex-representasjon FØR `.eq('id', id)`-kallet) for å bekrefte eksakt hvor strengen
   avviker fra den lagrede raden — fjern loggingen igjen før commit
2. Revisjon av ALLE steder som bygger en lenke til `/tilbyder/${id}` (kjent: `HomeNearbyActivities.tsx`,
   `ServiceCard`/`UnanchoredServiceCard` i `ResultsView.tsx` — søk bredt etter flere) — bekreft
   om `encodeURIComponent(id)` brukes konsekvent. Hvis ikke: legg det til
3. **Forsvarsfiks uavhengig av eksakt rotårsak** (lav risiko, høy sannsynlighet for å løse det
   uansett hvilket trinn i kjeden som faktisk mangler riktig encoding/normalisering): i
   `fetchServiceById()`/`resolveService()`, kjør `decodeURIComponent(id).normalize('NFC')` på
   parameteren FØR `.eq('id', ...)`-oppslaget
4. Verifiser fiksen mot Hallermoen-raden OG en stikkprøve på 10-15 andre affiserte ID-er
   (tilfeldig utvalg fra de 2064) — ikke kun ett tilfelle

## Steg 1 — `sql/NN_provider_type.sql` (sjekk neste ledige nummer med `ls sql/` først)
`provider_type text NOT NULL DEFAULT 'business' CHECK (provider_type IN ('business','facility'))` — IKKE boolean (domenet har gråsoner, f.eks. idrettslag). Backfill: `UPDATE services SET provider_type='facility' WHERE id LIKE 'anl_%' OR id LIKE 'tp_%';` (**rettet** — `tu_%` finnes ikke som prefiks, kun `anl_%` og `tp_%` er reelle. `tp_%` rader har allerede korrekt `service_types`, kun `anl_%` mangler det). Valgfri indeks.

## Steg 2 — Importscript-fiks
- `import-anleggsregisteret.ts`: `provider_type:'facility'` på `serviceRow`, legg til manglende `service_types`-innsetting (type='outdoor'). **`orgnr` lagres IKKE** — `services.orgnr` har en UNIQUE-constraint, og mange anlegg deler samme eier-orgnr (f.eks. én kommune som eier mange anlegg), som ville brutt constraint-en ved bulk-upsert. Forblir `null` for anlegg, som i dag. (PM-avgjørelse 2026-06-20: ikke verdt en skjemaendring for denne metadataen)
- Samme `provider_type`-tillegg i tuftepark-scriptene

## Steg 3 — `/tilbyder/[id]` facility-modus
`page.tsx`: legg `provider_type` til `SERVICE_SELECT`/`mapServiceRow`. `ProviderClient.tsx`: når `provider_type==='facility'` — skjul Kontakt-heading (vis adresse+Google Maps-lenke i stedet), skjul "Krev denne profilen", skjul "Send forespørsel" (to steder), vis notis "Dette er et offentlig tilgjengelig anlegg uten registrert tilbyder.", `localBusinessLd` `@type` → `Place`.

## Steg 4 — Datakorreksjon
Engangs idempotent SQL: `INSERT INTO service_types ... WHERE id LIKE 'anl_%' AND type='outdoor' AND NOT EXISTS (...)` — bekreftet av backend: **alle 5020 `anl_%`-rader mangler `service_types` helt** (0 av 5020 har noen rad). `tp_%` er ikke affisert (alle 18 har allerede korrekt rad).

## Steg 5 — `search_services()` ny kolonne
DROP+CREATE+GRANT-ritual (CLAUDE.md-gotcha). Legg `provider_type` til `RETURNS TABLE`. `lib/matchingDb.ts`: `SearchServicesRow`/`mapRowToRankedService` oppdatert. `HomeNearbyActivities.tsx`: "Offentlig anlegg"-badge i stedet for rating/pris for facility-kort.

## Steg 6 — Krev-flyt-sikring
`actions.ts`: gate på `provider_type==='facility'` FØR orgnr-sjekk, egen feilmelding. `krev/[serviceId]/page.tsx`: hent `provider_type`, vis "kan ikke kreves"-melding for anlegg i stedet for "mangler orgnr ennå".

## Avhengigheter på tvers av domener
Steg 5 (SQL-signaturendring) må kjøres av bruker før frontend sin badge-logikk gir reelle resultater i produksjon.
