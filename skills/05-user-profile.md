# Domene 5 – Bruker (Min Side)

## Formål
Håndterer brukerkonto, profil, notifikasjonsinnstillinger, samtykke (GDPR) og telefonverifisering.

## Filer
| Fil | Rolle |
|-----|-------|
| `app/min-side/page.tsx` | Brukeroversikt – forespørsler, bookinger, anbefalinger, telefon, bedrift |
| `lib/notificationPreferences.ts` | E-postvarslingsinnstillinger (deles med Domene 6) |
| `lib/consents.ts` | Samtykke-håndtering (vilkår, personvern) |
| `lib/gdpr.ts` | GDPR datautdrag og sletteanmodning |
| `components/ConsentGate.tsx` | Modal-gate – blokkerer tilgang til bruker har samtykket |
| `app/api/recommendations/route.ts` | Anbefalings-API |
| `app/actions/recommendations.ts` | Anbefalingsmotor |

## Nøkkelflyter

### Bruker logger inn (første gang)
```
Bruker autentiserer via Supabase Auth
  → ConsentGate sjekker consents-tabellen
  → Hvis manglende samtykke → modal vises
  → Bruker aksepterer vilkår og personvern
  → consents.ts lagrer samtykke med timestamp
  → Bruker slippes inn til /min-side
```

### Telefonverifisering
```
Bruker navigerer til /min-side
  → min-side/page.tsx sjekker profiles.phone_verified_at
  → Hvis null → telefonverifiserings-seksjon vises
  → Bruker oppgir telefonnummer
  → SMS-kode sendes (Supabase Auth eller ekstern provider)
  → profiles.phone_verified_at settes ved vellykket verifisering
```

### GDPR-forespørsel
```
Bruker ber om datautdrag
  → gdpr.ts samler data fra alle relevante tabeller
  → Returneres som JSON-nedlasting
Bruker ber om sletting
  → gdpr.ts setter slette-flag / anonymiserer data
  → Sensitive felt nullstilles, ikke hard-slettet (audit trail)
```

### Anbefalinger
```
Bruker besøker /min-side
  → recommendations/route.ts kalles
  → actions/recommendations.ts analyserer brukerhistorikk
  → Returnerer anbefalte tjenester basert på tidligere søk/leads
```

## Databasetabell: profiles
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| `id` | uuid | Primærnøkkel (= auth.users.id) |
| `email` | text | Brukerens e-post |
| `full_name` | text | Fullt navn |
| `phone` | text | Telefonnummer |
| `phone_verified_at` | timestamptz | Tidspunkt for verifisering (null = ikke verifisert) |
| `is_pro` | boolean | Pro-abonnement (Domene 8) |

## Kritiske gotchas

- **`phone_verified_at` er kritisk for Domene 3**: Gruppetime-opprettelse krever at dette feltet IKKE er null. Endringer i verifiseringslogikk her påvirker Domene 3 direkte.
- **ConsentGate er global blokkering**: Endringer i `ConsentGate.tsx` kan påvirke alle innloggede brukerflyter. Test nøye ved endringer.
- **GDPR-sletting er myk**: Bruk aldri hard DELETE på `profiles` — anonymiser/null-stil sensitive felt for audit trail og FK-integritet.
- **`notificationPreferences.ts` deles med Domene 6**: Endringer her påvirker e-postutsendelse. Koordiner med e-postdomenet.
- **Anbefalinger er feature-flagget**: Sjekk `lib/featureFlags.ts` før du antar anbefalings-API er aktivt.
- **React 18.2**: Bruk `useFormState`/`useFormStatus` fra `react-dom` i skjema-komponenter.

## Avhengigheter til andre domener
- **Domene 3** – `phone_verified_at` er påkrevd for gruppetime-opprettelse
- **Domene 4** – `profiles` brukes for brukerinfo på leads og bookinger
- **Domene 6** – `notificationPreferences.ts` styrer hvilke e-poster sendes
- **Domene 7** – bruker `supabaseClient.ts`, `serviceSupabase.ts`
- **Domene 8** – `is_pro` på profil settes av Stripe-webhook

## Vanlige oppgaver

### Legg til nytt profilfelt
1. Legg til kolonne i `profiles`-tabellen (ny SQL-migrasjon, følg nummerering 04–11)
2. Oppdater TypeScript-typer i `lib/domain.ts` (Domene 7)
3. Legg til felt i `app/min-side/page.tsx`
4. Sjekk om feltet skal med i GDPR-utdrag (`lib/gdpr.ts`)

### Endre samtykkekrav
1. Oppdater `lib/consents.ts` med nye samtykketyper eller versjoner
2. Oppdater `ConsentGate.tsx` hvis ny modal-tekst eller nye samtykkebokser trengs
3. Eksisterende brukere med gammelt samtykke vil se gate igjen — vurder migrering

### Debugging av "kan ikke opprette gruppetime" (telefonrelatert)
1. Sjekk `profiles.phone_verified_at` for brukeren direkte i Supabase
2. Gå gjennom verifiseringsflyt i `min-side/page.tsx`
3. Sjekk at SMS-utsendelse fungerer (ekstern provider-status)

### Legg til ny anbefalingslogikk
1. Oppdater `app/actions/recommendations.ts` med ny scoring-logikk
2. Verifiser at `app/api/recommendations/route.ts` returnerer korrekt format
3. Sjekk at anbefalings-feature-flagg er aktivt i `lib/featureFlags.ts`
