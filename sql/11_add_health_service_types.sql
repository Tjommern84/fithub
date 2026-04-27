-- ============================================
-- Legg til rehab, ernæring og helse som gyldige service_types
-- Kjør i Supabase SQL Editor
-- ============================================

ALTER TABLE service_types DROP CONSTRAINT IF EXISTS service_types_type_check;

ALTER TABLE service_types ADD CONSTRAINT service_types_type_check CHECK (type IN (
  'styrke', 'pt', 'yoga', 'gruppe', 'kondisjon', 'outdoor',
  'sport', 'mindbody', 'spesialisert', 'livsstil', 'teknologi',
  'rehab', 'ernæring', 'helse'
));
