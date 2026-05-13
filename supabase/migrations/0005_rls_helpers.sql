-- wcreation | 0005 — Funciones helper para RLS (JWT Supabase = auth.uid())
CREATE OR REPLACE FUNCTION wcreation.current_role_code()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = wcreation, public, pg_temp
AS $$
  SELECT u.role_code
  FROM wcreation.users u
  WHERE u.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION wcreation.current_jerarquia()
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = wcreation, public, pg_temp
AS $$
  SELECT COALESCE(r.jerarquia, 0)
  FROM wcreation.users u
  JOIN wcreation.roles r ON r.code = u.role_code
  WHERE u.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION wcreation.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = wcreation, public, pg_temp
AS $$
  SELECT u.tenant_id
  FROM wcreation.users u
  WHERE u.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION wcreation.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = wcreation, public, pg_temp
AS $$
  SELECT wcreation.current_role_code() = 'superadmin';
$$;

COMMENT ON FUNCTION wcreation.current_role_code() IS 'Rol operacional del usuario autenticado.';
COMMENT ON FUNCTION wcreation.current_jerarquia() IS 'Nivel jerárquico numérico del usuario autenticado.';
COMMENT ON FUNCTION wcreation.current_tenant_id() IS 'Tenant del usuario autenticado (NULL para superadmin).';
