# Onboarding de cliente (tenant)

Objetivo: dejar operativo un **nuevo tenant** con un **dueño administrador** y al menos un **dispositivo** de prueba.

## 1. Supabase

1. Aplicar migraciones si hubo cambios: `bash scripts/supabase-apply-migrations.sh`.
2. En el esquema `wcreation`, crear el **tenant** (`tenants`) con `razon_social` y flags requeridos.
3. Crear **Auth user** (Supabase Auth) con el email del dueño.
4. Insertar fila en `wcreation.users` con:
   - `id` = UUID del usuario en `auth.users`
   - `tenant_id` del tenant creado
   - `role_code = 'owner_admin'`
   - `activo = true`
5. Opcional: crear **grupo** (`groups`) para representar una sucursal y asociar dispositivos.

## 2. VPS / datos temporales

1. Asegurar que exista el **device_id** (UUID) en `wcreation.devices` (Supabase) alineado con el que usará el firmware.
2. Levantar **Timescale** y **Redis** según `infra/dokploy/compose/timescale-redis.yml` o equivalente.
3. Aplicar migraciones VPS: flujo habitual de `packages/db-vps` en el servidor.

## 3. Certificados y MQTT

1. Emitir cert de dispositivo: `bash scripts/pki-new-device.sh SN-...` (CN = número de serie).
2. Copiar certificados del broker y CA al host bajo `/etc/wcreation/certs` según [device-provisioning.md](./device-provisioning.md).
3. Reiniciar **EMQX** tras cambios de certificados de servidor (renovación típica **cada 2 años** para el cert del broker firmado por la CA de producto; documentar fecha en el calendario del operador).

## 4. Aplicaciones Dokploy

1. Desplegar **API**, **Pwa**, **mqtt-bridge**, **telegram-bot** con variables de `.env.example` mapeadas a secretos.
2. Comprobar `/health` y flujo de login en la PWA.

## 5. Verificación con el cliente

1. Entregar credenciales del dueño por canal seguro.
2. Mostrar generación de **QR público** desde la app y validar vista sin login.
3. Acordar canales de alerta (email, Web Push, Telegram de producto).
