# Anleggsregisteret-synk

Synken kjøres hver mandag kl. 03:27 UTC av GitHub Actions. Den kan også startes manuelt fra workflowen `Anleggsregisteret sync`.

## Oppsett

Legg disse hemmelighetene i GitHub-miljøet `Production`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Jobben stopper før skriving dersom planen overstiger 250 opprettelser, 1 000 oppdateringer eller 50 deaktiveringer. Grensene ligger i `anlegg:sync:guard` i `package.json`.

## Kontroll og varsling

Hver plan og synk skriver antall opprettelser, oppdateringer, deaktiveringer og feil til GitHub Actions-jobbsammendraget. En feil markerer workflowen som feilet og bruker GitHubs vanlige Actions-varsling.

Ved en stopp på endringsgrensen:

1. Les den fullstendige planen i workflowloggen.
2. Kontroller at endringene skyldes forventede API-data eller en bevisst mappingendring.
3. Juster grensen midlertidig og kjør workflowen manuelt, eller kjør `npm run anlegg:sync` fra et kontrollert miljø.

Lokal skrivebeskyttet kontroll: `npm run anlegg:sync:plan`.
