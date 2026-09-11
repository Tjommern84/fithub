# Selvstendig Turso-leveranse

Dato: 2026-09-11. Gren: `feature/turso-trails`. Arbeidstre: `C:/Kode/SettDegEtMal/.worktrees/turso-release`.

## Leveranse

Dette arbeidstreet bygger på eksisterende `main` og inneholder kun Turso-kartflyten, oppdateringsverktøy, tester og kompatible sikkerhetsoppdateringer. Aktivitetsforsiden, Basis-arrangementene og SQL 47 er ikke med. Leveransen er committet og pushet i [PR 11](https://github.com/Tjommern84/fithub/pull/11). Ingen produksjonsdeploy eller sletting er utført av denne leveransen.

GitHub CI og Vercel-preview for første commit `bd29614` bestod. Direkte previewkontroll krever Vercel-innlogging; lokal Vercel-tilgang er foreløpig ikke konfigurert. Produksjonskontroll 2026-09-11: kjent kartområde returnerte 149 ruter, mens `/api/trails/nearest` svarte 404. Dette viser at den nye API-versjonen ennå ikke var aktiv i produksjon ved kontrollen.

Databasekandidat: `fithub-trails-release-20260911` i Irland. 163 783 rader, 242 802 688 byte. Opplasting er verifisert med radantall for ruter og RTree samt binær geometri for utvalgte rader. Dette er ikke full remote checksum av alle rader.

Kandidatens lokale kilde: `data/geonorge/fithub-trails-release-upload-20260911.sqlite` i hovedmappen. SHA256: `5b2479a7fb3a0b9497245110d6cbedfb3b9594477bc39baf319b084bd9a5d49a`. Samme hash som oppdateringsresultatet før den ekstra filkopien. Originaleksporten beholdes separat.

Full Geonorge-repetisjon: 163 781 uendrede, 0 nye, 0 endrede, 2 andre ruter bevart. Input er eksisterende lokale Geonorge-data fra juni; dette er en test av oppdateringsflyten og ingen ny nedlasting av kildedata. Windows-rettighetsfeilen i midlertidig filpublisering er rettet og full datasettkjøring + opplastingens lesekontroll gjentatt.

Manuell GPX-repetisjon: de to faktiske lokale filene ga 745 punkter og begge ruter uendret ved oppdatering med `--data-source ut.no`. Alle 163 781 Geonorge-ruter ble bevart. Ingen kildeendringer ble nødvendig å laste opp etter denne kontrollen.

## Avsluttende verifikasjon

- 40 TypeScript-enhetstester og 11 Python-tester bestått. Python-testene inngår nå i CI.
- ESLint, TypeScript og produksjonsbygg bestått i den separate grenen.
- Faktisk sammenligning mot Supabase: identiske ID-sett for tre kartområder og nærmeste 20 ved både 5 og 30 km. Lesetoken avviser skriv. `.tmp/turso/comparison.json`.
- Åtte Edge-kontroller mot **produksjonsserver lokalt** og faktisk Turso-release bestått: forside 200, 1 814 kartlinjer, nærmeste-søk, ugyldige/manglende koordinater 400, mobil, én simulert 503 med vellykket retry og svært stort kartområde. Ingen JavaScript-sidefeil. `.tmp/turso/browser-report.json` og bilder.
- Verdensomspennende bbox ga begrenset 200-svar på 24 742 ms og under 250 000 punkter. Dette er nær tidsgrensen og støtter behovet for grensene; det er ikke en lasttest eller god interaktiv responstid. Små søk er vesentlig raskere, men varierer ved kald database.
- Produksjonsbygget ble laget uten Supabase-public-konfigurasjon; ekte innlogging/tilbyderresultater er ikke verifisert i denne nettleserkjøringen. Eksterne nettleserressurser var blokkert, så bakgrunnskartets bilder ble ikke kontrollert. Preview med full miljøkonfigurasjon gjenstår.

## Endringer etter uavhengig gjennomgang

- Maksimalt 25 sekunder for samlet Turso-søk; avbrudd fra HTTP-kallet føres videre til databasekallet. Hvert databasekall har også 20 sekunders grense.
- Maksimalt 8 MiB per databasesvar og 250 000 returnerte geometripunkter i kartsvaret, i tillegg til kandidat-/radgrenser. Overskridelse gir synlig feil, ikke en uriktig nærmeste-rangering.
- Databaseversjoner lastes opp under nye navn. `upload-trails-release.mjs` gjør bare lokal forhåndskontroll uten `--apply`, nekter eksisterende navn og kontrollerer geometriutvalg etter opplasting. Den endrer aldri deployens miljøvariabler.
- Ingen ny runtime-avhengighet. Next/eslint-config-next 16.3.4 og sharp 0.35.4 samt kompatible transitive rettelser. Én moderat eksisterende `stream-json`-advisory gjenstår i BRREG-importen, med major-oppgradering som separat arbeid.

## Produksjonsbytte

1. Gjennomgå og lever den separate grenen. Prosjektets regel krever eksplisitt forespørsel før commit/push. SQL 47 er ikke nødvendig for denne leveransen.
2. Sett følgende servervariabler for den aktuelle deployen. Behold eksisterende Supabase-/ORS-konfigurasjon; bruk aldri administrasjonstoken eller `NEXT_PUBLIC_` for Turso-tokenet:

```dotenv
TRAILS_DATA_SOURCE=turso
TURSO_DATABASE_URL=libsql://fithub-trails-release-20260911-tjommern.aws-eu-west-1.turso.io
TURSO_AUTH_TOKEN=<databasebegrenset lesetoken>
```

3. Opprett først preview med disse variablene. Kontroller `/tur`, kartflytting, filtre, tomme treff, mobil og en kjent positiv nærmeste-rute. Test også resten av forsiden med reell eksisterende Supabase-konfigurasjon.
4. Det lokale kandidat-tokenet er gyldig i 30 dager fra 2026-09-11. Før produksjon: velg dokumentert rotasjon/levetid og legg tokenet i deployplattformens hemmelighetshåndtering. `.env.turso.local` er kun lokalt testoppsett; det distribueres ikke automatisk.
5. Etter godkjent preview kan samme app og dataversjon publiseres. Kontroller faktiske svar på live-domenet og overvåk feil/latens før videre steg.

Begge nye API-er returnerer `X-FitHub-Trails-Source` ved vellykket søk. Kontroller kilde **og faktiske treff** med `node scripts/verify-trails-deployment.mjs https://fithub.no turso`. For rollback brukes samme kommando med `supabase`. Kontrollen avviser innloggingsredirect, gammel deploy, feil datakilde og tomt kjent søk. Den endrer ingen data og omgår ikke previewbeskyttelse.

Rollback: sett `TRAILS_DATA_SOURCE=supabase` og redeploy, eller gå tilbake til tidligere deploy. Kontroller et kjent område med faktiske treff; gammel Supabase-adapter kan returnere tom liste ved feil. Supabase-tabellen må beholdes så lenge denne rollbacken trengs.

## Oppdatere data

Geonorge: eksisterende `parse-geonorge-trails.ts` lager NDJSON. Kjør så, fra dette arbeidstreet:

```sh
python scripts/refresh-trails-sqlite.py --source ../../data/geonorge/fithub-trails-complete-2026-09-10.sqlite --input ../../data/geonorge/trails.ndjson --output ../../data/geonorge/ny-versjon.sqlite
node scripts/upload-trails-release.mjs --file=../../data/geonorge/ny-versjon.sqlite --name=fithub-trails-NY-VERSJON
```

Bruk neste gang den sist godkjente SQLite-versjonen som `--source`, slik at tidligere nye ID-er og manuelle ruter videreføres. Velg faktisk dato/versjon med små bokstaver i databasenavnet. Kontroller manifestets antall/endringer før samme opplastingskommando kjøres med `--apply` og lokal plattformtilgang. Hver versjon opptar separat lagringsplass; rydd gamle versjoner kun etter at rollbackbehov er avklart.

For manuelt hentede GPX-filer:

```sh
python scripts/gpx-to-trail-ndjson.py --input ../../turer --output .tmp/ut-no-ny.ndjson
python scripts/refresh-trails-sqlite.py --source ../../data/geonorge/sist-godkjent.sqlite --input .tmp/ut-no-ny.ndjson --data-source ut.no --output ../../data/geonorge/ny-gpx-versjon.sqlite
```

Filnavnet uten `.gpx` er kilde-ID og må holdes stabilt. Konvertereren avviser separate sporsegmenter fremfor å tegne en kunstig linje mellom dem. Den laster ikke ned GPX-filer eller endrer kildefilene.

Ruter som mangler i innfilen beholdes og telles i manifestet. Det hindrer utilsiktet sletting ved delvise kildefiler, men kilderettelser som fjerner en rute trenger en eksplisitt separat opprydding. Eldre Supabase-importskript skal ikke brukes som oppdatering av en Turso-basert produksjon.

## Før plass frigjøres

Kjør og gjennomgå `scripts/inspect-trail-dependencies.sql` i faktisk Supabase. Ingen katalogresultater er mottatt ennå. Avklar både databaseobjekter og eksterne/manuelle importjobber. Ikke bruk `DROP ... CASCADE` som erstatning for avhengighetskontroll. Behold verifisert eksport og gjenopprettingsmulighet.

Å bytte datakilde frigjør ikke plass. Sletting av den gamle tabellen er et eget destruktivt steg som må beskrives konkret og godkjennes etter vellykket produksjonsperiode. Ingen slik sletting er klargjort for automatisk kjøring her.
