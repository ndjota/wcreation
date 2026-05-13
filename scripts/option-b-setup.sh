#!/usr/bin/env bash
# Opción B: migraciones Supabase (CLI) + seed por API + seed VPS local.
# Requisitos: Supabase CLI, sesión `supabase login` (o SUPABASE_ACCESS_TOKEN), .env con
# SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PROJECT_REF, SEED_*.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if [[ -f "${ROOT_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/.env"
  set +a
fi

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "${NVM_DIR}/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  source "${NVM_DIR}/nvm.sh"
  command -v nvm >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 || true
fi

echo "=== 1/4 Comprobaciones ==="
command -v supabase >/dev/null 2>&1 || {
  echo "Instalá la CLI: brew install supabase/tap/supabase" >&2
  exit 1
}
if ! supabase projects list >/dev/null 2>&1; then
  echo "" >&2
  echo "No hay sesión en Supabase CLI. Elegí UNA de estas:" >&2
  echo "  • En esta máquina (interactivo):  supabase login" >&2
  echo "  • O exportá SUPABASE_ACCESS_TOKEN (PAT desde https://supabase.com/dashboard/account/tokens )" >&2
  exit 1
}
[[ -n "${SUPABASE_PROJECT_REF:-}" ]] || {
  echo "Falta SUPABASE_PROJECT_REF en .env" >&2
  exit 1
}

echo "=== 2/4 Migraciones → proyecto remoto (supabase db push) ==="
bash "${ROOT_DIR}/scripts/supabase-apply-migrations.sh"

REF="${SUPABASE_PROJECT_REF}"
echo ""
echo "┌─────────────────────────────────────────────────────────────────────────────┐"
echo "│  ANTES del seed (PGRST106): exponer el esquema «wcreation» en la Data API   │"
echo "├─────────────────────────────────────────────────────────────────────────────┤"
echo "│ 1) Abrí (mismo proyecto que en .env):                                       │"
echo "│    https://supabase.com/dashboard/project/${REF}/settings/api              │"
echo "│ 2) Bajá hasta «Data API» / «Exposed schemas» (PostgREST).                   │"
echo "│ 3) Agregá el esquema:  wcreation   (dejá también public y graphql_public).  │"
echo "│ 4) Guardá cambios.                                                          │"
echo "│    Doc: https://supabase.com/docs/guides/api/using-custom-schemas          │"
echo "└─────────────────────────────────────────────────────────────────────────────┘"
echo ""

SEED_FAILED=0
echo "=== 3/4 Seed datos demo en Supabase (service role, sin SUPABASE_DB_URL) ==="
if bash "${ROOT_DIR}/scripts/supabase-seed.sh"; then
  echo "Seed Supabase OK."
else
  SEED_FAILED=1
  echo "" >&2
  echo ">>> Seed en la nube falló (típico: PGRST106 — falta exponer «wcreation»)." >&2
  echo ">>> Seguí el recuadro de arriba en el navegador, guardá, y ejecutá:" >&2
  echo ">>>   bash scripts/supabase-seed.sh" >&2
  echo "" >&2
fi

echo "=== 4/4 VPS local (PKI + devices_replica Timescale) ==="
bash "${ROOT_DIR}/scripts/seed-dev.sh"

echo ""
if [[ "${SEED_FAILED}" -eq 1 ]]; then
  echo "=== Atención ==="
  echo "  Migraciones y seed VPS local están OK."
  echo "  Supabase Cloud: corregí «Exposed schemas» y volvé a:  bash scripts/supabase-seed.sh"
  exit 1
fi

echo "=== Listo (opción B) ==="
echo "  • Esquema y datos en Supabase Cloud."
echo "  • Réplica local + certs: seed-dev."
echo "  • Siguiente: pnpm dev:all  y  pnpm emulator (o emulator:run)."
