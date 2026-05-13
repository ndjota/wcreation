#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if ! command -v supabase >/dev/null 2>&1; then
  echo "Instalá la CLI: https://supabase.com/docs/guides/cli" >&2
  exit 1
fi

if [[ ! -f "${ROOT_DIR}/supabase/config.toml" ]]; then
  echo "Falta supabase/config.toml. Ejecutá: supabase init (en la raíz del repo) o copiá el template del README." >&2
  exit 1
fi

echo "Sincronizando SQL desde packages/db-supabase/migrations → supabase/migrations …"
mkdir -p "${ROOT_DIR}/supabase/migrations"
rm -f "${ROOT_DIR}/supabase/migrations/"*.sql
cp "${ROOT_DIR}/packages/db-supabase/migrations/"*.sql "${ROOT_DIR}/supabase/migrations/"

linked_marker="${ROOT_DIR}/supabase/.temp/linked-project.json"
legacy_linked="${ROOT_DIR}/.supabase"

if [[ ! -f "${linked_marker}" ]] && [[ ! -d "${legacy_linked}" ]] && [[ -n "${SUPABASE_PROJECT_REF:-}" ]]; then
  echo "Vinculando proyecto remoto (${SUPABASE_PROJECT_REF})…"
  (cd "${ROOT_DIR}" && supabase link --project-ref "${SUPABASE_PROJECT_REF}")
fi

if [[ ! -f "${linked_marker}" ]] && [[ ! -d "${legacy_linked}" ]]; then
  echo "No hay proyecto vinculado. Definí SUPABASE_PROJECT_REF y volvé a ejecutar, o ejecutá desde la raíz:" >&2
  echo "  supabase link --project-ref TU_REF" >&2
  exit 1
fi

echo "Aplicando migraciones remotas (supabase db push) …"
(cd "${ROOT_DIR}" && supabase db push --linked --yes "$@")

echo "Listo. Verificá en el dashboard de Supabase la pestaña SQL / Database."
echo ""
echo "Si vas a usar supabase-seed.sh (API): en Settings → Data API agregá el esquema «wcreation»"
echo "a «Exposed schemas» (ver https://supabase.com/docs/guides/api/using-custom-schemas )."
