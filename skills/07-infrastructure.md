# Domene 7 – Infrastruktur & Felles

## Formål
Delte verktøy, klienter, typer og UI-komponenter som alle andre domener er avhengige av. Endringer her kan ha ripple-effekter på hele appen.

## Filer
| Fil | Rolle |
|-----|-------|
| `lib/supabaseClient.ts` | Supabase anon-klient (singleton, brukes client-side og i server components) |
| `lib/serviceSupabase.ts` | Supabase service-role-klient (kun server, bypass RLS) |
| `lib/featureFlags.ts` | Boolean feature-flagg: reviews, payments, admin, emails, pilot |
| `lib/errorLogger.ts` | Feillogging til Supabase `errors`-tabell |
| `lib/actionWrapper.ts` | Innpakker for server actions med fangst og logging |
| `lib/analytics.ts` | Event-sporing: search, lead, click |
| `lib/ui.ts` | Tailwind CSS-konstanter: container, button, card, input |
| `lib/domain.ts` | Kjerne TypeScript-typer: `Service`, `CoverageRule`, `ServiceType`, `Goal` |
| `lib/providers.ts` | Statisk/fallback tjenesteliste |
| `components/ui/Button.tsx` | Knapp med varianter |
| `components/ui/Card.tsx` | Kortlayout |
| `components/ui/Input.tsx` | Input-felt |
| `components/ui/Chip.tsx` | Chip/badge |
| `next.config.js` | Next.js-konfig (cache-headers for `/bilder/*`) |

## Kritiske gotchas

- **`serviceSupabase.ts` kun på server**: Service-role-klienten har full tilgang og bypass av RLS. Importer ALDRI denne i client components eller filer som kan bundles til klienten. Bruk `supabaseClient.ts` client-side.
- **`actionWrapper.ts` bør brukes i alle server actions**: Wrapper fanger uventede feil og logger til `errorLogger.ts`. Server actions uten wrapper gir stumme feil i produksjon.
- **Cache-headers for bilder**: `next.config.js` setter `Cache-Control: public, max-age=31536000, immutable` for `/bilder/*`. Endre aldri denne pathen uten å oppdatere cache-regler.
- **`featureFlags.ts` er ikke dynamisk**: Flaggene er hardkodede booleans — ikke DB-baserte. Endringer krever deploy. Vurder om noe bør gjøres dynamisk hvis hyppig toggling er nødvendig.
- **TypeScript-typer i `domain.ts` er fundamentale**: Alle domener importerer herfra. En breaking change i f.eks. `Service`-typen krever oppdatering i alle domener som bruker den.
- **`lib/ui.ts` Tailwind-konstanter**: Bruk disse for konsistens. Skriv ikke egne Tailwind-klassestrenger der konstanter dekker behovet.

## Feature-flagg oversikt
| Flagg | Påvirker | Beskrivelse |
|-------|---------|-------------|
| `reviews` | Domene 4 | Viser/skjuler vurderinger på tilbydersider |
| `payments` | Domene 8 | Aktiverer Stripe-betalingsflyt |
| `admin` | Domene 9 | Aktiverer admin-panel |
| `emails` | Domene 6 | Slår av/på all e-postutsending |
| `pilot` | Alle | Pilot-modus – begrenset tilgang |

## Nøkkelflyter

### Feilhåndtering
```
Server action feiler
  → actionWrapper.ts fanger feilen
  → errorLogger.ts skriver til errors-tabell i Supabase
  → Strukturert feilrespons returneres til klient
```

### Analytics-sporing
```
Bruker søker / klikker lead / klikker tjeneste
  → analytics.ts kalles med event-type og metadata
  → Event lagres i events-tabell (service_id, user_id, type)
```

## Avhengigheter
Dette domenet er fundamentalt — alle andre domener avhenger av det. Domene 7 avhenger selv av ingenting i FitHub-kodebasen.

## Vanlige oppgaver

### Legg til nytt TypeScript-type
1. Legg til i `lib/domain.ts`
2. Eksporter og importer i relevant domene
3. Sjekk om eksisterende typer bør oppdateres for konsistens

### Slå av feature midlertidig
1. Sett flagg til `false` i `lib/featureFlags.ts`
2. Deploy
3. Ingen annen kodeendring nødvendig — alle domener sjekker flagget

### Legg til ny UI-komponent
1. Opprett i `components/ui/`
2. Følg mønsteret fra eksisterende komponenter (varianter via props)
3. Legg til relevante Tailwind-konstanter i `lib/ui.ts` om nødvendig

### Legg til nytt analytics-event
1. Legg til ny event-type i `lib/analytics.ts`
2. Kall fra relevant sted i riktig domene
3. Verifiser at `events`-tabellen i Supabase har riktige kolonner

### Debugging av stumme server action-feil
1. Sjekk `errors`-tabellen i Supabase for nylige logginnslag
2. Verifiser at server action er pakket inn med `actionWrapper.ts`
3. Sjekk miljøvariabler — manglende env-vars gir ofte stumme feil ved klientinitialisering
