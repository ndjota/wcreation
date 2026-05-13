# Seed SQL (Supabase)

- **`dev_full.sql`**: 1 tenant (`dev-local`), 3 usuarios en `auth.users` + `auth.identities` + `wcreation.users`, 2 dispositivos alineados con los UUID usados en `devices_replica` del VPS, y accesos `user_device_access` para el responsable.
- Ejecutá **después** de aplicar todas las migraciones en `packages/db-supabase/migrations/` (incluida `0008_current_role_alias.sql`).
- Conexión: rol `postgres` o cadena con permisos equivalentes (p. ej. conexión directa del proyecto Supabase).
- Contraseña de prueba de los tres usuarios: `WcreationDev123!`

Desde la raíz del repo (opcional, vía `seed-dev.sh` si exportás `SUPABASE_DB_URL`):

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f packages/db-supabase/seed/dev_full.sql
```
