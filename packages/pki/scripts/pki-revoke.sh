#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
SERIAL="${1:?Uso: $0 SERIAL_NUMBER}"
CRT="${ROOT_DIR}/certs/devices/${SERIAL}/device.crt"
CA_CONF="${ROOT_DIR}/certs/ca/openssl.cnf"

[[ -f "${CRT}" ]] || {
  echo "No se encontró certificado en ${CRT}" >&2
  exit 1
}
[[ -f "${CA_CONF}" ]] || {
  echo "Falta ${CA_CONF}" >&2
  exit 1
}

openssl ca -config "${CA_CONF}" -revoke "${CRT}"
openssl ca -config "${CA_CONF}" -gencrl -out "${ROOT_DIR}/certs/intermediate/crl.pem"

echo "Certificado ${SERIAL} revocado. CRL: ${ROOT_DIR}/certs/intermediate/crl.pem"
