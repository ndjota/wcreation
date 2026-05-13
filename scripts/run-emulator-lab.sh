#!/usr/bin/env bash
# Laboratorio EMQX:
#   sin args o "menu"  → menú interactivo (ABM sensores, scripts/emulator/lab-state.json)
#   "run"              → solo publicación MQTT (lab-emulator; acepta --init, etc.)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if [[ ! -f "${ROOT_DIR}/certs/devices/SN-DEV-001/device.crt" ]]; then
  echo "Falta certificado del dispositivo demo. Corré primero:" >&2
  echo "  bash scripts/seed-dev.sh" >&2
  exit 1
fi

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "${NVM_DIR}/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  source "${NVM_DIR}/nvm.sh"
  command -v nvm >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 || true
fi

SUB="${1:-menu}"
if [[ "$SUB" == "run" ]]; then
  shift
  exec pnpm --filter @wcreation/mqtt-bridge lab-emulator -- "$@"
fi

if [[ $# -ge 1 && "$1" == "menu" ]]; then
  shift
fi

exec pnpm --filter @wcreation/mqtt-bridge lab-menu -- "$@"
