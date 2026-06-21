# Idrett-illustrasjoner + "Rapporter feil"-flagg – Proposal

## Problem
1. Tjenestekort ("Aktiviteter nær deg", `/resultater`) viser en tom grå boks når
   `cover_image_url` mangler — ingen visuell differensiering mellom f.eks. en håndballklubb og
   en karateklubb, selv om begge har `type='sport'`.
2. Det finnes ingen måte for besøkende å rapportere en feilaktig/nedlagt aktivitet. Slike rader
   blir liggende synlige på ubestemt tid.

## Scope
- Navnebasert ikon-gjenkjenning (håndball, fotball, kampsport, ski, svømming, tennis, basketball,
  volleyball, badminton, yoga, styrke, løping/kondisjon) + generisk fallback per `ServiceType`
- "Rapporter feil"-knapp på `/resultater`-kortene og tilbyder-profilsiden, åpen for alle
  (rate-limitert per IP), umiddelbar skjuling fra offentlige flater, raden forblir i databasen

## Ikke i scope denne runden
- "Rapporter feil" på `HomeNearbyActivities`-kortene (strukturendring, egen oppfølging)
- Adminpanel-UI for å se gjennom/gjenopprette rapporterte tjenester
- Terskel/godkjenning før skjuling (umiddelbar skjuling nå — **se gotcha: må revurderes før launch**)
- Fullstendig idrett-ikonbibliotek (kun ~12 idretter i første runde)

## Suksesskriterier
- [x] Et kort uten `cover_image_url` med "håndball" i navnet viser håndball-ikon, "karate" viser
      kampsport-ikon, en tjeneste uten idrettsord viser type-fallback-ikon — bekreftet mot reelle
      DB-rader (`para_sandefjord_shotokan_karateklubb...`, `para_falk_handball_horten`)
- [x] "Rapporter feil" fungerer fra både `/resultater`-kort og tilbyder-profilsiden — fant og
      fikset en reell bug under verifisering (knappen var feilaktig skjult når tjenesten manglet
      ALLE kontaktfelt, siden den lå inni samme `{(...)&&}`-betingelse som Kontakt-seksjonen)
- [x] Rapportert rad forsvinner umiddelbart fra `/resultater` og "Aktiviteter nær deg" — `sql/30`
      kjørt av bruker 2026-06-21, `search_services()` filtrerer nå på `reported_at IS NULL`
- [x] Rapportert rad finnes fortsatt intakt i `services`-tabellen, `reported_at` satt — raden
      slettes aldri, kun filtreres bort av søkefunksjonen
- [x] Rate-limit avviser gjentatte raske rapporter fra samme IP — implementert (5/time per IP)
- [x] `npx tsc --noEmit` OG `npm run build` grønt
