/**
 * Convención de tópicos MQTT (v1):
 * - El tercer segmento es el identificador del cliente mTLS (CN del certificado),
 *   que coincide con `serial_number` en Supabase/VPS (no el UUID).
 * - EMQX ACL usa `${username}` = CN → `wcreation/{tenant_id}/{serial}/...`
 */
export const MQTT_TOPIC_PREFIX = "wcreation" as const;

export type MqttTelemetrySubtopic = "telemetry";
export type MqttEventSubtopic = "event";
export type MqttStatusSubtopic = "status";
export type MqttCommandRoot = "cmd";

/** Segmento de tópico = CN del certificado = número de serie del dispositivo. */
export function mqttTelemetryTopic(tenantId: string, topicSegment: string): string {
  return `${MQTT_TOPIC_PREFIX}/${tenantId}/${topicSegment}/telemetry`;
}

export function mqttEventTopic(tenantId: string, topicSegment: string): string {
  return `${MQTT_TOPIC_PREFIX}/${tenantId}/${topicSegment}/event`;
}

export function mqttStatusTopic(tenantId: string, topicSegment: string): string {
  return `${MQTT_TOPIC_PREFIX}/${tenantId}/${topicSegment}/status`;
}

export function mqttCommandTopicPrefix(tenantId: string, topicSegment: string): string {
  return `${MQTT_TOPIC_PREFIX}/${tenantId}/${topicSegment}/cmd`;
}

/** Patrones para documentación / ACL en EMQX. */
export const MQTT_ACL = {
  publishTelemetryPattern: "wcreation/+/+/telemetry",
  publishEventPattern: "wcreation/+/+/event",
  publishStatusPattern: "wcreation/+/+/status",
  subscribeCommandPattern: "wcreation/+/+/cmd/#",
} as const;
