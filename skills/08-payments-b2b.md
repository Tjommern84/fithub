# Domene 8 – Betaling & Organisasjon (B2B)

## Formål
Håndterer Stripe-betalinger for individuelle og organisasjonsabonnement, samt bedriftskontoer med join-koder og lead-attribusjon.

## Filer
| Fil | Rolle |
|-----|-------|
| `lib/stripe.ts` | Stripe SDK – individuelt abonnement |
| `lib/stripeB2B.ts` | Stripe SDK – organisasjonsabonnement |
| `lib/organizations.ts` | Org-administrasjon: subscription, join-code, lead-attribusjon |
| `app/org-dashboard/page.tsx` | Organisasjonsdashboard |
| `app/api/stripe/webhook/route.ts` | Stripe webhook – individ |
| `app/api/stripe/org-webhook/route.ts` | Stripe webhook – org |
| `app/invite/[token]/` | Invitasjonsaksept-flyt |

## Nøkkelflyter

### Individuelt abonnement
```
Bruker oppgraderer til Pro
  → stripe.ts oppretter Stripe Checkout Session
  → Bruker fullfører betaling på Stripe-siden
  → Stripe sender webhook til /api/stripe/webhook
  → webhook/route.ts verifiserer signatur
  → profiles.is_pro settes til true (Domene 5)
  → Tilgang til Pro-funksjoner åpnes
```

### Organisasjonsabonnement
```
Org-admin oppretter organisasjon
  → stripeB2B.ts oppretter Stripe Checkout for org
  → Betaling gjennomføres
  → Stripe sender webhook til /api/stripe/org-webhook
  → org-webhook/route.ts oppretter/oppdaterer org i organizations-tabell
  → Admin ser org-dashboard på /org-dashboard
```

### Invitasjonsflyt
```
Org-admin inviterer medarbeider
  → organizations.ts genererer unik join-code/token
  → Invitasjons-e-post sendes via Domene 6
  → Invitert bruker klikker link → /invite/[token]
  → invite/[token] validerer token og knytter bruker til org
```

### Lead-attribusjon
```
Org-bruker sender lead
  → organizations.ts attribuerer lead til organisasjonen
  → Lead vises i org-dashboard med brukerinformasjon
```

## Databasetabell: organizations
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| `id` | uuid | Primærnøkkel |
| `name` | text | Organisasjonsnavn |
| `join_code` | text | Unik kode for å bli med |
| `stripe_customer_id` | text | Stripe customer ID |
| (+ abonnement-felt) | | Status, periode, plan |

## Kritiske gotchas

- **Stripe webhook-signaturverifisering er obligatorisk**: Alltid verifiser `Stripe-Signature`-header med `stripe.webhooks.constructEvent()`. Uten dette kan webhook-endepunkter misbrukes til å sette `is_pro = true` uten betaling.
- **`payments`-feature-flagg**: Sjekk `featureFlags.payments` (Domene 7) — i dev/pilot-modus bør ikke ekte Stripe-transaksjoner startes.
- **To separate Stripe-klienter**: `stripe.ts` og `stripeB2B.ts` kan ha ulike Stripe-produkter/priser. Ikke bland dem — individuelle priser skal aldri brukes for org og vice versa.
- **Webhook idempotens**: Stripe kan sende samme webhook flere ganger. Implementer idempotenssjekk (f.eks. lagre behandlede event-IDer) for å unngå doble oppdateringer.
- **Join-kode sikkerhet**: Join-koder bør være tilfeldig genererte og ha utløpsdato. Aldri la join-koder stå aktive på ubestemt tid.
- **Miljøvariabler for Stripe**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, og B2B-ekvivalenter MÅ være satt i produksjon. Appen feiler stille hvis disse mangler.

## Avhengigheter til andre domener
- **Domene 5** – `profiles.is_pro` oppdateres av webhooks herfra
- **Domene 6** – invitasjons-e-poster sendes via `emailClient.ts`
- **Domene 7** – `featureFlags.payments` styrer om betaling er aktiv; `serviceSupabase.ts` brukes i webhooks (server-only)
- **Domene 9** – admin kan se org-status og abonnement

## Vanlige oppgaver

### Endre abonnementspris
1. Oppdater Stripe-produkt/pris i Stripe-dashboardet
2. Oppdater price ID i `lib/stripe.ts` eller `lib/stripeB2B.ts`
3. Test med Stripe test-mode og Stripe CLI for webhook-simulering

### Debugging av webhook som ikke trigger
1. Verifiser at webhook-URL er registrert i Stripe-dashboardet
2. Sjekk at `STRIPE_WEBHOOK_SECRET` matcher det Stripe-dashboardet viser
3. Bruk `stripe listen --forward-to localhost:3000/api/stripe/webhook` for lokal testing
4. Sjekk Stripe-dashboardets webhook-logg for feiledde leveringsforsøk

### Legg til nytt Stripe-event
1. Legg til `case` i `webhook/route.ts` for nytt event-type
2. Implementer handling (f.eks. oppdater status, send e-post)
3. Test med Stripe CLI: `stripe trigger <event-type>`

### Tilbakestill org-abonnement manuelt
1. Bruk `serviceSupabase.ts` (server-only, bypass RLS)
2. Oppdater `organizations`-tabellen direkte
3. Sjekk Stripe-dashboardet for å synkronisere status
