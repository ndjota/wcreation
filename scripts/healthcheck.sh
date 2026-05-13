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

export PGPASSWORD="${POSTGRES_PASSWORD:-wcreation_dev}"
export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-${WCREATION_PG_PORT:-5433}}"
REDIS_PORT="${WCREATION_REDIS_PORT:-6379}"
EMQX_DASH_PORT="${WCREATION_EMQX_DASHBOARD_PORT:-18083}"
export PGUSER="${PGUSER:-postgres}"
export PGDATABASE="${PGDATABASE:-wcreation}"

PASS=1
LINE() { printf '%-22s %s\n' "$1" "$2"; }

check_psql() {
  if psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -c "SELECT 1" >/dev/null 2>&1; then
    LINE "Postgres+Timescale" "OK"
  else
    LINE "Postgres+Timescale" "FALLO"
    PASS=0
  fi
}

check_redis() {
  if command -v redis-cli >/dev/null 2>&1; then
    if redis-cli -h 127.0.0.1 -p "${REDIS_PORT}" ping 2>/dev/null | grep -q PONG; then
      LINE "Redis" "OK"
    else
      LINE "Redis" "FALLO"
      PASS=0
    fi
  elif docker exec wcreation-redis redis-cli ping 2>/dev/null | grep -q PONG; then
    LINE "Redis" "OK (docker exec)"
  else
    LINE "Redis" "FALLO"
    PASS=0
  fi
}

check_emqx_dash() {
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${EMQX_DASH_PORT}/" || true)"
  if [[ "${code}" == "200" || "${code}" == "302" ]]; then
    LINE "EMQX dashboard" "OK (HTTP ${code})"
  else
    LINE "EMQX dashboard" "FALLO (HTTP ${code})"
    PASS=0
  fi
}

check_migrations() {
  local n
  n="$(psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -tAc \
    "SELECT count(*)::text FROM wcreation.schema_migrations" 2>/dev/null || echo 0)"
  if [[ "${n}" =~ ^[0-9]+$ && "${n}" -ge 1 ]]; then
    LINE "Migraciones VPS" "OK (${n} aplicadas)"
  else
    LINE "Migraciones VPS" "FALLO"
    PASS=0
  fi
}

check_supabase_sql_files() {
  local n
  n="$(find "${ROOT_DIR}/packages/db-supabase/migrations" -maxdepth 1 -name '*.sql' 2>/dev/null | wc -l | tr -d ' ')"
  LINE "Migraciones Supabase (archivos)" "OK (${n} listas en repo)"
}

check_hypertable() {
  local n
  n="$(psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -tAc \
    "SELECT count(*)::text FROM timescaledb_information.hypertables WHERE hypertable_schema='wcreation'" 2>/dev/null || echo 0)"
  if [[ "${n}" =~ ^[1-9] ]]; then
    LINE "Hypertables wcreation" "OK (${n})"
  else
    LINE "Hypertables wcreation" "FALLO"
    PASS=0
  fi
}

check_ca() {
  if [[ ! -f "${ROOT_DIR}/certs/ca/ca.crt" ]]; then
    LINE "CA" "FALLO (sin ca.crt)"
    PASS=0
    return
  fi
  local until
  until="$(openssl x509 -in "${ROOT_DIR}/certs/ca/ca.crt" -noout -enddate 2>/dev/null | sed 's/^notAfter=//')"
  LINE "CA" "OK (válida hasta ${until})"
}

count_device_certs() {
  local c=0
  if [[ -d "${ROOT_DIR}/certs/devices" ]]; then
    while IFS= read -r -d '' f; do
      c=$((c + 1))
    done < <(find "${ROOT_DIR}/certs/devices" -name device.crt -print0 2>/dev/null || true)
  fi
  echo "${c}"
}

check_device_certs() {
  local c
  c="$(count_device_certs)"
  if [[ "${c}" -ge 1 ]]; then
    LINE "Certs devices" "OK (${c} emitidos)"
  else
    LINE "Certs devices" "FALLO (ningún device.crt)"
    PASS=0
  fi
}

check_mqtt_tls() {
  local dev_cn="${1:-SN-DEV-001}"
  local key="${ROOT_DIR}/certs/devices/${dev_cn}/device.key"
  local crt="${ROOT_DIR}/certs/devices/${dev_cn}/device.crt"
  local caf="${ROOT_DIR}/certs/broker/cacert.pem"
  if [[ ! -f "${key}" || ! -f "${crt}" || ! -f "${caf}" ]]; then
    LINE "MQTT TLS handshake" "FALLO (faltan certificados)"
    PASS=0
    return
  fi
  local out
  out="$(echo | openssl s_client -connect 127.0.0.1:8883 -CAfile "${caf}" -cert "${crt}" -key "${key}" -brief 2>&1 || true)"
  if echo "${out}" | grep -qE 'Verification: OK|Verify return code: 0'; then
    LINE "MQTT TLS handshake" "OK (CN=${dev_cn})"
  else
    LINE "MQTT TLS handshake" "FALLO"
    echo "${out}" | tail -n 5
    PASS=0
  fi
}

echo "=== WCreation healthcheck ==="
check_psql
check_redis
check_emqx_dash
check_migrations
check_supabase_sql_files
check_hypertable
check_ca
check_device_certs
check_mqtt_tls "SN-DEV-001"

echo ""
if [[ "${PASS}" -eq 1 ]]; then
  echo "Resultado: todos los chequeos esenciales OK."
  exit 0
fi
echo "Resultado: revisá los fallos arriba." >&2
exit 1
