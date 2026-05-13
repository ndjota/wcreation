#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
BRK_DIR="${ROOT_DIR}/certs/broker"
INT_DIR="${ROOT_DIR}/certs/intermediate"
CA_DIR="${ROOT_DIR}/certs/ca"

[[ -f "${INT_DIR}/intermediate.key" && -f "${INT_DIR}/intermediate.crt" ]] || {
  echo "Falta la CA intermedia. Ejecutá packages/pki/scripts/pki-init.sh primero." >&2
  exit 1
}

mkdir -p "${BRK_DIR}"

openssl genrsa -out "${BRK_DIR}/server.key" 2048
openssl req -new -key "${BRK_DIR}/server.key" \
  -subj "/CN=emqx.wcreation.local/O=WCreation/OU=broker" \
  -out "${BRK_DIR}/server.csr"

SRL="${BRK_DIR}/broker.srl"
echo 01 | tee "${SRL}" >/dev/null

openssl x509 -req -days 825 -sha256 \
  -in "${BRK_DIR}/server.csr" \
  -CA "${INT_DIR}/intermediate.crt" -CAkey "${INT_DIR}/intermediate.key" \
  -CAserial "${SRL}" \
  -out "${BRK_DIR}/server.crt" \
  -extensions v3_broker \
  -extfile <(
    printf '%s\n' \
      '[ v3_broker ]' \
      'basicConstraints = CA:FALSE' \
      'keyUsage = critical, digitalSignature, keyEncipherment' \
      'extendedKeyUsage = serverAuth' \
      'subjectKeyIdentifier = hash' \
      'authorityKeyIdentifier = keyid:always,issuer' \
      'subjectAltName = DNS:localhost, DNS:emqx, IP:127.0.0.1'
  )

cp "${CA_DIR}/ca-chain-verify-clients.pem" "${BRK_DIR}/cacert.pem"
cp "${BRK_DIR}/server.crt" "${BRK_DIR}/cert.pem"
cp "${BRK_DIR}/server.key" "${BRK_DIR}/key.pem"
chmod 600 "${BRK_DIR}/server.key" || true
rm -f "${BRK_DIR}/server.csr"

echo "Certificados de broker generados en ${BRK_DIR}"
