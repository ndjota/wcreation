# Retención de datos y compliance

## Readings (telemetría serie temporal)

- **Retención objetivo**: **5 años** en TimescaleDB, alineado a trazabilidad regulatoria típica de cadena de frío.
- Implementación: políticas de compresión y retención Timescale (`add_retention_policy`) según evolución del volumen; documentar en migraciones VPS cuando se active el job automático.

## Eventos

- **Eventos de severidad `critical`**: retención **indefinida** en almacenamiento frío o tabla dedicada con políticas de archivo (export a objeto + referencia), según costo.
- **Otros eventos**: retención negociable por tenant (p. ej. 24–36 meses) salvo obligación legal distinta.

## Reportes PDF

- Almacenados en **Supabase Storage** (`cold-chain-reports`); la cadena de custodia incluye hash y firma en tabla `cold_chain_reports`.

## Backups

- **VPS**: script diario con retención local 7 días y copia remota; lifecycle en bucket (R2 recomendado por costo y reglas de expiración por prefijo).
- **Supabase**: backups gestionados por el plan (PITR en Pro; diarios en Free). Los datos operacionales críticos siguen existiendo también en exports PDF firmados.

## Derechos de titulares

- Procedimientos de exportación y borrado deben implementarse según política legal del responsable del tratamiento (el tenant / operador), usando herramientas Supabase y scripts auditados.
