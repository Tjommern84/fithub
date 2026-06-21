# Idrett-illustrasjoner + "Rapporter feil"-flagg – Design

> Full kontekst/research finnes i den opprinnelige planen brukeren godkjente. Sammendrag her.

## Del A — Illustrasjonsikoner

### `lib/serviceIllustrations.tsx` (ny fil)
- `SPORT_ICON_KEYWORDS: { keywords: string[]; label: string; icon: ReactNode }[]` — ordnet liste,
  førstetreff vinner. Inline hånd-tegnede SVG-er i samme stil som
  `components/home/HomeValueProps.tsx` (`currentColor`, `strokeWidth={2}`). Start-idretter:
  håndball, fotball, kampsport (karate/judo/taekwondo/boksing), ski/skiløype, svømming, tennis,
  basketball, volleyball, badminton, yoga, styrke/vektløfting, løping/kondisjon.
- `TYPE_FALLBACK_ICON: Record<ServiceType, ReactNode>` — ett ikon per `ServiceType`
  (14 verdier, `lib/domain.ts`).
- `getServiceIllustration({ type, name }: { type: ServiceType; name: string })`: matcher
  `name.toLowerCase()` mot `SPORT_ICON_KEYWORDS` (uavhengig av `type`), faller tilbake til
  `TYPE_FALLBACK_ICON[type]`.

### Bruk
- `components/home/HomeNearbyActivities.tsx`: i bilde-boksen, når `cover_image_url` er `null`,
  render `getServiceIllustration(item.service)` sentrert på en myk bakgrunn (f.eks.
  `bg-brand-cream`) i stedet for tom `bg-slate-100`.
- `app/resultater/ResultsView.tsx`: samme i `ServiceCard` og `UnanchoredServiceCard` sine
  bilde-seksjoner.
- Ingen endring i `lib/matchingDb.ts`/`lib/categoryConfig.ts` — kun rendering, `type`+`name`
  finnes allerede på objektene.

## Del B — "Rapporter feil"

### Schema (`sql/30_service_reports.sql` — bekreft neste ledige nummer med `ls sql/` først)
```sql
ALTER TABLE services ADD COLUMN reported_at timestamptz DEFAULT NULL;

CREATE TABLE service_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id text REFERENCES services(id),
  reason text,
  reporter_ip_hash text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE service_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_reports_insert_anon ON service_reports FOR INSERT TO anon WITH CHECK (true);
-- Ingen SELECT-policy for anon — kun service_role (admin) leser denne tabellen
```
`search_services()`: legg til `AND s.reported_at IS NULL` i `WHERE`-klausulen (samme sted som
`s.is_active = true`). Ingen endring i `RETURNS TABLE`/parameterliste — DROP+CREATE likevel, som
forsiktighetsregel, siden hele funksjonskroppen erstattes.

**`reporter_ip_hash`**: hash IP-en (f.eks. enkel SHA-256 via Node sin `crypto`-modul) før lagring
— ikke lagre rå IP, av samme grunn som man ikke lagrer annen PII rått.

### Server action (`app/tilbyder/[id]/actions.ts`)
```ts
export async function reportService(serviceId: string, reason: string) {
  // rate-limit per IP (gjenbruk lib/rateLimit.ts sitt eksisterende mønster)
  // INSERT INTO service_reports (service_id, reason, reporter_ip_hash)
  // UPDATE services SET reported_at = now() WHERE id = $1
  // return { ok: boolean; message: string }
}
```

### `components/ReportIssueModal.tsx` (ny, etter `FeedbackModal.tsx`-mønster)
Props: `{ serviceId: string; serviceName: string; open: boolean; onClose: () => void }`.
Hurtigvalg-chips ("Nedlagt/stengt", "Feil informasjon", "Duplikat", "Annet") + valgfritt
fritekstfelt, `useFormState` + `reportService`, samme success/error-styling som `FeedbackModal`.

### Knapp-plassering
- `app/resultater/ResultsView.tsx`: liten "Rapporter feil"-tekstlenke i footer-raden på
  `ServiceCard`/`UnanchoredServiceCard`, ved siden av "Se full profil →"/`SearchHereButton`.
- `app/tilbyder/[id]/ProviderClient.tsx`: liten lenke under Kontakt-seksjonen, samme
  modal-state-mønster som `openRequestModal`.

## CLAUDE.md-gotcha å legge til ved ferdigstillelse
Umiddelbar skjuling ved første rapport er en bevisst forenkling for denne runden — ingen
terskel/admin-godkjenning før raden skjules. Risiko: kan misbrukes til å skjule konkurrenters
oppføringer. **Må revurderes før launch.**
