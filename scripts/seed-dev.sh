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

bash "${ROOT_DIR}/scripts/pki-new-device.sh" SN-DEV-001
bash "${ROOT_DIR}/scripts/pki-new-device.sh" SN-DEV-002
bash "${ROOT_DIR}/scripts/pki-new-device.sh" SN-BRIDGE-001

export PGPASSWORD="${POSTGRES_PASSWORD:-wcreation_dev}"
export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-${WCREATION_PG_PORT:-5433}}"
export PGUSER="${PGUSER:-postgres}"
export PGDATABASE="${PGDATABASE:-wcreation}"

psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO wcreation.devices_replica (id, serial_number, tenant_id, activo, sincronizado_at)
VALUES
  ('a1111111-1111-1111-1111-111111111111'::uuid, 'SN-DEV-001', '00000000-0000-0000-0000-0000000000aa'::uuid, true, now()),
  ('a2222222-2222-2222-2222-222222222222'::uuid, 'SN-DEV-002', '00000000-0000-0000-0000-0000000000aa'::uuid, true, now())
ON CONFLICT (serial_number) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  activo = EXCLUDED.activo,
  sincronizado_at = now();
SQL

if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
  echo "Aplicando seed Supabase (tenant + 3 usuarios + 2 dispositivos)…"
  psql "${SUPABASE_DB_URL}" -v ON_ERROR_STOP=1 -f "${ROOT_DIR}/packages/db-supabase/seed/dev_full.sql"
else
  echo "SUPABASE_DB_URL no definido: omitiendo seed en Supabase (solo PKI + devices_replica en VPS)."
fi

TENANT="00000000-0000-0000-0000-0000000000aa"

echo ""
echo "=== Seed desarrollo ==="
echo "Dispositivos SN-DEV-001 y SN-DEV-002 insertados/actualizados en wcreation.devices_replica."
if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
  echo "Seed Supabase aplicado (ver packages/db-supabase/seed/README.md)."
else
  echo "Para cargar tenant + usuarios + dispositivos en Supabase: export SUPABASE_DB_URL=... y volvé a ejecutar este script."
fi
echo ""
echo "Probá publicación TLS (requiere mosquitto_clients):"
echo "  mosquitto_pub -h 127.0.0.1 -p 8883 --cafile certs/broker/cacert.pem \\"
echo "    --cert certs/devices/SN-DEV-001/device.crt --key certs/devices/SN-DEV-001/device.key \\"
echo "    -t 'wcreation/${TENANT}/SN-DEV-001/telemetry' -m '{\"ok\":true}' -d"
