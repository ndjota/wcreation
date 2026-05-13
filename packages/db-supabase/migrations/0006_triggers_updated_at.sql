-- wcreation | 0006 — Triggers updated_at
CREATE OR REPLACE FUNCTION wcreation.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenants',
    'users',
    'groups',
    'devices',
    'user_device_access',
    'device_thresholds',
    'public_qr_tokens',
    'notification_preferences'
  ]
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_%I_updated_at ON wcreation.%I;
      CREATE TRIGGER trg_%I_updated_at
      BEFORE UPDATE ON wcreation.%I
      FOR EACH ROW EXECUTE PROCEDURE wcreation.set_updated_at();
    ', t, t, t, t);
  END LOOP;
END;
$$;
