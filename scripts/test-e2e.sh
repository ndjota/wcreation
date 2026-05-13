#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if [[ -f "${ROOT_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/.env"
  set +a
fi

: "${SUPABASE_URL:?Definí SUPABASE_URL}"
: "${SUPABASE_ANON_KEY:?Definí SUPABASE_ANON_KEY}"
: "${E2E_USER_EMAIL:?Definí E2E_USER_EMAIL (ej. owner-demo@wcreation.local)}"
: "${E2E_USER_PASSWORD:?Definí E2E_USER_PASSWORD}"
: "${EVENT_SIGNING_KEY:?Definí EVENT_SIGNING_KEY (mín. 32 chars)}"

DEVICE_ID="${E2E_DEVICE_ID:-a1111111-1111-1111-1111-111111111111}"
API_URL="${API_URL:-http://127.0.0.1:3001}"

echo "Comprobando stack Docker…"
if ! docker compose -f "${ROOT_DIR}/infra/docker-compose.dev.yml" --project-name wcreation ps 2>/dev/null | grep -q "Up"; then
  echo "Levantando compose en segundo plano…"
  docker compose -f "${ROOT_DIR}/infra/docker-compose.dev.yml" --project-name wcreation up -d
  sleep 5
fi

echo "Obteniendo JWT (password grant)…"
TOKEN_JSON="$(curl -sS -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${E2E_USER_EMAIL}\",\"password\":\"${E2E_USER_PASSWORD}\"}")"

TOKEN="$(echo "${TOKEN_JSON}" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); if(!j.access_token){console.error(j); process.exit(1)}; process.stdout.write(j.access_token)")"

echo "Arrancando API (:3001)…"
(cd "${ROOT_DIR}" && pnpm --filter @wcreation/api exec tsx apps/api/src/index.ts) &
API_PID=$!
sleep 3

echo "Arrancando mqtt-bridge…"
(cd "${ROOT_DIR}" && pnpm --filter @wcreation/mqtt-bridge exec tsx apps/mqtt-bridge/src/index.ts) &
BR_PID=$!
sleep 3

echo "Simulador SN-DEV-001 (5s intervalo)…"
(cd "${ROOT_DIR}" && pnpm --filter @wcreation/mqtt-bridge exec tsx apps/mqtt-bridge/scripts/simulate-device.ts SN-DEV-001) &
SIM_PID=$!

echo "Esperando 30s de telemetría…"
sleep 30

echo "GET readings…"
READINGS="$(curl -sS "${API_URL}/devices/${DEVICE_ID}/readings?interval=raw" -H "Authorization: Bearer ${TOKEN}")"
N="$(echo "${READINGS}" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); process.stdout.write(String((j.items||[]).length))")"
if [[ "${N}" -lt 3 ]]; then
  echo "FALLO: se esperaban al menos 3 lecturas, obtuve ${N}" >&2
  echo "${READINGS}" >&2
  kill "${SIM_PID}" 2>/dev/null || true
  kill "${BR_PID}" 2>/dev/null || true
  kill "${API_PID}" 2>/dev/null || true
  exit 1
fi

echo "GET events…"
EVENTS="$(curl -sS "${API_URL}/devices/${DEVICE_ID}/events?limit=20" -H "Authorization: Bearer ${TOKEN}")"
EID="$(echo "${EVENTS}" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); const i=(j.items||[])[0]; if(!i){process.exit(1)}; process.stdout.write(i.id)")"

echo "Verify event ${EID}…"
VERIFY="$(curl -sS "${API_URL}/devices/${DEVICE_ID}/events/${EID}/verify" -H "Authorization: Bearer ${TOKEN}")"
echo "${VERIFY}" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); if(!j.firma_valida||!j.cadena_valida){console.error(j); process.exit(1)}"

kill "${SIM_PID}" 2>/dev/null || true
kill "${BR_PID}" 2>/dev/null || true
kill "${API_PID}" 2>/dev/null || true

echo "E2E OK"
