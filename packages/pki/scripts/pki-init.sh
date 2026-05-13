#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
CA_DIR="${ROOT_DIR}/certs/ca"
INT_DIR="${ROOT_DIR}/certs/intermediate"
DEV_ROOT="${ROOT_DIR}/certs/devices"

if [[ -f "${CA_DIR}/ca.crt" ]]; then
  echo "PKI: ya existe ${CA_DIR}/ca.crt — no se regenera la CA."
  exit 0
fi

command -v openssl >/dev/null 2>&1 || {
  echo "Falta openssl en PATH." >&2
  exit 1
}

mkdir -p "${CA_DIR}" "${INT_DIR}" "${DEV_ROOT}" "${INT_DIR}/newcerts"

if [[ -n "${WCREATION_CA_PASSPHRASE:-}" ]]; then
  CA_PASS="${WCREATION_CA_PASSPHRASE}"
else
  read -r -s -p "Passphrase para la clave privada de la CA raíz (RSA 4096): " CA_PASS
  echo ""
fi
if [[ ${#CA_PASS} -lt 8 ]]; then
  echo "La passphrase debe tener al menos 8 caracteres." >&2
  exit 1
fi

printf '%s\n' "${CA_PASS}" | openssl genrsa -aes256 -passout stdin -out "${CA_DIR}/ca.key" 4096

printf '%s\n' "${CA_PASS}" | openssl req -new -x509 -days 7300 -sha256 \
  -key "${CA_DIR}/ca.key" -passin stdin \
  -subj "/CN=WCreation Root CA/O=WCreation/OU=root" \
  -extensions v3_root \
  -config <(
    printf '%s\n' \
      '[req]' \
      'distinguished_name = req_distinguished_name' \
      'x509_extensions = v3_root' \
      '[req_distinguished_name]' \
      '[v3_root]' \
      'subjectKeyIdentifier=hash' \
      'authorityKeyIdentifier=keyid:always,issuer' \
      'basicConstraints = critical, CA:TRUE' \
      'keyUsage = critical, keyCertSign, cRLSign'
  ) \
  -out "${CA_DIR}/ca.crt"

openssl genrsa -out "${INT_DIR}/intermediate.key" 4096
openssl req -new -key "${INT_DIR}/intermediate.key" \
  -subj "/CN=WCreation Issuing CA/O=WCreation/OU=issuing" \
  -out "${INT_DIR}/intermediate.csr"

echo 01 | tee "${CA_DIR}/ca.srl" >/dev/null

printf '%s\n' "${CA_PASS}" | openssl x509 -req -days 3650 -sha256 \
  -in "${INT_DIR}/intermediate.csr" \
  -CA "${CA_DIR}/ca.crt" -CAkey "${CA_DIR}/ca.key" -passin stdin \
  -CAserial "${CA_DIR}/ca.srl" \
  -extensions v3_int \
  -extfile <(
    printf '%s\n' \
      '[ v3_int ]' \
      'subjectKeyIdentifier=hash' \
      'authorityKeyIdentifier=keyid:always,issuer' \
      'basicConstraints = critical, CA:TRUE, pathlen:0' \
      'keyUsage = critical, keyCertSign, cRLSign'
  ) \
  -out "${INT_DIR}/intermediate.crt"

cat "${INT_DIR}/intermediate.crt" "${CA_DIR}/ca.crt" >"${CA_DIR}/ca-chain-verify-clients.pem"

: >"${INT_DIR}/index.txt"
touch "${INT_DIR}/index.txt.attr"
echo 1000 | tee "${INT_DIR}/serial" >/dev/null
echo 1000 | tee "${INT_DIR}/crlnumber" >/dev/null

cat >"${CA_DIR}/openssl.cnf.tpl" <<'EOF'
[ ca ]
default_ca = CA_intermediate

[ CA_intermediate ]
dir               = __INT_DIR__
database          = $dir/index.txt
new_certs_dir     = $dir/newcerts
serial            = $dir/serial
crlnumber         = $dir/crlnumber
crl               = $dir/crl.pem
private_key       = $dir/intermediate.key
certificate       = $dir/intermediate.crt
RANDFILE          = $dir/.rand
default_md        = sha256
name_opt          = ca_default
cert_opt          = ca_default
default_days      = 3650
default_crl_days  = 30
preserve          = no
policy            = policy_device
unique_subject    = no

[ policy_device ]
countryName            = optional
stateOrProvinceName    = optional
localityName           = optional
organizationName       = optional
organizationalUnitName = supplied
commonName             = supplied

[ req ]
default_bits       = 256
distinguished_name = req_dn
string_mask        = utf8only

[ req_dn ]

[ device_ext ]
basicConstraints = CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = clientAuth, serverAuth
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
EOF

sed "s|__INT_DIR__|${INT_DIR}|g" "${CA_DIR}/openssl.cnf.tpl" >"${CA_DIR}/openssl.cnf"
rm -f "${CA_DIR}/openssl.cnf.tpl"

chmod 700 "${INT_DIR}" "${CA_DIR}"
chmod 600 "${CA_DIR}/ca.key" "${INT_DIR}/intermediate.key" || true

echo "PKI: CA raíz e intermedia generadas en ${CA_DIR} y ${INT_DIR}."
