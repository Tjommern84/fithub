# Migrering av tilbydere, treningssteder og tilbud

Migreringen skiller dagens `services` i tre konsepter:

- `providers`: hvem som leverer tilbudet
- `venues`: hvor tilbudet finnes
- `offerings`: hva brukeren kan gjøre eller kjøpe

`services` slettes eller erstattes ikke i denne fasen. `legacy_service_map` gjør alle nye rader sporbare tilbake til originalen.

## Forutsetninger

Lokalt må `.env.local` inneholde `NEXT_PUBLIC_SUPABASE_URL` og `SUPABASE_SERVICE_ROLE_KEY`.
Nøkkelverdier skal aldri skrives til logg eller migreringsfiler.

## Kjørerekkefølge

1. Kjør `sql/42_content_model.sql` i Supabase SQL Editor. For eksisterende
   installasjoner som allerede har kjørt versjon 42, kjør også
   `sql/43_content_model_hardening.sql`.
2. Kjør `sql/44_content_category_search.sql` for å aktivere geografisk søk
   direkte i den nye modellen. Applikasjonen faller automatisk tilbake til
   eksisterende `search_services` frem til funksjonen finnes.
3. Kjør `sql/45_content_results_search.sql` for å aktivere den nye modellen
   i `/resultater`, inkludert fritekst, kategori, tags, type, sted, radius,
   sortering og paginering. Også her beholdes automatisk legacy-fallback.
4. Kjør skrivebeskyttet audit:

   ```bash
   npm run content:audit
   ```

5. Bygg en deterministisk plan:

   ```bash
   npm run content:plan
   ```

6. Kontroller planen uten å skrive:

   ```bash
   npm run content:apply:dry
   ```

   Tørrkjøringen sammenligner hver planrad med dagens `services`-rad. Den
   stopper dersom en rad er slettet eller endret etter at planen ble laget.

7. Migrer med en eksplisitt sikkerhetsgrense:

   ```bash
   npm run content:apply -- --max-records=40000
   ```

   For en kontrollert pilot kan planen deles opp uten å bygges på nytt:

   ```bash
   npm run content:apply -- --offset=0 --limit=250 --max-records=250
   ```

8. Kjør `sql/46_content_write_sync.sql` etter at migreringsplanen er brukt. Da
   blir eksisterende maskinlagde koblinger merket som synkstyrte, og
   `providers`, `venues`, `offerings` og kategorikoblingene holdes automatisk
   oppdatert når `services`, `service_types` eller `service_categories` endres.
   SQL-filen kjører en transaksjonell selvtest og avbryter uten delvise
   endringer hvis testen feiler.
9. Verifiser:

   ```bash
   npm run content:verify
   ```

Plan og rapporter lagres under `data/` og er ignorert av Git.

## Sikkerhet og omkjøring

- Migreringen bruker stabile ID-er og `upsert`, og kan kjøres flere ganger.
- Etter SQL 46 synkroniseres alle nye og endrede `services`-rader automatisk,
  uansett om de kommer fra dashboard, admin eller et importskript.
- Automatisk synk eier bare koblinger merket `sync_managed`. Kategorier og
  steder som legges til manuelt med standardverdien `false`, blir ikke slettet.
- Feil i automatisk synk blokkerer ikke den opprinnelige skrivingen. De lagres
  i `content_sync_state` og blir oppdaget av `content:verify`.
- En kjøring registreres i `content_migration_runs`.
- Ingen `services`-rader slettes.
- OSM-steder med koordinater forblir aktive selv om bynavnet mangler. De kan
  fortsatt avstandsfiltreres og blokkerer derfor ikke migreringen.
- Usikre rader legges i `content_review_queue`.
- Ferdigbehandlede køelementer nullstilles ikke til `pending` ved omkjøring.
- Bare den beste tilgjengelige kontakt-/kvalitetsraden beholdes når flere
  tjenester peker til samme kjedeleverandør.
- `service_categories` fylles som kompatibilitetsbro for eksisterende kode.
- Den kjente feilen `trene-samen` korrigeres til `trene-sammen`.
- Paraidrett markeres som primær kategori, men beholder sportstypen og kan dermed vises begge steder.

## Tolkning av resultatet

- `ready` betyr at raden har minst én kategori og kan knyttes til en tilbyder
  eller et fysisk sted.
- `review` betyr at raden ikke kan flyttes automatisk uten å gjette.
- `missing_city` er et kvalitetsvarsel, ikke en blokkering, når koordinater
  allerede finnes.
- `content:verify` skal avslutte med kode 0. Den kontrollerer at alle gamle
  tjenester enten er migrert eller ligger i ventende vurdering, at alle
  forsidekategorier har innhold, og at både kategori- og resultatsøket finner
  dem gjennom den strukturerte modellen uten duplikater.
