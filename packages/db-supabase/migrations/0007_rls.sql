-- wcreation | 0007 — Row Level Security y permisos
ALTER TABLE wcreation.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE wcreation.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wcreation.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wcreation.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE wcreation.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE wcreation.user_device_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE wcreation.device_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE wcreation.public_qr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE wcreation.notification_preferences ENABLE ROW LEVEL SECURITY;

-- --- roles (catálogo) ---
DROP POLICY IF EXISTS roles_select_authenticated ON wcreation.roles;
CREATE POLICY roles_select_authenticated ON wcreation.roles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS roles_write_superadmin ON wcreation.roles;
CREATE POLICY roles_write_superadmin ON wcreation.roles
  FOR INSERT TO authenticated WITH CHECK (wcreation.is_superadmin());

DROP POLICY IF EXISTS roles_update_superadmin ON wcreation.roles;
CREATE POLICY roles_update_superadmin ON wcreation.roles
  FOR UPDATE TO authenticated USING (wcreation.is_superadmin()) WITH CHECK (wcreation.is_superadmin());

DROP POLICY IF EXISTS roles_delete_superadmin ON wcreation.roles;
CREATE POLICY roles_delete_superadmin ON wcreation.roles
  FOR DELETE TO authenticated USING (wcreation.is_superadmin());

-- --- tenants ---
DROP POLICY IF EXISTS tenants_select_scope ON wcreation.tenants;
CREATE POLICY tenants_select_scope ON wcreation.tenants
  FOR SELECT TO authenticated USING (
    wcreation.is_superadmin()
    OR id = wcreation.current_tenant_id()
  );

DROP POLICY IF EXISTS tenants_insert_superadmin ON wcreation.tenants;
CREATE POLICY tenants_insert_superadmin ON wcreation.tenants
  FOR INSERT TO authenticated WITH CHECK (wcreation.is_superadmin());

DROP POLICY IF EXISTS tenants_update_scope ON wcreation.tenants;
CREATE POLICY tenants_update_scope ON wcreation.tenants
  FOR UPDATE TO authenticated USING (
    wcreation.is_superadmin()
    OR (id = wcreation.current_tenant_id() AND wcreation.current_role_code() = 'owner_admin')
  )
  WITH CHECK (
    wcreation.is_superadmin()
    OR (id = wcreation.current_tenant_id() AND wcreation.current_role_code() = 'owner_admin')
  );

DROP POLICY IF EXISTS tenants_delete_superadmin ON wcreation.tenants;
CREATE POLICY tenants_delete_superadmin ON wcreation.tenants
  FOR DELETE TO authenticated USING (wcreation.is_superadmin());

-- --- users ---
DROP POLICY IF EXISTS users_select_scope ON wcreation.users;
CREATE POLICY users_select_scope ON wcreation.users
  FOR SELECT TO authenticated USING (
    wcreation.is_superadmin()
    OR id = auth.uid()
    OR (
      wcreation.current_role_code() = 'owner_admin'
      AND tenant_id IS NOT NULL
      AND tenant_id = wcreation.current_tenant_id()
    )
  );

