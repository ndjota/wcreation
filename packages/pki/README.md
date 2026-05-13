# PKI WCreation (OpenSSL)

Este paquete documenta la **cadena de confianza** generada por los scripts en **`packages/pki/scripts/`** (los archivos `scripts/pki-*.sh` en la raíz del repo solo reenvían a estos):

- `pki-init.sh`: CA raíz (RSA 4096, passphrase obligatoria salvo `WCREATION_CA_PASSPHRASE`) e **intermedia** de emisión.
- `pki-broker.sh`: certificado de servidor para EMQX (montado en `certs/broker/`).
- `pki-new-device.sh`: certificado de dispositivo **EC P-256** firmado por la intermedia.
- `pki-revoke.sh`: revocación y regeneración de **CRL** sobre la base OpenSSL `ca` de la intermedia.

## Seguridad de claves privadas

- **No subas** `certs/` al repositorio: las claves y certificados emitidos están en `.gitignore`.
- La **clave de la CA raíz** (`certs/ca/ca.key`) debe vivir fuera del VPS de ingestión o en un HSM/bóveda; en desarrollo local basta con permisos estrictos (`chmod 600`).
- La **intermedia** (`certs/intermediate/intermediate.key`) puede operar en el servidor de firma de dispositivos; rotala si se compromete.
- Las claves de dispositivo (`certs/devices/*/device.key`) simulan firmware; en producción se graban en fábrica y **nunca** se versionan.

En **macOS con OpenSSL 3**, `pki-init.sh` usa `-passin stdin` / `-passout stdin` para la CA raíz porque el esquema `pass:…` puede fallar en entornos sin TTY con claves PKCS#8 cifradas.

## Automatización sin TTY

```bash
export WCREATION_CA_PASSPHRASE='(mínimo 8 caracteres)'
bash scripts/pki-init.sh
```
