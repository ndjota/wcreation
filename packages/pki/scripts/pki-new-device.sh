#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
SERIAL="${1:?Uso: $0 SERIAL_NUMBER (ej: SN-DEV-001)}"
OUT_DIR="${ROOT_DIR}/certs/devices/${SERIAL}"
CA_CONF="${ROOT_DIR}/certs/ca/openssl.cnf"

[[ -f "${ROOT_DIR}/certs/intermediate/intermediate.crt" ]] || {
  echo "Falta la CA intermedia. Ejecutá primero packages/pki/scripts/pki-init.sh (o bash scripts/setup.sh)." >&2
  exit 1
}
[[ -f "${CA_CONF}" ]] || {
  echo "Falta ${CA_CONF}. Ejecutá pki-init." >&2
  exit 1
}

mkdir -p "${OUT_DIR}"
cd "${OUT_DIR}"

if [[ -f device.crt ]]; then
  echo "PKI: ya existe ${OUT_DIR}/device.crt — no se reemite."
  openssl x509 -in device.crt -noout -fingerprint -sha256 | sed 's/^SHA256 Fingerprint=//'
  exit 0
fi

openssl ecparam -name prime256v1 -genkey -out device.key
openssl req -new -key device.key \
  -subj "/CN=${SERIAL}/OU=device/O=WCreation" \
  -out device.csr

openssl ca -batch -config "${CA_CONF}" \
  -in device.csr -out device.crt -extensions device_ext -days 3650

cat "${ROOT_DIR}/certs/intermediate/intermediate.crt" "${ROOT_DIR}/certs/ca/ca.crt" >ca-chain.crt

FP="$(openssl x509 -in device.crt -noout -fingerprint -sha256 | sed 's/^SHA256 Fingerprint=//')"
echo "Certificado emitido en ${OUT_DIR}"
echo "Fingerprint SHA-256: ${FP}"
