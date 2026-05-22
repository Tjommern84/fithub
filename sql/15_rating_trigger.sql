-- ============================================
-- Trigger: auto-oppdater services.rating_avg og
-- services.rating_count når reviews endres.
--
-- Kjør manuelt i Supabase SQL Editor.
-- ============================================

CREATE OR REPLACE FUNCTION sync_service_rating()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_service_rating ON reviews;

CREATE TRIGGER trg_sync_service_rating
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION sync_service_rating();
