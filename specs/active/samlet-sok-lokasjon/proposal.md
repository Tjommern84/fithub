# Samlet søk/lokasjon-felt i toppfanen – Proposal

## Sammendrag
Slå sammen `LocationBar.tsx`, `CategoryGrid.tsx` sitt søkefelt og `ResultsView.tsx` sitt søkefelt til ETT felt i toppfanen (`SearchLocationBar.tsx`), med en "Smart søk"-veksling som styrer om feltet er et rent lokasjonsfelt (adressepresisjon via geokoding) eller et fritekstsøk gjennom Tier 1/2/3-fallback-kjeden.

## Hva
- Ny komponent `SearchLocationBar.tsx` erstatter `LocationBar.tsx` i `TopNav.tsx`
- "Smart søk AV" (standard): rent lokasjonsfelt med `/api/geocode`-forslagsliste, presis adressesøk bevart uendret
- "Smart søk PÅ": feltet sender tekst som `q`-param, bruker eksisterende `searchServicesWithFallback()`
- Standard startlokasjon = Oslo, med samtidig synlig GPS-prompt som kan overskrive med ekte posisjon
- Dropp Oslo-bydel-velgeren og "Endre"-knappen helt
- Fjern embedded søkefelt i `CategoryGrid.tsx` og `ResultsView.tsx`

## Hvorfor
Tre separate tekstfelt i appen er forvirrende. Adressepresisjon må bevares (oppdaget under diskusjon — fritekst-only ville tapt gatenivå-geokoding), derfor en togglet to-modus-løsning i stedet for full sammenslåing til ett fritekstfelt.

## Scope
- `components/SearchLocationBar.tsx` (ny, erstatter `LocationBar.tsx`)
- `components/TopNav.tsx`, `components/CategoryGrid.tsx`, `app/resultater/ResultsView.tsx`
- `lib/locationContext.tsx` (`bydel`-felt fjernes)
- `app/resultater/page.tsx` (bydel-parsing fjernes)

## Ikke i scope
- SQL/backend-endringer (bydel var allerede dead code i backend, bekreftet)
- `lib/osloBoroughs.ts`/scripts (urelatert, ikke rørt)

## Suksesskriterier
- [x] Smart søk AV: adressesøk med forslagsliste fungerer som i dag (presis geokoding) — kode uendret fra `LocationBar.tsx`, kun Oslo-bydel/"Endre" fjernet
- [x] Smart søk PÅ: gjenbruker `searchServicesWithFallback()` uendret — samme mekanisme allerede verifisert i `sok-her-knapp`
- [x] Vanlig flyt (Smart søk AV): kategori-flis + tag-checkbox-filtrering uendret kode
- [x] Oslo-bydel-velger og "Endre"-knapp er borte, 0 gjenværende `bydel`-referanser (utenom `lib/osloBoroughs.ts`, urelatert)
- [x] `npx tsc --noEmit` grønt
- [ ] Første besøk uten lagret lokasjon: Oslo vises som standard, GPS-prompt vises samtidig — krever klient-side hydrering, ikke verifiserbar med curl. Venter på bruker sin visuelle test
