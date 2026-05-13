/** Tipos de evento que disparan notificaciones (alineados con VPS `wcreation.events`). */
import type { NotificationCanal } from "./models.js";

export const NOTIFICATION_EVENT_TIPOS = [
  "umbral_excedido_temp",
  "corte_red",
  "puerta_prolongada",
  "bateria_baja",
  "dispositivo_offline",
  "cadena_frio_perdida",
] as const;

export type NotificationEventTipo = (typeof NOTIFICATION_EVENT_TIPOS)[number];

/** Canales permitidos por tipo (plantillas y envío). */
export function canalesParaTipoEvento(tipo: string): NotificationCanal[] {
  switch (tipo) {
    case "umbral_excedido_temp":
    case "corte_red":
    case "dispositivo_offline":
      return ["email", "push", "telegram"];
    case "puerta_prolongada":
      return ["push", "telegram"];
    case "bateria_baja":
      return ["telegram"];
    case "cadena_frio_perdida":
      return ["email", "push", "telegram"];
    default:
      return [];
  }
}

export function esEventoCritico(tipo: string): boolean {
  return tipo === "cadena_frio_perdida" || tipo === "corte_red" || tipo === "umbral_excedido_temp";
}
