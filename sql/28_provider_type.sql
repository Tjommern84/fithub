-- ============================================
-- provider_type — skiller "business" (har/kan ha en tilbyder) fra "facility"
-- (offentlig anlegg uten tilbyder, f.eks. Anleggsregisteret/tuftepark-import).
-- text, ikke boolean — domenet har gråsoner (f.eks. idrettslag), se design.md.
--
-- Inkluderer også engangs-datakorreksjon (Steg 4): alle 5020 anl_%-rader
-- mangler service_types fullstendig (bekreftet i Steg 0), så de dukker aldri
-- opp i tag-filtrert "Utendørs"-søk. tp_%-rader er IKKE affisert (alle 18 har
-- allerede korrekt service_types) — derfor kun anl_% i datakorreksjonen.
-- ============================================

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS provider_type text NOT NULL DEFAULT 'business'
  CHECK (provider_type IN ('business', 'facility'));

-- Rettet prefiks (bekreftet i Steg 0): tu_% finnes ikke i databasen, kun
-- anl_% og tp_%. Design.md sin opprinnelige tu_%-referanse var feil.
UPDATE services SET provider_type = 'facility'
WHERE id LIKE 'anl_%' OR id LIKE 'tp_%';

CREATE INDEX IF NOT EXISTS idx_services_provider_type ON services (provider_type);

-- Datakorreksjon: legg til manglende service_types(outdoor) for anl_%-rader.
-- Idempotent — trygt å re-kjøre (NOT EXISTS-vakt).
INSERT INTO service_types (service_id, type)
SELECT s.id, 'outdoor'
FROM services s
WHERE s.id LIKE 'anl_%'
  AND NOT EXISTS (
    SELECT 1 FROM service_types st
    WHERE st.service_id = s.id AND st.type = 'outdoor'
  );
