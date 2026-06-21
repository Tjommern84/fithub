# "Søk her i stedet"-knapp + tag-filter-fiks – Proposal

## Sammendrag
Bygger om den nettopp leverte "Sentrer på kart"-knappen (ren visuell panorering) til en reell "Søk her i stedet"-knapp som flytter den lagrede lokasjonen og kjører søket på nytt forankret der. Fikser samtidig to reelle bugs i søk-fallback-kjeden som gjorde at tag-filtre (f.eks. "Ishockey") ikke filtrerte resultater når søket havnet i Tier 2/3.

## Hva
1. **"Søk her i stedet"** (erstatter "📍 Sentrer på kart"): klikk på et treff oppdaterer `LocationContext` (toppfanen) til treffets sted, fjerner fritekst-søket (`q`), beholder hovedkategori (`cat`) og aktive tag-filtre, kjører søket på nytt forankret på det nye stedet
2. **Bugfiks A**: Tier 2 i `searchServicesWithFallback()` bruker i dag `query: remainder || params.query` — når et helt søk konsumeres av et stedsnavn (remainder=`''`), faller den feilaktig tilbake til HELE original-søketeksten i stedet for å søke uten tekstfilter. Fiks: bruk `remainder` direkte
3. **Bugfiks B**: `search_services_unanchored()` (Tier 3) støtter ikke `p_tags` i det hele tatt — tag-filtre har ingen effekt på Tier 3-resultater. Fiks: legg til `p_tags text[] DEFAULT NULL`-parameter

## Hvorfor
Brukeren testet: lokasjon=Oslo, søkte "Drammen" innenfor Sport → fikk treff i Drammen (via fallback-kjeden). Trykket "Sentrer på kart" og huket av "Ishockey" — ingen filtrering skjedde. Root cause: søket havnet i Tier 2/3 pga. de to bugene over, og siden lokasjonen aldri faktisk flyttet seg (kun visuell panorering), forble fritekst-søket "drammen" liggende i URL-en og fortsatte å trigge samme fallback-kjede ved hvert tag-klikk.

## Scope
- `components/CategoryGrid`-relatert: ingen endring
- `lib/locationContext.tsx`: ingen endring (gjenbruker eksisterende `setLocation`)
- `app/resultater/ResultsView.tsx`: bytt knapp-oppførsel fra `focusedCoords`-panorering til reelt lokasjonsbytte
- `lib/matchingDb.ts`: fiks Tier 2-remainder-bug, legg til `tags` i `UnanchoredSearchParams`
- `sql/27_search_unanchored_tags.sql`: legg til `p_tags` på `search_services_unanchored()` (DROP FUNCTION + GRANT, samme mønster som tidligere)
- `components/ServiceMap.tsx`: `FlyToPoint`/`focusedCoords` fra forrige leveranse kan fjernes eller la stå urørt (ikke i bruk lenger om knappen nå navigerer i stedet for å panorere) — avgjøres i design

## Ikke i scope
- Endring av selve `search_services()` (Tier 1) — uendret
- Ny UI for å bytte tilbake til opprinnelig lokasjon (bruker kan gjøre dette manuelt via toppfanen som i dag)

## Suksesskriterier
- [x] Klikk på "Søk her i stedet" flytter lokasjonen i toppfanen til treffets sted og fjerner fritekst-søket — verifisert via kode+nettverkstest, ikke separat re-bekreftet av bruker i browser etter at "Smart søk"-baren overtok samme jobb i `samlet-sok-lokasjon`
- [x] Aktive tag-filtre beholdes og fungerer korrekt på det nye stedet
- [x] Brukerens opprinnelige scenario (Oslo → søk "Drammen" i Sport) bekreftet via ekte Tier 2-treff (50 sportsklubber, banner vist) — selve Ishockey-tag-klikket ikke separat observert i browser, men tag-filtrering i seg selv var allerede bekreftet fungerende fra tidligere i sesjonen
- [x] `npx tsc --noEmit` grønt
