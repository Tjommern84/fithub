# Turso: teknisk pilot for turruter

Dato: 2026-09-11. Arbeidstre: `feature/events-basis`.

Dette er historikken fra første pilot. Den selvstendige leveransen ligger nå i `feature/turso-trails`; se [gjeldende bytte- og oppdateringsplan](turso-cutover.md) for databasekandidat, ny verifikasjon og gjenværende steg.

## Status og delmål

1. **Eksport og import bestått.** Supabase `trails` eksportert 2026-09-10 med 163 783 rader og original EWKB-geometri. SQLite-fil: `data/geonorge/fithub-trails-complete-2026-09-10.sqlite` i hovedarbeidsmappen, 241 688 576 byte. Integritetskontroll bestått. Eksporten er paginert, ikke et transaksjonelt snapshot.
2. **Testdatabase og tilgang bestått.** `fithub-trails-test` i `aws-eu-west-1` (Irland), samme antall ruter og RTree-poster. Appen bruker eget databasebegrenset lesetoken. Et skriveforsøk uten berørte rader ble avvist. Administrasjonstokenet brukes bare av lokale administrasjonsskript.
3. **Adapter og sammenligning bestått for utvalgte områder.** Valgbart datalag via `TRAILS_DATA_SOURCE=turso`; standard er `supabase`. `/api/trails` og `/api/trails/nearest` bruker samme valg. Kartområder i Drammen (149), Oslo (33) og Tromsø (6) ga identiske ID-sett mot Supabase. Nærmeste 20 ruter ved både 5 og 30 km ga identiske ID-sett og avstandsforskjell under én meter. Ett tidligere 30 km-referansekall svarte HTTP 500 fra Supabase; senere full sammenligning bestod.
4. **Ytelse forbedret.** Nærmeste-søk henter bare endepunkter og utvider søkeradius gradvis. Når en mindre sirkel inneholder nok treff, kan ingen rute utenfor sirkelen være nærmere. Siste varme måling av 30 km-søk: Drammen 65 ms, Oslo 147 ms, Tromsø 217 ms. Dette er punktmålinger, ikke en lasttest eller garanti for kald database.
5. **Nettleser bestått.** Ekte Edge mot Turso: viewport med 1 814 ruter og tegnede linjer, nærmeste-søk, ugyldig bbox (400), mobil på 390 px og simulert 503 med vellykket ny henting. Ingen JavaScript-sidefeil. Eksterne nettleserressurser var blokkert, så bakgrunnskartflisene er ikke visuelt verifisert. Ingen produksjonsdeploy eller sletting fra Supabase er utført.

## Implementasjon

Avsluttende kontroll: 52 enhetstester, ESLint, TypeScript, produksjonsbygg (Next 16.3.4 webpack) og eksisterende produksjonssmoke bestått. Produksjonssmoke brukte standardkonfigurasjon uten Supabase; ekte Turso-integrasjon er separat kontrollert i dev-nettlesertesten og sammenligningsskriptet. Dette er ikke en deploytest.

- `lib/tursoSql.ts`: SQL over HTTPS med parameterbinding, tidsavbrudd, eksplisitt lukking av forbindelsen og ingen eksponering av databasefeilmeldinger/token til klienten.
- `lib/tursoTrails.ts`: RTree-kandidater og geometriavgrensning før resultatgrensen; nærmeste navngitte rute måles til start/slutt, slik dagens SQL 36 gjør.
- `lib/trailGeometry.ts`: EWKB-dekoding og koordinatkontroll. SQLite inneholder original binær EWKB; den krever ikke SpatiaLite.
- `lib/trailsServer.ts`: eksplisitt valg av kilde. Turso-feil blir synlig HTTP 503, uten skjult bytte av datakilde.
- `TrailMap`: synlig lasting/feil, prøv igjen, avbrudd av utdaterte kall og merking når forrige kartdata beholdes.

## Lokal kjøring

`.env.turso.local` i arbeidstreet er Git-ignorert og inneholder `TRAILS_DATA_SOURCE`, `TURSO_DATABASE_URL` og `TURSO_AUTH_TOKEN`. Lesetokenet ble opprettet 2026-09-11 med 30 dagers levetid; forny det før videre testing etter utløp. Ikke kopier administrasjonstokenet til appens miljøvariabler eller bruk `NEXT_PUBLIC_` foran tokens.

For sammenligning fra arbeidstreet:

```sh
node --env-file=../../.env.local --env-file=.env.turso.local --import tsx scripts/verify-turso-trails.ts
```

Rapport: `.tmp/turso/comparison.json`. Skriptet markerer utilgjengelig Supabase-referanse eksplisitt; exit 0 alene betyr ikke at alle referansekall var tilgjengelige. Kontroller rapporten.

For Next dev skal miljøfilene lastes før Next startes uten å sende `--env-file` videre til Next sine underprosesser:

```sh
node -e "process.loadEnvFile('../../.env.local'); process.loadEnvFile('.env.turso.local'); process.argv=['node','next','dev','--port','3100']; process.execArgv=[]; import('./node_modules/next/dist/bin/next')"
```

Kjør deretter `node scripts/test-turso-browser.mjs` mot `http://localhost:3100`. Rapport og bilder ligger i `.tmp/turso/`. Stopp dev før produksjonsbygg. Vanlig deploy bruker miljøvariablene direkte. Supabase-miljøet er fortsatt nødvendig for tilbydere, brukere, aktiviteter, tettsteder og turmål.

## Gjenstående før produksjonsbytte og plassfrigjøring

- Gjennomgå flere geografiske randtilfeller og store kartområder. Kartinterseksjon er rettlinjet i lengde-/breddegrader, mens PostGIS geography bruker geodetiske segmenter. De testede områdene samsvarer, men dette er ikke et bevis for alle ruter nær viewport-grenser.
- Søket har sikkerhetsgrense på 20 000 kandidater; for brede søk gir feil fremfor ufullstendig nærmeste-rangering. Test ytterligere tettbygde områder, høy breddegrad, kald database og last før bred utrulling.
- SQLite-kopien oppdateres ikke automatisk når importjobber skriver til Supabase. Avklar ny import-/synkroniseringsrutine og håndtering av endringer siden eksport før permanent flytting.
- `lib/destinationsDb.ts` har fortsatt en `findTrailRoute`-funksjon med Supabase RPC `find_trail_route`, uten aktive kall fra appen i denne gjennomgangen. Inventer DB-avhengigheter før tabellen fjernes. Turmål, tettsteder og ORS-ruteberegning er ikke flyttet.
- Behold original eksport og rapport. Sett deployens `TRAILS_DATA_SOURCE=turso` først etter pilotgodkjenning; rollback er `supabase` så lenge originaltabellen finnes. **Ingen plass er frigjort i Supabase ennå.** Sletting krever en egen, konkret gjennomgang av avhengigheter, backup og oppdateringsrutine.

Protokollreferanser: [SQL over HTTP](https://docs.turso.tech/sdk/http/reference), [SQLite-opplasting](https://docs.turso.tech/api-reference/databases/upload).
