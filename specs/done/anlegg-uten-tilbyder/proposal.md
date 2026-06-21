# Stasjonære anlegg uten tilbyder – Proposal

## Sammendrag
Innfør en `provider_type`-distinksjon i `services` mellom vanlige kontaktbare bedrifter og stasjonære offentlige anlegg (tuftepark, hinderløyper m.m.), og fiks profilside/søkesynlighet/krev-flyt for sistnevnte.

## Hva
- Ny kolonne `provider_type` (`'business' | 'facility'`) på `services`
- Importscript-fiks: `import-anleggsregisteret.ts` skriver `orgnr` (ble lest men kastet bort), setter `provider_type`, legger til `service_types`-rad (manglet helt — derav at anlegg ikke dukker opp under "Utendørs")
- `/tilbyder/[id]`: egen, enklere visning for anlegg (adresse+kart, ingen krav-CTA, ingen kontakt-seksjon, ingen lead-knapp)
- Datakorreksjon: legg til `service_types(outdoor)` for eksisterende `anl_*`-rader
- Krev-flyt sikret mot å kunne "kreve" et anlegg

## Hvorfor
"Aktiviteter nær deg" på ny forside avdekket at anlegg (f.eks. "Hallermoen skole, hinderløype") ikke dukker opp i vanlig kategorisøk og gir "ingen tilbyder" ved klikk — symptom på at de er lagret som om de var vanlige bedrifter.

## Scope
- `sql/NN_provider_type.sql` (ny migrasjon)
- `scripts/import-anleggsregisteret.ts`, `scripts/push-tufteparker.ts`, `scripts/push-tufteparker-oslo.ts`
- `app/tilbyder/[id]/page.tsx`, `ProviderClient.tsx`, `actions.ts`
- `app/tilbyder/krev/[serviceId]/page.tsx`
- `lib/domain.ts`, `lib/matchingDb.ts`
- `sql/`-migrasjon for `search_services()` ny returkolonne
- `components/home/HomeNearbyActivities.tsx`

## Ikke i scope
- Sletting/re-import av data
- Full omskriving av coverage/base_location-logikk

## Suksesskriterier
- [x] Steg 0 (empiriske forhåndssjekker) gjennomført FØR kode skrives — fant en STØRRE og viktigere bug enn antatt (id-encoding, 41% av anlegg affisert), løst i Steg 0.5 før resten fortsatte
- [x] Hallermoen-raden + stikkprøve på 15 andre anlegg bekreftet løst for id-encoding-bugen (16/16)
- [x] Facility-modus på profilsiden (Kontakt→Adresse, Krev-notis, badge) — `sql/28`+`sql/29` kjørt av bruker 2026-06-20
- [x] Anlegg dukker opp under `/resultater?cat=utendors` etter datakorreksjon — migrasjon kjørt
- [x] Krev-flyt avvist for anlegg i kode (gater på `provider_type` før orgnr-sjekk)
- [x] "Aktiviteter nær deg" viser riktig badge for anlegg-kort i kode
- [x] `npx tsc --noEmit` OG `npm run build` grønt
