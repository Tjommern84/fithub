# Domene 3 – Gruppetimer & Arrangementer

## Formål
Håndterer brukeropprettede gruppeøkter og arrangementer: opprettelse, påmelding, gjentakelse og visning – bygget mai 2026.

## Filer
| Fil | Rolle |
|-----|-------|
| `sql/12_group_sessions.sql` | Tabeller: `group_sessions`, `session_participants`; profil-felt; RLS; indekser |
| `lib/groupSessions.ts` | CRUD + `nextOccurrence()` + `recurrenceLabel()` + profilverifisering |
| `components/GroupSessionCard.tsx` | Kortkomponent – dato, creator-badges, pris, deltakertall |
| `app/arrangementer/nytt/page.tsx` | Serverkomponent-innpakning for opprettelse |
| `app/arrangementer/nytt/CreateSessionForm.tsx` | Skjema (client) – auth-guard, telefonsjekk, alle felter |
| `app/arrangementer/[id]/page.tsx` | Detaljside (server) – henter session + deltakere |
| `app/arrangementer/[id]/SessionDetail.tsx` | Detaljvisning (client) – delta/meld av, creator-kort |
| `app/min-side/arrangementer/page.tsx` | Mine arrangementer – liste, avlys-funksjon |

## Nøkkelflyter

### Opprette gruppetime
```
Bruker navigerer til /arrangementer/nytt
  → page.tsx sjekker auth (server-side)
  → CreateSessionForm rendres
  → Auth-guard: bruker må være innlogget
  → Telefonsjekk: profiles.phone_verified_at IS NOT NULL
  → Bruker fyller ut skjema og sender
  → groupSessions.ts validerer og skriver til group_sessions
  → Bruker redirectes til /arrangementer/[id]
```

### Påmelding til arrangementt
```
Bruker åpner /arrangementer/[id]
  → page.tsx henter session + deltakerliste
  → SessionDetail rendres
  → Bruker klikker "Delta"
  → groupSessions.ts oppretter rad i session_participants
  → Deltakertall oppdateres optimistisk
```

### Gjentakende arrangementer
```
Session har recurrence_type (daglig/ukentlig/månedlig)
  → nextOccurrence() beregner neste dato fra starts_at + recurrence
  → recurrenceLabel() genererer lesbar tekst ("Hver onsdag")
  → GroupSessionCard viser neste dato og gjentakelsesinfo
```

## Databasetabeller

### group_sessions
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| `id` | uuid | Primærnøkkel |
| `creator_user_id` | uuid | FK til profiles |
| `starts_at` | timestamptz | Starttidspunkt |
| `recurrence_type` | enum | null/daglig/ukentlig/månedlig |
| `status` | enum | active/cancelled |
| (+ øvrige felt) | | Tittel, beskrivelse, pris, maks deltakere |

### session_participants
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| `session_id` | uuid | FK til group_sessions |
| `user_id` | uuid | FK til profiles |
| `status` | enum | registered/cancelled |

## RLS-regler
| Rolle | Tilgang |
|-------|---------|
| `anon` | SELECT på aktive sessions |
| `authenticated` (creator) | SELECT + UPDATE + DELETE på egne sessions |
| `authenticated` (deltaker) | INSERT/SELECT/DELETE på egne participant-rader |

## Kritiske gotchas

- **Telefonverifisering er påkrevd for å opprette**: Alltid sjekk `profiles.phone_verified_at IS NOT NULL` før du lar bruker opprette. `CreateSessionForm` gjør dette, men server actions i `groupSessions.ts` MÅ også validere (defense in depth).
- **React 18.2 skjemastate**: Bruk `useFormState`/`useFormStatus` fra `react-dom` — aldri `useActionState` (finnes ikke i 18.2).
- **RLS-nøkkel for anon**: Anon kan bare lese aktive sessions (`status = 'active'`). Avlyste sessions er ikke synlige for ikke-innloggede.
- **Gjentakelsesberegning**: `nextOccurrence()` beregner fra `starts_at` — hvis en session er i fortiden må logikken håndtere dette korrekt (ikke returnere fortidsdatoer).
- **Avlysning vs sletting**: Bruk alltid `status = 'cancelled'` fremfor hard DELETE for audit trail.

## Avhengigheter til andre domener
- **Domene 5** – bruker `profiles`-tabellen for telefonverifisering og creator-info
- **Domene 1** – `ResultsView` viser `GroupSessionCard` i søkeresultater
- **Domene 7** – bruker `supabaseClient.ts`, `serviceSupabase.ts` og TypeScript-typer fra `lib/domain.ts`

## Vanlige oppgaver

### Legg til nytt felt på gruppetime
1. Legg til kolonne i `sql/12_group_sessions.sql` (eller ny migrasjon)
2. Oppdater TypeScript-typer i `lib/groupSessions.ts`
3. Legg til felt i `CreateSessionForm.tsx` (client-skjema)
4. Oppdater `GroupSessionCard.tsx` og/eller `SessionDetail.tsx` hvis feltet skal vises
5. Sjekk RLS-regler — nye felt arver eksisterende RLS automatisk

### Legg til ny gjentakelsestype
1. Oppdater `recurrence_type` enum i SQL
2. Implementer logikk i `nextOccurrence()` i `lib/groupSessions.ts`
3. Legg til case i `recurrenceLabel()` for lesbar tekst
4. Oppdater dropdown-valg i `CreateSessionForm.tsx`

### Debugging av "kan ikke opprette arrangementt"
1. Sjekk at bruker er innlogget (auth-guard i `CreateSessionForm`)
2. Sjekk `profiles.phone_verified_at` — er telefon verifisert?
3. Sjekk RLS-regler i Supabase — har `authenticated` INSERT-rettigheter?
4. Sjekk server action i `groupSessions.ts` for valideringsfeil

### Avlys arrangementt som admin
1. Oppdater `status = 'cancelled'` via `serviceSupabase.ts` (service-role, bypass RLS)
2. Vurder varsling til deltakere via Domene 6 (e-post)