DROP POLICY IF EXISTS users_insert_scope ON wcreation.users;
CREATE POLICY users_insert_scope ON wcreation.users
  FOR INSERT TO authenticated WITH CHECK (
    wcreation.is_superadmin()
    OR (
      wcreation.current_role_code() = 'owner_admin'
      AND tenant_id = wcreation.current_tenant_id()
      AND tenant_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS users_update_scope ON wcreation.users;
CREATE POLICY users_update_scope ON wcreation.users
  FOR UPDATE TO authenticated USING (
    wcreation.is_superadmin()
    OR id = auth.uid()
    OR (
      wcreation.current_role_code() = 'owner_admin'
      AND tenant_id = wcreation.current_tenant_id()
    )
  )
  WITH CHECK (
    wcreation.is_superadmin()
    OR id = auth.uid()
    OR (
      wcreation.current_role_code() = 'owner_admin'
      AND tenant_id = wcreation.current_tenant_id()
    )
  );

DROP POLICY IF EXISTS users_delete_scope ON wcreation.users;
CREATE POLICY users_delete_scope ON wcreation.users
  FOR DELETE TO authenticated USING (
    wcreation.is_superadmin()
    OR (
      wcreation.current_role_code() = 'owner_admin'
      AND tenant_id = wcreation.current_tenant_id()
      AND id <> auth.uid()
    )
  );

-- --- groups ---
DROP POLICY IF EXISTS groups_select_scope ON wcreation.groups;
CREATE POLICY groups_select_scope ON wcreation.groups
  FOR SELECT TO authenticated USING (
    wcreation.is_superadmin()
    OR tenant_id = wcreation.current_tenant_id()
  );

DROP POLICY IF EXISTS groups_write_owner ON wcreation.groups;
CREATE POLICY groups_write_owner ON wcreation.groups
  FOR INSERT TO authenticated WITH CHECK (
    wcreation.is_superadmin()
    OR (
      wcreation.current_role_code() = 'owner_admin'
      AND tenant_id = wcreation.current_tenant_id()
    )
  );

DROP POLICY IF EXISTS groups_update_owner ON wcreation.groups;
CREATE POLICY groups_update_owner ON wcreation.groups
  FOR UPDATE TO authenticated USING (
    wcreation.is_superadmin()
    OR (
      wcreation.current_role_code() = 'owner_admin'
      AND tenant_id = wcreation.current_tenant_id()
    )
  )
  WITH CHECK (
    wcreation.is_superadmin()
    OR (
      wcreation.current_role_code() = 'owner_admin'
      AND tenant_id = wcreation.current_tenant_id()
    )
  );

DROP POLICY IF EXISTS groups_delete_owner ON wcreation.groups;
CREATE POLICY groups_delete_owner ON wcreation.groups
  FOR DELETE TO authenticated USING (
    wcreation.is_superadmin()
    OR (
      wcreation.current_role_code() = 'owner_admin'
      AND tenant_id = wcreation.current_tenant_id()
    )
  );

-- --- devices ---
DROP POLICY IF EXISTS devices_select_scope ON wcreation.devices;
CREATE POLICY devices_select_scope ON wcreation.devices
  FOR SELECT TO authenticated USING (
    wcreation.is_superadmin()
    OR (
      tenant_id = wcreation.current_tenant_id()
      AND wcreation.current_role_code() = 'owner_admin'
    )
    OR EXISTS (
      SELECT 1
      FROM wcreation.user_device_access uda
      WHERE uda.user_id = auth.uid()
        AND uda.device_id = wcreation.devices.id
    )
  );

DROP POLICY IF EXISTS devices_write_owner ON wcreation.devices;
CREATE POLICY devices_write_owner ON wcreation.devices
  FOR INSERT TO authenticated WITH CHECK (
    wcreation.is_superadmin()
    OR (
      wcreation.current_role_code() = 'owner_admin'
      AND tenant_id = wcreation.current_tenant_id()
    )
  );

DROP POLICY IF EXISTS devices_update_owner ON wcreation.devices;
CREATE POLICY devices_update_owner ON wcreation.devices
  FOR UPDATE TO authenticated USING (
    wcreation.is_superadmin()
    OR (
      wcreation.current_role_code() = 'owner_admin'
      AND tenant_id = wcreation.current_tenant_id()
    )
  )
  WITH CHECK (
    wcreation.is_superadmin()
    OR (
      wcreation.current_role_code() = 'owner_admin'
      AND tenant_id = wcreation.current_tenant_id()
    )
  );

DROP POLICY IF EXISTS devices_delete_owner ON wcreation.devices;
CREATE POLICY devices_delete_owner ON wcreation.devices
  FOR DELETE TO authenticated USING (
    wcreation.is_superadmin()
    OR (
      wcreation.current_role_code() = 'owner_admin'
      AND tenant_id = wcreation.current_tenant_id()
    )
  );

-- --- user_device_access ---
DROP POLICY IF EXISTS uda_select_scope ON wcreation.user_device_access;
CREATE POLICY uda_select_scope ON wcreation.user_device_access
  FOR SELECT TO authenticated USING (
    wcreation.is_superadmin()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM wcreation.devices d
      WHERE d.id = wcreation.user_device_access.device_id
        AND d.tenant_id = wcreation.current_tenant_id()
        AND wcreation.current_role_code() = 'owner_admin'
    )
  );

DROP POLICY IF EXISTS uda_write_owner ON wcreation.user_device_access;
CREATE POLICY uda_write_owner ON wcreation.user_device_access
  FOR INSERT TO authenticated WITH CHECK (
    wcreation.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM wcreation.devices d
      WHERE d.id = device_id
        AND d.tenant_id = wcreation.current_tenant_id()
        AND wcreation.current_role_code() = 'owner_admin'
    )
  );

DROP POLICY IF EXISTS uda_update_owner ON wcreation.user_device_access;
CREATE POLICY uda_update_owner ON wcreation.user_device_access
  FOR UPDATE TO authenticated USING (
    wcreation.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM wcreation.devices d
      WHERE d.id = wcreation.user_device_access.device_id
        AND d.tenant_id = wcreation.current_tenant_id()
        AND wcreation.current_role_code() = 'owner_admin'
    )
  )
  WITH CHECK (
    wcreation.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM wcreation.devices d
      WHERE d.id = device_id
        AND d.tenant_id = wcreation.current_tenant_id()
        AND wcreation.current_role_code() = 'owner_admin'
    )
  );

