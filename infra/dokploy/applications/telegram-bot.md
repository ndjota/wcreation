# Dokploy — Application `apps/telegram-bot`

- **Tipo**: Application → Docker.
- **Repositorio**: `ndjota/wcreation`, rama `main`.
- **Build context**: raíz del monorepo.
- **Dockerfile**: `apps/telegram-bot/Dockerfile`.
- **Dominio público**: ninguno.
- **Variables**: `TELEGRAM_BOT_TOKEN`, Supabase service, `VPS_DATABASE_URL` (consultas de estado), demás según `apps/telegram-bot/src/config.ts`.

## Health

`HEALTH_LISTEN_PORT=9090` — health HTTP interno (misma convención que el bridge).
