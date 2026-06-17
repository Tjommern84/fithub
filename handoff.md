# FitHub – Handoff

> Delt tavle mellom alle agenter. Oppdateres etter hvert fullført arbeid.
> PM-agenten leser denne for å forstå status. Coding-agenter oppdaterer den når de er ferdige.

---

## Siste oppdateringer

### Backend
*(ingen endringer registrert ennå)*

### Frontend
*(ingen endringer registrert ennå)*

---

## Neste steg

| Agent | Oppgave | Blokkert av |
|-------|---------|-------------|
| *(tomt)* | | |

---

## Aktiv feature

*(ingen feature pågår — se specs/active/ for å starte en)*

---

## API-kontrakter (gjeldende)

> Oppdateres av backend-agenten når endepunkter endres. Frontend-agenten leser dette før implementasjon.

*(ingen kontrakter registrert ennå)*

---

## Modell-endringer (gjeldende)

> Oppdateres av backend-agenten når databaseskjema eller TypeScript-typer endres.

*(ingen endringer registrert ennå)*

---

## Komponent-endringer (gjeldende)

> Oppdateres av frontend-agenten når komponenter endres på en måte som kan påvirke andre.

*(ingen endringer registrert ennå)*

---

## Historikk

> Fullførte handoffs arkiveres her (nyeste øverst).

*(tomt)*

---

## Slik oppdaterer du denne filen

**Backend-agent** — etter fullført task:
```
### Backend ([dato])
- Lagt til endepunkt: GET /api/providers/nearby?lat=&lng=&radius=
  - Returnerer: { providers: Provider[], total: number }
- Endret Provider-type: nytt felt `verified_at: string | null`
- Breaking: /api/search returnerer nå paginert ({ data, page, total })
```

**Frontend-agent** — etter fullført task:
```
### Frontend ([dato])
- Refaktorert ProviderCard: ny prop `showDistance?: boolean`
- Søk-state flyttet til URL-params (?q=&lat=&lng=)
- Ny komponent: VerifiedBadge (src/components/ui/VerifiedBadge.tsx)
```

**PM-agent** — etter arkivert feature:
```
### Feature fullført: [feature-navn] ([dato])
- Spec arkivert til specs/done/[feature-navn]/
- CLAUDE.md oppdatert
```
