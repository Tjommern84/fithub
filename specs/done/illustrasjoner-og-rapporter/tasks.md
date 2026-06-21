# Idrett-illustrasjoner + "Rapporter feil"-flagg – Tasks

## Backend
- [x] Sjekk neste ledige `sql/NN_`-nummer med `ls sql/`, opprett `sql/NN_service_reports.sql`:
      `services.reported_at` kolonne, ny `service_reports`-tabell + RLS (kun anon INSERT)
- [x] DROP+CREATE `search_services()` med `AND s.reported_at IS NULL` lagt til i `WHERE`, GRANT EXECUTE
- [x] `app/tilbyder/[id]/actions.ts`: ny `reportService(serviceId, reason)` — rate-limit per IP
      (`lib/rateLimit.ts`), hash IP før lagring, insert i `service_reports`, deretter
      `UPDATE services SET reported_at = now()`
- [x] `npx tsc --noEmit` grønt
- [x] Marker migrasjonsfilen i handoff.md "Neste steg" med "Blokkert av: bruker må kjøre SQL i Supabase SQL Editor"

## Frontend
- [x] Ny `lib/serviceIllustrations.tsx`: `SPORT_ICON_KEYWORDS`, `TYPE_FALLBACK_ICON`,
      `getServiceIllustration()` — se design.md for full liste over idretter
- [x] `components/home/HomeNearbyActivities.tsx`: render illustrasjon i tom bilde-boks når
      `cover_image_url` er `null`
- [x] `app/resultater/ResultsView.tsx`: samme i `ServiceCard` og `UnanchoredServiceCard`
- [x] Ny `components/ReportIssueModal.tsx` (etter `FeedbackModal.tsx`-mønster)
- [x] "Rapporter feil"-lenke i `ResultsView.tsx` sine kort-footere (begge korttyper)
- [x] "Rapporter feil"-lenke i `app/tilbyder/[id]/ProviderClient.tsx` (under Kontakt-seksjonen)
- [x] `npx tsc --noEmit` OG `npm run build` grønt
- [x] Manuell test: kort med "håndball"/"karate" i navn viser riktig ikon, rapporter-knapp synlig
      og fungerer (også uten at backend-migrasjonen er kjørt ennå — bør falle gracefully tilbake,
      ikke krasje, akkurat som tidligere `provider_type`-runder)

## PM / Avslutning
- [x] Sjekke mot suksesskriterier i proposal.md
- [x] Oppdatere CLAUDE.md (ny gotcha: umiddelbar rapport-skjuling må revurderes før launch)
- [x] Arkivere spec til specs/done/
- [x] Oppdatere handoff.md med "feature fullført"
