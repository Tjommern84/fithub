-- Migration 20: Legg til eksplisitt search_path på triggerfunksjoner
--
-- Anbefalt av sikkerhetsrapport juni 2026 (middels prioritet).
-- Forhindrer search_path-injeksjon: uten eksplisitt SET search_path
-- kan en angriper med CREATE SCHEMA-rettigheter omdirigere funksjonen
-- til å bruke egne skjema-objekter i stedet for de i public.
--
-- sync_service_rating har allerede search_path — inkluderes for
-- idempotens i tilfelle DB-versjonen er eldre enn lokal fil.

-- ── services_set_search_text ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.services_set_search_text()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_text :=
    lower(
      coalesce(NEW.name, '') || ' ' ||
      coalesce(NEW.description, '') || ' ' ||
      coalesce(array_to_string(NEW.tags, ' '), '')
    );
  RETURN NEW;
END;
$$;

-- ── update_group_sessions_updated_at ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_group_sessions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── update_admin_users_updated_at ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_admin_users_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── sync_service_rating (allerede korrekt — re-kjøres for idempotens) ────────
CREATE OR REPLACE FUNCTION public.sync_service_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE services
  SET
    rating_avg   = COALESCE((
      SELECT ROUND(AVG(rating)::numeric, 1)
      FROM reviews
      WHERE service_id = COALESCE(NEW.service_id, OLD.service_id)
    ), 0),
    rating_count = (
      SELECT COUNT(*)
      FROM reviews
      WHERE service_id = COALESCE(NEW.service_id, OLD.service_id)
    )
  WHERE id = COALESCE(NEW.service_id, OLD.service_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;
