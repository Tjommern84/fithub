# Sentry i produksjon

Appen initialiserer Sentry i `instrumentation.ts` og `instrumentation-client.ts` og fanger feil fra begge Next.js-feilgrensene. Uten DSN fortsetter appen å fungere, men logger en tydelig advarsel om at ekstern overvåking er deaktivert.

Legg disse verdiene i Vercel for Production, Preview og Development:

- `NEXT_PUBLIC_SENTRY_DSN`: prosjektets offentlige DSN.
- `SENTRY_ORG`: organisasjonens slug.
- `SENTRY_PROJECT`: prosjektets slug.
- `SENTRY_AUTH_TOKEN`: en CI-token med tilgang til opplasting av sourcemaps. Denne er hemmelig.

Etter oppsett:

1. Kjør en ny Vercel-deploy slik at klientens offentlige DSN bygges inn.
2. Bekreft at sourcemaps lastes opp i byggeloggen.
3. Send en kontrollert testfeil fra Sentry-oppsettet og kontroller at hendelsen viser riktig production-miljø og lesbar stacktrace.

Ikke legg DSN eller token i kildekoden. Token skal bare ligge som en beskyttet Vercel-miljøvariabel.
