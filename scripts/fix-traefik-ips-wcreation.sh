#!/usr/bin/env bash
# WCreation — ajuste de IPs de confianza para Traefik v3 (patrón NDJota Infrastructure).
# Uso en el VPS:
#   export WCREATION_TRUSTED_IPS="168.231.117.14/32,127.0.0.1/32,::1/128"
#   bash scripts/fix-traefik-ips-wcreation.sh
#
# Opcional: escribir snippet comentado en un archivo para documentación local
#   export WCREATION_TRAEFIK_SNIPPET_PATH=/etc/dokploy/traefik/dynamic/wcreation-trusted-ips.fragment.yaml
#   bash scripts/fix-traefik-ips-wcreation.sh
#
set -euo pipefail

IPS="${WCREATION_TRUSTED_IPS:-168.231.117.14/32,127.0.0.1/32,::1/128}"
OUT="${WCREATION_TRAEFIK_SNIPPET_PATH:-}"

emit() {
  echo "# Generado por scripts/fix-traefik-ips-wcreation.sh"
  echo "# Incluir trustedIPs en entryPoints web / websecure (Traefik v3) según README NDJota."
  echo "#"
  echo "# entryPoints:"
  echo "#   web:"
  echo "#     forwardedHeaders:"
  echo "#       insecure: false"
  echo "#       trustedIPs:"
  echo "${IPS}" | tr ',' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep -v '^$' | while read -r c; do
    echo "#         - \"${c}\""
  done
  echo "#   websecure:"
  echo "#     forwardedHeaders:"
  echo "#       insecure: false"
  echo "#       trustedIPs:"
  echo "${IPS}" | tr ',' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep -v '^$' | while read -r c; do
    echo "#         - \"${c}\""
  done
  echo "#"
  echo "# Si usás Cloudflare u otro proxy, agregá sus rangos CIDR oficiales además del VPS."
}

if [[ -n "${OUT}" ]]; then
  emit > "${OUT}.tmp"
  mv "${OUT}.tmp" "${OUT}"
  echo "Escrito ${OUT}" >&2
else
  emit
fi
