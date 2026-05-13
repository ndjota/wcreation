# Preguntas frecuentes

## ¿Por qué el broker MQTT no usa Let’s Encrypt?

Los dispositivos embarcan la **CA de producto** para validar el servidor. Let’s Encrypt rota CAs y cadenas; la CA propia da control total del anclaje de confianza en firmware.

## ¿Puedo exponer el puerto 1883 sin TLS?

No en producción. Solo **8883** con TLS mutuo según diseño.

## ¿Dónde corre el “single source of truth” del device_id?

En **Supabase** (`wcreation.devices.id`). El VPS (Timescale) replica series por ese UUID.

## ¿Cómo pruebo RLS en CI?

Definí el secreto `SUPABASE_DB_URL` (cadena Postgres directa del proyecto) y ejecutá `pnpm vitest run tests/supabase-rls.test.ts`.

## ¿Qué bucket usar para backups baratos?

**Cloudflare R2** suele ser muy económico con egress favorable; **Backblaze B2** también. Configurá **lifecycle** en el panel para 7d/4w/12m.

## ¿El endpoint `/metrics` está autenticado?

En v1 **no**; restringilo por red interna o middleware Traefik (IP allowlist) si exponés el API públicamente.

## ¿HSTS duplicado entre Traefik, API y PWA?

Traefik suele ser la fuente principal. La PWA añade cabeceras en nginx; la API añade HSTS vía Helmet en producción. Es redundante pero coherente; podés unificar en Traefik si preferís una sola capa.
