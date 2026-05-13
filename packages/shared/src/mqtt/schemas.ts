import type { JSONSchema7 } from "json-schema";

/** Telemetría periódica (Etapa 2 — formato plano acordado con firmware). */
export const mqttTelemetryPayloadV1Schema = {
  $id: "https://wcreation.ndjota.io/schemas/mqtt/telemetry-flat-v1.json",
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "WCreationTelemetryFlatV1",
  type: "object",
  additionalProperties: false,
  required: ["v", "ts", "temp_interna", "temp_ambiente", "bateria_pct", "red_electrica", "puerta_abierta", "rssi_wifi", "fw"],
  properties: {
    v: { type: "integer", const: 1 },
    ts: { type: "string", format: "date-time" },
    temp_interna: { type: "number" },
    temp_ambiente: { type: "number" },
    bateria_pct: { type: "integer", minimum: 0, maximum: 100 },
    red_electrica: { type: "boolean" },
    puerta_abierta: { type: "boolean" },
    rssi_wifi: { type: "integer" },
    fw: { type: "string", minLength: 1 },
  },
} as const satisfies JSONSchema7;

/** Evento ascendente desde dispositivo (alertas locales). */
export const mqttDeviceEventPayloadV1Schema = {
  $id: "https://wcreation.ndjota.io/schemas/mqtt/device-event-flat-v1.json",
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "WCreationDeviceEventFlatV1",
  type: "object",
  additionalProperties: true,
  required: ["v", "ts", "tipo", "severidad"],
  properties: {
    v: { type: "integer", const: 1 },
    ts: { type: "string", format: "date-time" },
    tipo: {
      type: "string",
      enum: [
        "umbral_excedido_temp",
        "corte_red",
        "puerta_prolongada",
        "bateria_baja",
        "dispositivo_offline",
        "configuracion_modificada",
        "cadena_frio_perdida",
      ],
    },
    severidad: { type: "string", enum: ["info", "warning", "critical"] },
    valor: { type: "number" },
    umbral: { type: "number" },
    contexto: { type: "object" },
  },
} as const satisfies JSONSchema7;

export const mqttStatusPayloadV1Schema = {
  $id: "https://wcreation.ndjota.io/schemas/mqtt/status-v1.json",
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "WCreationStatusV1",
  type: "object",
  additionalProperties: false,
  required: ["v", "ts", "estado"],
  properties: {
    v: { type: "integer", const: 1 },
    ts: { type: "string", format: "date-time" },
    estado: { type: "string", enum: ["online", "offline"] },
  },
} as const satisfies JSONSchema7;

/** Comando descendente (OTA, reconfiguración, ping). */
export const mqttCommandPayloadV1Schema = {
  $id: "https://wcreation.ndjota.io/schemas/mqtt/command-v1.json",
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "WCreationCommandV1",
  type: "object",
  additionalProperties: false,
  required: ["schema_version", "command_id", "tipo", "emitido_en"],
  properties: {
    schema_version: { type: "integer", const: 1 },
    command_id: { type: "string", format: "uuid" },
    tipo: {
      type: "string",
      enum: ["ping", "sync_clock", "request_config", "reboot", "ack"],
    },
    emitido_en: { type: "string", format: "date-time" },
    args: { type: "object" },
  },
} as const satisfies JSONSchema7;

export interface MqttTelemetryPayloadV1 {
  v: 1;
  ts: string;
  temp_interna: number;
  temp_ambiente: number;
  bateria_pct: number;
  red_electrica: boolean;
  puerta_abierta: boolean;
  rssi_wifi: number;
  fw: string;
}

export interface MqttDeviceEventPayloadV1 {
  v: 1;
  ts: string;
  tipo:
    | "umbral_excedido_temp"
    | "corte_red"
    | "puerta_prolongada"
    | "bateria_baja"
    | "dispositivo_offline"
    | "configuracion_modificada"
    | "cadena_frio_perdida";
  severidad: "info" | "warning" | "critical";
  valor?: number;
  umbral?: number;
  contexto?: Record<string, unknown>;
}

export interface MqttStatusPayloadV1 {
  v: 1;
  ts: string;
  estado: "online" | "offline";
}

export interface MqttCommandPayloadV1 {
  schema_version: 1;
  command_id: string;
  tipo: "ping" | "sync_clock" | "request_config" | "reboot" | "ack";
  emitido_en: string;
  args?: Record<string, unknown>;
}
