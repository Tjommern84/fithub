# "Søk her i stedet" + tag-filter-fiks – Tasks

## Backend
- [x] Opprett `sql/27_search_unanchored_tags.sql`: `DROP FUNCTION IF EXISTS` (gammel signatur) + `CREATE OR REPLACE` med ny `p_tags text[] DEFAULT NULL`-parameter (basert på den allerede fiksede `word_similarity()`-kroppen fra `sql/24`, ikke originalversjonen) + `GRANT EXECUTE` (ny signatur)
- [x] Bruker kjørte filen i Supabase SQL Editor (bekreftet 2026-06-19, "27 er kjørt uten problem")

## Frontend
- [x] `lib/matchingDb.ts`: Bugfiks A — Tier 2 bruker `settlement.remainder || undefined` i stedet for `|| params.query`
- [x] `lib/matchingDb.ts`: Bugfiks B — `UnanchoredSearchParams` får `tags?: string[]`, `searchServicesUnanchored()` sender `p_tags`, Tier 3-kallet i `searchServicesWithFallback()` sender `tags: params.tags`
- [x] **Ikke i opprinnelig spec, funnet under egen verifisering**: rå RPC-testing avdekket at å
  sende `p_tags` (selv `null`) til den ennå ukjørte `sql/27`-signaturen gjør at PostgREST avviser
  HELE kallet (`PGRST202`), ikke bare ignorerer tag-filteret — Tier 3 ville returnert 0 for ALLE
  søk, ikke bare tag-filtrerte, til bruker kjører migrasjonen. Lagt til samme
  retry-uten-ny-parameter-mønster som `searchServices()` allerede bruker for `p_borough`, for å
  unngå denne regresjonen. Verifisert: Tier 3 fungerer igjen (nedgradert grasiøst uten tag-filter)
- [x] `app/resultater/ResultsView.tsx`: knapp omdøpt til "📍 Søk her i stedet", ny `onClick` som kaller `setLocation(...)` + navigerer med oppdatert lat/lon/location/city, fjernet `q`, beholdt `cat`/`tags`/`radius` (og `page`, lagt til som rimelig utvidelse — en flyttet søkekontekst bør ikke beholde gammel paginering)
- [x] `components/ServiceMap.tsx`: fjernet `focusedCoords`/`FlyToPoint` (ikke lenger i bruk)
- [x] `npx tsc --noEmit` grønt
- [x] Manuell test: bekreftet via curl/node (ikke browser — krever klikk-simulering) at: (1) destinasjons-URL-mønsteret laster korrekt med riktig kategori/tags/radius bevart og nytt lat/lon/location/city, (2) Bugfiks A gir et reelt Tier 2-treff (50 sportsklubber i Drammen, banner vist) for `cat=aktivitet-sport&q=Drammen` — første ekte Tier-2-suksess observert i dette prosjektet (tidligere sesjoner falt alltid videre til Tier 3), (3) Tier 3 fortsatt fungerer for "yoga drammen" etter retry-fiksen. Selve knappeklikket og brukerens fulle scenario (Drammen → Søk her i stedet → huk av Ishockey) krever en ekte browser for å verifisere visuelt

## PM / Avslutning
- [x] Sjekke mot suksesskriterier i proposal.md
- [x] Oppdatere CLAUDE.md
- [x] Arkivere spec til specs/done/
- [x] Oppdatere handoff.md med "feature fullført"
