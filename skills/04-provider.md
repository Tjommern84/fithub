# Domene 4 – Tilbyder / Provider

## Formål
Håndterer alt på tilbydersiden: detaljsider for tjenesteleverandører, leads, bookinger, vurderinger og tilbydernes eget dashboard.

## Filer
| Fil | Rolle |
|-----|-------|
| `app/tilbyder/[id]/page.tsx` | Server – metadata, hurtigbuffer |
| `app/tilbyder/[id]/ProviderClient.tsx` | Client – modal, vurderinger, tilgjengelighet, krav/lead |
| `app/tilbyder/[id]/actions.ts` | Server actions – krav, leads, vurderinger |
| `lib/booking.ts` | Booking-typer, -labels, tidsformatering, tilgjengelighet |
| `app/api/availability/route.ts` | Hent ledige tidspunkter |
| `app/actions/bookings.ts` | Bekreft/avlys/no-show booking |
| `app/dashboard/page.tsx` | Tilbyder-dashboard – egne tjenester, leads, bookinger |
| `app/dashboard/actions.ts` | Server actions for dashboard |
| `app/dashboard/leads/[id]/page.tsx` | Lead-detaljside |
| `app/dashboard/leads/[id]/actions.ts` | Lead-handlinger |

## Nøkkelflyter

### Bruker sender krav/lead
```
Bruker åpner /tilbyder/[id]
  → page.tsx henter service + metadata (server, cachet)
  → ProviderClient rendres
  → Bruker klikker "Kontakt" / "Send krav"
  → Modal åpnes i ProviderClient
  → actions.ts oppretter lead i leads-tabellen
  → E-post sendes via Domene 6
  → Tilbyder ser lead i dashboard
```

### Booking-flyt
```
Lead godkjennes av tilbyder
  → actions/bookings.ts oppretter booking (status: confirmed)
  → availability/route.ts oppdaterer ledige tider
  → Bruker får bekreftelse via Domene 6
  → Tilbyder kan markere no-show eller avlyse
```

### Tilbyder-dashboard
```
Tilbyder logger inn → /dashboard
  → dashboard/page.tsx henter egne tjenester, leads, bookinger
  → Tilbyder kan se leaddetaljer på /dashboard/leads/[id]
  → dashboard/actions.ts håndterer statusendringer
```

## Databasetabeller

### leads
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| `id` | uuid | Primærnøkkel |
| `service_id` | uuid | FK til services |
| `user_id` | uuid | FK til profiles |
| `status` | enum | new/contacted/closed |

### bookings
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| `id` | uuid | Primærnøkkel |
| `lead_id` | uuid | FK til leads |
| `service_id` | uuid | FK til services |
| `scheduled_at` | timestamptz | Avtalt tidspunkt |
| `status` | enum | confirmed/cancelled/no_show |

### reviews
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| `service_id` | uuid | FK til services |
| `user_id` | uuid | FK til profiles |
| `rating` | int | 1–5 |

## Kritiske gotchas

- **Server action sikkerhet**: Alle actions i `actions.ts` og `bookings.ts` MÅ verifisere at innlogget bruker har rettighet til operasjonen. Tilbyder kan bare endre egne leads/bookinger.
- **Cache på tilbyderside**: `page.tsx` bruker hurtigbuffer — ved endringer i service-data (f.eks. etter import) må cache invalideres via `lib/cacheInvalidation.ts` (Domene 9).
- **Tilgjengelighet og race conditions**: `availability/route.ts` bør håndtere samtidige bookingforsøk — sjekk at ingen booking opprettes for allerede booket tid.
- **Dashboard er kun for tilbydere**: Verifiser alltid at bruker eier tjenesten før dashboard-data vises. Bruk RLS + server-side sjekk.
- **React 18.2**: Bruk `useFormState`/`useFormStatus` fra `react-dom` — ikke `useActionState`.

## Avhengigheter til andre domener
- **Domene 1** – søkeresultater lenker til `/tilbyder/[id]`
- **Domene 5** – bruker `profiles` for brukerinfo på leads
- **Domene 6** – sender e-post ved nye leads og bookingbekreftelser
- **Domene 7** – bruker `supabaseClient.ts`, `serviceSupabase.ts`, `domain.ts`-typer, `featureFlags.ts` (reviews, payments)
- **Domene 8** – betalingsstatus fra Stripe påvirker om tilbyder kan motta leads

## Vanlige oppgaver

### Legg til nytt felt på lead-skjema
1. Legg til felt i lead-modal i `ProviderClient.tsx`
2. Oppdater server action i `actions.ts` for å håndtere og lagre feltet
3. Legg til kolonne i `leads`-tabellen hvis nødvendig
4. Oppdater `dashboard/leads/[id]/page.tsx` for å vise nytt felt

### Endre booking-statuser
1. Oppdater enum i SQL-migrasjon
2. Oppdater `lib/booking.ts` med nye typer og labels
3. Oppdater UI i dashboard og `ProviderClient.tsx`
4. Sjekk at e-postvarsler i Domene 6 sender riktig mal for ny status

### Debugging av leads som ikke vises i dashboard
1. Sjekk at `service_id` på lead matcher tilbyderens tjeneste
2. Verifiser RLS — tilbyder skal bare se egne leads
3. Sjekk at `dashboard/actions.ts` henter med riktig bruker-id
4. Bruk `serviceSupabase.ts` for server-side debugging (bypass RLS)

### Slå på/av reviews-funksjon
1. Endre `reviews`-flagg i `lib/featureFlags.ts`
2. `ProviderClient.tsx` sjekker dette flagget — ingen kodeendring nødvendig