DROP POLICY IF EXISTS uda_delete_owner ON wcreation.user_device_access;
CREATE POLICY uda_delete_owner ON wcreation.user_device_access
  FOR DELETE TO authenticated USING (
    wcreation.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM wcreation.devices d
      WHERE d.id = wcreation.user_device_access.device_id
        AND d.tenant_id = wcreation.current_tenant_id()
        AND wcreation.current_role_code() = 'owner_admin'
    )
  );

-- --- device_thresholds ---
DROP POLICY IF EXISTS dt_select_scope ON wcreation.device_thresholds;
CREATE POLICY dt_select_scope ON wcreation.device_thresholds
  FOR SELECT TO authenticated USING (
    wcreation.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM wcreation.devices d
      WHERE d.id = wcreation.device_thresholds.device_id
        AND d.tenant_id = wcreation.current_tenant_id()
        AND wcreation.current_role_code() = 'owner_admin'
    )
    OR EXISTS (
      SELECT 1 FROM wcreation.user_device_access uda
      WHERE uda.user_id = auth.uid()
        AND uda.device_id = wcreation.device_thresholds.device_id
    )
  );

DROP POLICY IF EXISTS dt_write_owner ON wcreation.device_thresholds;
CREATE POLICY dt_write_owner ON wcreation.device_thresholds
  FOR INSERT TO authenticated WITH CHECK (
    wcreation.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM wcreation.devices d
      WHERE d.id = device_id
        AND d.tenant_id = wcreation.current_tenant_id()
        AND wcreation.current_role_code() = 'owner_admin'
    )
  );

DROP POLICY IF EXISTS dt_update_scope ON wcreation.device_thresholds;
CREATE POLICY dt_update_scope ON wcreation.device_thresholds
  FOR UPDATE TO authenticated USING (
    wcreation.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM wcreation.devices d
      WHERE d.id = wcreation.device_thresholds.device_id
        AND d.tenant_id = wcreation.current_tenant_id()
        AND wcreation.current_role_code() = 'owner_admin'
    )
    OR (
      wcreation.device_thresholds.modificable_por_responsable
      AND EXISTS (
        SELECT 1 FROM wcreation.user_device_access uda
        WHERE uda.user_id = auth.uid()
          AND uda.device_id = wcreation.device_thresholds.device_id
          AND uda.permiso = 'configurar'
      )
    )
  )
  WITH CHECK (
    wcreation.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM wcreation.devices d
      WHERE d.id = device_id
        AND d.tenant_id = wcreation.current_tenant_id()
        AND wcreation.current_role_code() = 'owner_admin'
    )
    OR (
      modificable_por_responsable
      AND EXISTS (
        SELECT 1 FROM wcreation.user_device_access uda
        WHERE uda.user_id = auth.uid()
          AND uda.device_id = device_id
          AND uda.permiso = 'configurar'
      )
    )
  );

DROP POLICY IF EXISTS dt_delete_owner ON wcreation.device_thresholds;
CREATE POLICY dt_delete_owner ON wcreation.device_thresholds
  FOR DELETE TO authenticated USING (
    wcreation.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM wcreation.devices d
      WHERE d.id = wcreation.device_thresholds.device_id
        AND d.tenant_id = wcreation.current_tenant_id()
        AND wcreation.current_role_code() = 'owner_admin'
    )
  );

-- --- public_qr_tokens ---
DROP POLICY IF EXISTS pqt_select_scope ON wcreation.public_qr_tokens;
CREATE POLICY pqt_select_scope ON wcreation.public_qr_tokens
  FOR SELECT TO authenticated USING (
    wcreation.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM wcreation.devices d
      WHERE d.id = wcreation.public_qr_tokens.device_id
        AND d.tenant_id = wcreation.current_tenant_id()
        AND wcreation.current_role_code() = 'owner_admin'
    )
    OR EXISTS (
      SELECT 1 FROM wcreation.groups g
      WHERE g.id = wcreation.public_qr_tokens.group_id
        AND g.tenant_id = wcreation.current_tenant_id()
        AND wcreation.current_role_code() = 'owner_admin'
    )
  );

DROP POLICY IF EXISTS pqt_write_owner ON wcreation.public_qr_tokens;
CREATE POLICY pqt_write_owner ON wcreation.public_qr_tokens
  FOR INSERT TO authenticated WITH CHECK (
    wcreation.is_superadmin()
    OR (
      wcreation.current_role_code() = 'owner_admin'
      AND (
        EXISTS (
          SELECT 1 FROM wcreation.devices d
          WHERE d.id = device_id AND d.tenant_id = wcreation.current_tenant_id()
        )
        OR EXISTS (
          SELECT 1 FROM wcreation.groups g
          WHERE g.id = group_id AND g.tenant_id = wcreation.current_tenant_id()
        )
      )
    )
  );

