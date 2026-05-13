import type { RoleCode } from "./roles.js";

/** Identificador en tópicos MQTT: CN del certificado (= número de serie), no el UUID de Supabase. */
export type DeviceClientId = string;

export type TenantId = string;

export type DeviceId = string;

export type UserId = string;

export type GroupId = string;

export type PublicQrTokenId = string;

export type EstadoDispositivo = "provisionado" | "activo" | "inactivo" | "baja";

export type UserDevicePermiso = "ver" | "configurar";

export type NotificationCanal = "email" | "push" | "telegram";

export type EventoTipoNotificacion =
  | "umbral_temp"
  | "corte_red"
  | "puerta_prolongada"
  | "bateria_baja"
  | "dispositivo_offline"
  | "configuracion_modificada"
  | "cadena_frio_perdida";

/** Tipos de evento persistidos en Timescale (`wcreation.events.tipo`). */
export type EventoPersistidoTipo =
  | "umbral_excedido_temp"
  | "corte_red"
  | "puerta_prolongada"
  | "bateria_baja"
  | "dispositivo_offline"
  | "configuracion_modificada"
  | "cadena_frio_perdida";

export type Severidad = "info" | "warning" | "critical";

export interface Tenant {
  id: string;
  slug: string;
  razonSocial: string;
  cuit: string | null;
  createdAt: string;
}

export interface RoleRow {
  code: RoleCode;
  jerarquia: number;
  descripcion: string;
}

export interface User {
  id: UserId;
  tenantId: string | null;
  roleCode: RoleCode;
  email: string;
  nombre: string;
  activo: boolean;
}

export interface Group {
  id: GroupId;
  tenantId: string;
  nombre: string;
  responsableUserId: UserId | null;
}

export interface Device {
  id: DeviceId;
  tenantId: string;
  groupId: string | null;
  serialNumber: string;
  nombre: string;
  estado: EstadoDispositivo;
  ultimoVisto: string | null;
  ubicacionLat: number | null;
  ubicacionLng: number | null;
  ubicacionDescripcion: string | null;
}

export interface UserDeviceAccess {
  userId: UserId;
  deviceId: DeviceId;
  permiso: UserDevicePermiso;
}

export interface DeviceThresholds {
  deviceId: DeviceId;
  tempInternaMin: number | null;
  tempInternaMax: number | null;
  tempAmbienteMin: number | null;
  tempAmbienteMax: number | null;
  bateriaMinPct: number | null;
  corteRedMaxSeg: number | null;
  puertaAbiertaMaxSeg: number | null;
  modificablePorResponsable: boolean;
}

export interface PublicQrToken {
  id: PublicQrTokenId;
  deviceId: DeviceId | null;
  groupId: GroupId | null;
  tokenPublico: string;
  activo: boolean;
  creadoEn: string;
}

export interface NotificationPreference {
  userId: UserId;
  canal: NotificationCanal;
  eventoTipo: EventoTipoNotificacion;
  habilitado: boolean;
  telegramChatId: string | null;
}

export interface Reading {
  ts: string;
  deviceId: DeviceId;
  tempInterna: number | null;
  tempAmbiente: number | null;
  bateriaPct: number | null;
  redElectrica: boolean | null;
  puertaAbierta: boolean | null;
  rssiWifi: number | null;
  firmwareVersion: string | null;
}

export interface ColdChainEvent {
  id: string;
  ts: string;
  deviceId: DeviceId;
  tipo: EventoPersistidoTipo;
  severidad: Severidad;
  payload: Record<string, unknown>;
  hashSha256: string;
  hashAnterior: string | null;
}

export interface DeviceCertificate {
  id: string;
  deviceId: DeviceId;
  serialNumber: string;
  fingerprint: string;
  certPem: string;
  commonName: string;
  emitidoEn: string;
  expiraEn: string;
  revocadoEn: string | null;
  motivoRevocacion: string | null;
}
