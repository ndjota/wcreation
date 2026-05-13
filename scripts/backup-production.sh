#!/usr/bin/env bash
# Backup diario de producción WCreation (cron root recomendado).
# 1) pg_dump Timescale (VPS) comprimido con zstd
# 2) snapshot dinámico Traefik (Dokploy)
# 3) tarball comprimido de certificados (excluye ca/ca.key); cifrado simétrico GPG
# 4) subida opcional con rclone (Cloudflare R2 o Backblaze B2 recomendados + lifecycle en el bucket)
#
# Variables:
#   VPS_DATABASE_URL      — URL Postgres Timescale (obligatoria)
#   BACKUP_DIR            — directorio local (default /var/backups/wcreation)
#   TRAEFIK_DYNAMIC_DIR   — default /etc/dokploy/traefik/dynamic
#   WCREATION_CERTS_DIR   — default /etc/wcreation/certs
#   BACKUP_GPG_PASSPHRASE — obligatoria si existe WCREATION_CERTS_DIR
#   RCLONE_REMOTE         — ej. r2remote:wcreation/prod (opcional)
#
set -euo pipefail

TS="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/wcreation}"
TRAEFIK_DYNAMIC_DIR="${TRAEFIK_DYNAMIC_DIR:-/etc/dokploy/traefik/dynamic}"
WCREATION_CERTS_DIR="${WCREATION_CERTS_DIR:-/etc/wcreation/certs}"
STAGE="${BACKUP_DIR}/stage-${TS}"
mkdir -p "${STAGE}"

: "${VPS_DATABASE_URL:?definir VPS_DATABASE_URL}"

echo "[backup] pg_dump → ${STAGE}/timescale-${TS}.dump.zst"
pg_dump "${VPS_DATABASE_URL}" -Fc | zstd -10 -o "${STAGE}/timescale-${TS}.dump.zst"

if [[ -d "${TRAEFIK_DYNAMIC_DIR}" ]]; then
  echo "[backup] traefik dynamic"
  tar -C "${TRAEFIK_DYNAMIC_DIR}" -czf "${STAGE}/traefik-dynamic-${TS}.tar.gz" .
else
  echo "[backup] aviso: no existe ${TRAEFIK_DYNAMIC_DIR}, se omite snapshot Traefik"
fi

if [[ -d "${WCREATION_CERTS_DIR}" ]]; then
  : "${BACKUP_GPG_PASSPHRASE:?definir BACKUP_GPG_PASSPHRASE para cifrar el tarball de certs}"
  echo "[backup] certs (excluye ca/ca.key)"
  CERT_TGZ="${STAGE}/certs-${TS}.tar.gz"
  tar -C "$(dirname "${WCREATION_CERTS_DIR}")" --exclude='certs/ca/ca.key' -czf "${CERT_TGZ}" "$(basename "${WCREATION_CERTS_DIR}")"
  echo "${BACKUP_GPG_PASSPHRASE}" | gpg --batch --yes --passphrase-fd 0 --symmetric --cipher-algo AES256 -o "${CERT_TGZ}.gpg" "${CERT_TGZ}"
  rm -f "${CERT_TGZ}"
else
  echo "[backup] aviso: no existe ${WCREATION_CERTS_DIR}, se omite backup de certs"
fi

ARCHIVE="${BACKUP_DIR}/daily-${TS}.tar"
tar -C "${BACKUP_DIR}" -cf "${ARCHIVE}" "$(basename "${STAGE}")"
rm -rf "${STAGE}"

echo "[backup] archivo diario: ${ARCHIVE}"

find "${BACKUP_DIR}" -maxdepth 1 -name 'daily-*.tar' -mtime +7 -print -delete || true

if [[ -n "${RCLONE_REMOTE:-}" ]]; then
  echo "[backup] rclone → ${RCLONE_REMOTE}/daily/${TS}/"
  rclone copy "${ARCHIVE}" "${RCLONE_REMOTE}/daily/${TS}/"
fi

echo "[backup] listo."