DROP POLICY IF EXISTS pqt_update_owner ON wcreation.public_qr_tokens;
CREATE POLICY pqt_update_owner ON wcreation.public_qr_tokens
  FOR UPDATE TO authenticated USING (
    wcreation.is_superadmin()
    OR (
      wcreation.current_role_code() = 'owner_admin'
      AND (
        EXISTS (
          SELECT 1 FROM wcreation.devices d
          WHERE d.id = wcreation.public_qr_tokens.device_id
            AND d.tenant_id = wcreation.current_tenant_id()
        )
        OR EXISTS (
          SELECT 1 FROM wcreation.groups g
          WHERE g.id = wcreation.public_qr_tokens.group_id
            AND g.tenant_id = wcreation.current_tenant_id()
        )
      )
    )
  )
  WITH CHECK (
    wcreation.is_superadmin()
    OR (
      wcreation.current_role_code() = 'owner_admin'
      AND (
        EXISTS (
          SELECT 1 FROM wcreation.devices d
          WHERE d.id = device_id AND d.tenant_id = wcreation.current_tenant_id()
        )
        OR EXISTS (
          SELECT 1 FROM wcreation.groups g
          WHERE g.id = group_id AND g.tenant_id = wcreation.current_tenant_id()
        )
      )
    )
  );

DROP POLICY IF EXISTS pqt_delete_owner ON wcreation.public_qr_tokens;
CREATE POLICY pqt_delete_owner ON wcreation.public_qr_tokens
  FOR DELETE TO authenticated USING (
    wcreation.is_superadmin()
    OR (
      wcreation.current_role_code() = 'owner_admin'
      AND (
        EXISTS (
          SELECT 1 FROM wcreation.devices d
          WHERE d.id = wcreation.public_qr_tokens.device_id
            AND d.tenant_id = wcreation.current_tenant_id()
        )
        OR EXISTS (
          SELECT 1 FROM wcreation.groups g
          WHERE g.id = wcreation.public_qr_tokens.group_id
            AND g.tenant_id = wcreation.current_tenant_id()
        )
      )
    )
  );

-- --- notification_preferences ---
DROP POLICY IF EXISTS np_select_scope ON wcreation.notification_preferences;
CREATE POLICY np_select_scope ON wcreation.notification_preferences
  FOR SELECT TO authenticated USING (
    wcreation.is_superadmin()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM wcreation.users u
      WHERE u.id = wcreation.notification_preferences.user_id
        AND u.tenant_id = wcreation.current_tenant_id()
        AND wcreation.current_role_code() = 'owner_admin'
    )
  );

DROP POLICY IF EXISTS np_write_scope ON wcreation.notification_preferences;
CREATE POLICY np_write_scope ON wcreation.notification_preferences
  FOR INSERT TO authenticated WITH CHECK (
    wcreation.is_superadmin()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM wcreation.users u
      WHERE u.id = user_id
        AND u.tenant_id = wcreation.current_tenant_id()
        AND wcreation.current_role_code() = 'owner_admin'
    )
  );

DROP POLICY IF EXISTS np_update_scope ON wcreation.notification_preferences;
CREATE POLICY np_update_scope ON wcreation.notification_preferences
  FOR UPDATE TO authenticated USING (
    wcreation.is_superadmin()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM wcreation.users u
      WHERE u.id = wcreation.notification_preferences.user_id
        AND u.tenant_id = wcreation.current_tenant_id()
        AND wcreation.current_role_code() = 'owner_admin'
    )
  )
  WITH CHECK (
    wcreation.is_superadmin()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM wcreation.users u
      WHERE u.id = user_id
        AND u.tenant_id = wcreation.current_tenant_id()
        AND wcreation.current_role_code() = 'owner_admin'
    )
  );

DROP POLICY IF EXISTS np_delete_scope ON wcreation.notification_preferences;
CREATE POLICY np_delete_scope ON wcreation.notification_preferences
  FOR DELETE TO authenticated USING (
    wcreation.is_superadmin()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM wcreation.users u
      WHERE u.id = wcreation.notification_preferences.user_id
        AND u.tenant_id = wcreation.current_tenant_id()
        AND wcreation.current_role_code() = 'owner_admin'
    )
  );

GRANT USAGE ON SCHEMA wcreation TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA wcreation TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA wcreation TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA wcreation
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA wcreation
  GRANT ALL ON TABLES TO service_role;
