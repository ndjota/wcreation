-- wcreation | 0008 — Alias current_role() (contrato Etapa 1; evita colisión con el rol de sesión SQL sin calificar)
CREATE OR REPLACE FUNCTION wcreation.current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = wcreation, public, pg_temp
AS $$
  SELECT wcreation.current_role_code();
$$;

COMMENT ON FUNCTION wcreation.current_role() IS 'Alias de current_role_code(); usá wcreation.current_role() en políticas SQL.';
