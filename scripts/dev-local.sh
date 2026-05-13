#!/usr/bin/env bash
# Levanta infra Docker (si hace falta) + API + mqtt-bridge + PWA en desarrollo.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "${NVM_DIR}/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  source "${NVM_DIR}/nvm.sh"
  command -v nvm >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 || true
fi

if [[ -f "${ROOT_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/.env"
  set +a
fi

# PWA: reutilizar URL y anon del backend si no definís VITE_* por separado
export VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-${SUPABASE_URL:-}}"
export VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-${SUPABASE_ANON_KEY:-}}"

errs=()
[[ -z "${SUPABASE_URL:-}" || "${SUPABASE_URL}" == *"your-project"* ]] &&
  errs+=("SUPABASE_URL debe ser la URL real del proyecto (Supabase → Settings → API)")
[[ ${#SUPABASE_SERVICE_ROLE_KEY} -lt 20 ]] &&
  errs+=("SUPABASE_SERVICE_ROLE_KEY (service_role, ≥20 caracteres)")
[[ ${#VITE_SUPABASE_ANON_KEY} -lt 20 ]] &&
  errs+=("SUPABASE_ANON_KEY o VITE_SUPABASE_ANON_KEY (anon pública, ≥20 caracteres)")

if [[ ${#errs[@]} -gt 0 ]]; then
  echo "Faltan credenciales de Supabase en .env:" >&2
  for e in "${errs[@]}"; do
    echo "  - ${e}" >&2
  done
  echo "" >&2
  echo "Copiá Project URL, anon y service_role desde el dashboard y volvé a ejecutar:" >&2
  echo "  pnpm dev:all" >&2
  exit 1
fi

for cmd in pnpm docker; do
  command -v "${cmd}" >/dev/null 2>&1 || {
    echo "Falta el comando: ${cmd}" >&2
    exit 1
  }
done

if ! docker ps --format '{{.Names}}' | grep -qx 'wcreation-timescaledb'; then
  echo "=== Levantando Docker (Timescale, Redis, EMQX, Mailhog)… ==="
  pnpm dev:detach
  echo "Esperando Postgres…"
  sleep 4
fi

cleanup() {
  echo ""
  echo "=== Cerrando API / bridge / PWA… ==="
  local i
  for ((i = 0; i < ${#PIDS[@]}; i++)); do
    kill "${PIDS[i]}" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

PIDS=()

echo "=== API :3001 (Swagger /docs) ==="
pnpm --filter @wcreation/api dev &
PIDS+=($!)
sleep 3

echo "=== mqtt-bridge ==="
pnpm --filter @wcreation/mqtt-bridge dev &
PIDS+=($!)
sleep 2

echo "=== PWA Vite :5173 ==="
pnpm --filter @wcreation/pwa dev &
PIDS+=($!)
sleep 2

echo ""
echo "=== Listo ==="
echo "  PWA:        http://127.0.0.1:5173"
echo "  API docs:   http://127.0.0.1:3001/docs"
echo "  Mailhog:    http://127.0.0.1:${WCREATION_MAILHOG_UI_PORT:-8025}"
echo "  EMQX dash:  http://127.0.0.1:${WCREATION_EMQX_DASHBOARD_PORT:-18083}  (admin / public)"
echo ""
echo "Ctrl+C detiene API, bridge y PWA (Docker sigue en background)."
wait
