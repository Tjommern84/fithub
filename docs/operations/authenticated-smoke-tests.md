# Autentiserte smoketester

`npm run test:production` tester alltid de offentlige sidene og at `/dashboard` og `/min-side` avviser en anonym bruker korrekt.

Den samme testen validerer også innlogget dashboard og Min side når disse fire GitHub Actions-secrets finnes:

- `SMOKE_SUPABASE_URL`
- `SMOKE_SUPABASE_ANON_KEY`
- `SMOKE_AUTH_EMAIL`
- `SMOKE_AUTH_PASSWORD`

Bruk en separat, minst privilegert Supabase-testbruker. Testen logger inn via Supabase Auth sitt password-endepunkt, legger sesjonen i en isolert Playwright-kontekst og utfører ingen skjemaendringer, bestillinger eller andre produksjonsskrivinger.

`SMOKE_SUPABASE_URL` og `SMOKE_SUPABASE_ANON_KEY` brukes også som appens offentlige Supabase-verdier under CI-bygget. Uten dem blir innloggingsklienten utelatt fra den kompilerte appen, og den autentiserte testen kan ikke være representativ.

Hvis ingen av variablene er satt, markeres den autentiserte delen som `not-configured`. Delvis oppsett stopper testen for å unngå falsk trygghet.

Roter passordet straks dersom det eksponeres. Testkontoen skal ikke eie tjenester, ha adminrolle eller ha andre rettigheter enn en vanlig innlogget bruker.
