# Dokploy — Application `apps/pwa`

- **Tipo**: Application → Docker.
- **Repositorio**: `ndjota/wcreation`, rama `main`.
- **Build context**: raíz del monorepo.
- **Dockerfile**: `apps/pwa/Dockerfile` (multi-stage: `pnpm build` + nginx con brotli).
- **Puerto interno**: `80`.
- **Dominio**: `wcreation.ndjota.io` → HTTPS Traefik → HTTP 80 al contenedor.

## Variables de build (Vite)

Definir en Dokploy como env disponibles **en tiempo de build**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL=https://api.wcreation.ndjota.io`
- `VITE_WS_URL=wss://api.wcreation.ndjota.io`
- `VITE_PUBLIC_PATENTE_REF` (texto legal en UI)

## Cabeceras

`apps/pwa/docker/nginx.conf` aplica CSP estricta, HSTS, cache fuerte en assets y `no-cache` en `index.html`.
