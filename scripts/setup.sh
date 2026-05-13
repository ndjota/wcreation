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

for cmd in pnpm docker openssl; do
  command -v "${cmd}" >/dev/null 2>&1 || {
    echo "Falta el comando requerido: ${cmd}" >&2
    exit 1
  }
done

pnpm install

if [[ ! -f "${ROOT_DIR}/certs/ca/ca.crt" ]]; then
  bash "${ROOT_DIR}/scripts/pki-init.sh"
fi

bash "${ROOT_DIR}/scripts/pki-broker.sh"

COMPOSE_ARGS=(-f "${ROOT_DIR}/infra/docker-compose.dev.yml" --project-name wcreation)
if [[ -f "${ROOT_DIR}/.env" ]]; then
  COMPOSE_ARGS+=(--env-file "${ROOT_DIR}/.env")
fi
docker compose "${COMPOSE_ARGS[@]}" up -d

export PGPASSWORD="${POSTGRES_PASSWORD:-wcreation_dev}"
export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-${WCREATION_PG_PORT:-5433}}"
export PGUSER="${PGUSER:-postgres}"
export PGDATABASE="${PGDATABASE:-wcreation}"

echo "Esperando a Postgres (Timescale)…"
for _ in $(seq 1 60); do
  if psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -c "SELECT 1" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -c "SELECT 1" >/dev/null 2>&1; then
  echo "Postgres no respondió a tiempo en ${PGHOST}:${PGPORT}" >&2
  exit 1
fi

shopt -s nullglob
for f in $(ls -1 "${ROOT_DIR}/packages/db-vps/migrations/"*.sql | sort); do
  version="$(basename "${f}")"
  already="$(psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -tAc \
    "SELECT 1 FROM wcreation.schema_migrations WHERE version='${version}'" || true)"
  if [[ "${already}" == "1" ]]; then
    echo "Migración ya aplicada: ${version}"
    continue
  fi
  echo "Aplicando migración ${version}…"
  psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -v ON_ERROR_STOP=1 -f "${f}"
  psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -v ON_ERROR_STOP=1 -c \
    "INSERT INTO wcreation.schema_migrations(version) VALUES ('${version}') ON CONFLICT (version) DO NOTHING;"
done
shopt -u nullglob

echo ""
echo "=== WCreation — entorno local listo ==="
echo "EMQX Dashboard:     http://localhost:${WCREATION_EMQX_DASHBOARD_PORT:-18083}  (admin / public)"
echo "Mailhog UI:         http://localhost:${WCREATION_MAILHOG_UI_PORT:-8025}"
echo "Timescale (VPS):    ${PGHOST}:${PGPORT}  (base ${PGDATABASE})"
echo ""
echo "Siguiente: bash scripts/seed-dev.sh && bash scripts/healthcheck.sh"
