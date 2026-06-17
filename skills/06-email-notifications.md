# Domene 6 – E-post & Varsling

## Formål
Håndterer all utgående e-postkommunikasjon: leads, bookinger, invitasjoner og brukerhenvendelser via kontaktskjema.

## Filer
| Fil | Rolle |
|-----|-------|
| `lib/emailClient.ts` | Avsending via Resend SDK – singleton e-postklient |
| `lib/emailTemplates.ts` | HTML-maler for leads, bookinger, invitasjoner |
| `lib/notificationPreferences.ts` | Brukernes e-postpreferanser (deles med Domene 5) |
| `app/kontakt/page.tsx` | Kontaktside |
| `app/kontakt/ContactForm.tsx` | Kontaktskjema (client) |
| `app/kontakt/actions.ts` | Server action – validerer og sender e-post |

## Nøkkelflyter

### Lead-varsling
```
Ny lead opprettes i Domene 4
  → actions.ts i Domene 4 kaller emailClient.ts
  → notificationPreferences.ts sjekkes: vil tilbyder ha e-post?
  → emailTemplates.ts genererer lead-mal
  → emailClient.ts sender via Resend
```

### Bookingbekreftelse
```
Booking bekreftes i Domene 4
  → actions/bookings.ts kaller emailClient.ts
  → To e-poster sendes: én til bruker, én til tilbyder
  → emailTemplates.ts bruker booking-mal med tidspunkt og detaljer
```

### Invitasjons-e-post
```
Admin/org inviterer bruker (Domene 8/9)
  → emailTemplates.ts genererer invitasjons-mal med token-link
  → emailClient.ts sender til invitert e-postadresse
```

### Kontaktskjema
```
Bruker fyller ut /kontakt
  → ContactForm.tsx sender til actions.ts
  → actions.ts validerer input
  → emailClient.ts videresender til support-adresse
```

## Kritiske gotchas

- **Resend SDK er eneste avsender**: All e-postutsending MÅ gå via `emailClient.ts` — ikke opprett separate Resend-instanser i andre domener. Dette sikrer konsistent feilhåndtering og logging.
- **Sjekk notificationPreferences før sending**: Respekter alltid brukerens preferanser. Send aldri e-post til brukere som har deaktivert varsler for den aktuelle typen.
- **HTML-maler er ikke React**: `emailTemplates.ts` genererer ren HTML-strenger — ikke JSX. Hold malene enkle og e-postklient-kompatible (inline CSS, ingen flexbox/grid).
- **feature-flagg for e-post**: `featureFlags.ts` har `emails`-flagg. Sjekk dette før sending i alle domener — i pilot/dev-modus bør e-poster ikke sendes til ekte brukere.
- **Kontaktskjema-actions er offentlig**: `app/kontakt/actions.ts` kan kalles uten auth — implementer rate limiting eller honeypot mot spam.

## Avhengigheter til andre domener
- **Domene 4** – kaller `emailClient.ts` ved leads og bookinger
- **Domene 5** – `notificationPreferences.ts` eies konseptuelt her men brukes i begge domener
- **Domene 7** – `featureFlags.ts` styrer om e-poster faktisk sendes
- **Domene 8** – invitasjons-e-poster ved org-onboarding
- **Domene 9** – admin kan trigge e-poster manuelt

## Vanlige oppgaver

### Legg til ny e-postmal
1. Legg til ny funksjon i `lib/emailTemplates.ts` som returnerer `{ subject, html }`
2. Hold HTML enkel: inline CSS, tabellayout for e-postklientkompatibilitet
3. Test i faktisk e-postklient (Gmail, Outlook) — ikke bare nettleser
4. Kall den nye malen fra relevant server action i riktig domene

### Endre eksisterende mal
1. Rediger relevant funksjon i `lib/emailTemplates.ts`
2. Verifiser at alle variabler som sendes inn fortsatt matcher mal-signaturen
3. Send test-e-post med `emailClient.ts` direkte (kan gjøres fra script)

### Legg til ny notifikasjonstype
1. Legg til ny nøkkel i preferanse-objekt i `lib/notificationPreferences.ts`
2. Oppdater `app/min-side/page.tsx` (Domene 5) med ny toggle for brukeren
3. Implementer preferansesjekk i server action som sender den nye e-posttypen

### Debugging av e-poster som ikke sendes
1. Sjekk `emails`-flagg i `lib/featureFlags.ts` — er det slått av?
2. Sjekk `notificationPreferences` for den aktuelle brukeren
3. Logg Resend API-respons i `emailClient.ts` — Resend returnerer feil-objekt ved mislykket sending
4. Verifiser at Resend API-nøkkel er satt i miljøvariabler (`RESEND_API_KEY`)
5. Sjekk Resend-dashboardet for bounces eller blokkerte adresser
