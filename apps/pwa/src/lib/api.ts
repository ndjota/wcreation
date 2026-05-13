import { getApiBaseUrl } from "@/env";
import type { RoleCode } from "@wcreation/shared";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

export async function apiFetch<T>(
  path: string,
  opts: {
    method?: string;
    token: string | null;
    body?: unknown;
    headers?: Record<string, string>;
  },
): Promise<T> {
  const base = getApiBaseUrl();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...opts.headers,
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    credentials: "omit",
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent("wc:auth-expired"));
  }
  const data = await parseJson<T & { error?: string; message?: string }>(res);
  if (!res.ok) {
    let msg = `HTTP ${String(res.status)}`;
    if (typeof data === "object" && "message" in data) {
      const m = (data as { message?: unknown }).message;
      if (typeof m === "string") msg = m;
    }
    throw new ApiError(msg, res.status, data);
  }
  return data;
}

export interface DashboardSummary {
  tenants_total: number | null;
  devices_total: number;
  devices_activos: number;
  critical_events_24h: number;
  alert_events_24h: number;
  cadena_frio_perdida_mes: number;
  bateria_promedio_pct: number | null;
  devices_con_alerta_mv: number;
}

export interface TenantRow {
  id: string;
  slug: string;
  razon_social: string;
  cuit: string | null;
  created_at: string;
}

export interface DeviceThresholdsRow {
  device_id: string;
  temp_interna_min: number | null;
  temp_interna_max: number | null;
  temp_ambiente_min: number | null;
  temp_ambiente_max: number | null;
  bateria_min_pct: number | null;
  corte_red_max_seg: number | null;
  puerta_abierta_max_seg: number | null;
  modificable_por_responsable: boolean;
}

export interface DeviceLastRedis {
  ts?: string;
  temp_interna?: number;
  temp_ambiente?: number;
  bateria_pct?: number;
  red_electrica?: boolean;
  puerta_abierta?: boolean;
  rssi_wifi?: number;
  fw?: string;
}

export interface DeviceListItem {
  id: string;
  tenant_id: string;
  group_id: string | null;
  serial_number: string;
  nombre: string;
  estado: string;
  ultimo_visto: string | null;
  ubicacion: { lat: number | null; lng: number | null; descripcion: string | null };
  thresholds: DeviceThresholdsRow | null;
  ultimo_estado_redis: DeviceLastRedis | null;
  vista_vps: {
    last_reading_ts: string | null;
    ultimos_eventos_criticos: { severidad?: string; tipo?: string; ts?: string }[];
  } | null;
}

export interface DeviceDetail extends Omit<DeviceListItem, "thresholds" | "vista_vps"> {
  device_thresholds: DeviceThresholdsRow | null;
  ultimo_estado_redis: DeviceLastRedis | null;
  certificado: {
    fingerprint: string;
    common_name: string;
    emitido_en: string;
    expira_en: string;
    revocado_en: string | null;
  } | null;
}

export interface ReadingRow {
  ts: string;
  temp_interna: number | null;
  temp_ambiente: number | null;
  bateria_pct: number | null;
  red_electrica: boolean | null;
  puerta_abierta: boolean | null;
  rssi_wifi: number | null;
  firmware_version: string | null;
}

export interface EventRow {
  id: string;
  ts: string;
  device_id: string;
  tipo: string;
  severidad: string;
  payload: Record<string, unknown>;
  hash_sha256: string;
  hash_anterior: string | null;
}

export interface VerifyChainResult {
  firma_valida: boolean;
  cadena_valida: boolean;
  primer_hash: string | null;
  ultimo_hash: string;
  error?: string;
}

export interface PublicQrResponse {
  nombre_local: string;
  estado: "ok" | "alerta" | "critico";
  ultima_verificacion: string | null;
  chart_24h?: { bucket: string; in_range: boolean }[];
  thresholds?: { temp_interna_min: number | null; temp_interna_max: number | null };
  events_public?: { at: string; kind: "verificacion_ok" | "incidente_reportado" }[];
}

export interface UserProfileRow {
  id: string;
  tenant_id: string | null;
  role_code: RoleCode;
  email: string;
  nombre: string;
  activo: boolean;
}

export const api = {
  dashboardSummary: (token: string) => apiFetch<DashboardSummary>("/dashboard/summary", { token }),

  tenants: (token: string) => apiFetch<{ items: TenantRow[] }>("/tenants", { token }),

  devices: (token: string, query?: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    if (query?.group_id) q.set("group_id", query.group_id);
    if (query?.estado) q.set("estado", query.estado);
    if (query?.search) q.set("search", query.search);
    const s = q.toString();
    return apiFetch<{ items: DeviceListItem[] }>(`/devices${s ? `?${s}` : ""}`, { token });
  },

  device: (token: string, id: string) => apiFetch<DeviceDetail>(`/devices/${id}`, { token }),

  readings: (
    token: string,
    id: string,
    q: { from?: string; to?: string; interval?: string },
  ) => {
    const p = new URLSearchParams();
    if (q.from) p.set("from", q.from);
    if (q.to) p.set("to", q.to);
    if (q.interval) p.set("interval", q.interval);
    const s = p.toString();
    return apiFetch<{ items: ReadingRow[] }>(`/devices/${id}/readings${s ? `?${s}` : ""}`, { token });
  },

  events: (
    token: string,
    id: string,
    q: {
      limit?: number;
      cursor?: string;
      tipo?: string;
      severidad?: string;
      from?: string;
      to?: string;
    },
  ) => {
    const p = new URLSearchParams();
    if (q.limit) p.set("limit", String(q.limit));
    if (q.cursor) p.set("cursor", q.cursor);
    if (q.tipo) p.set("tipo", q.tipo);
    if (q.severidad) p.set("severidad", q.severidad);
    if (q.from) p.set("from", q.from);
    if (q.to) p.set("to", q.to);
    const s = p.toString();
    return apiFetch<{ items: EventRow[]; next_cursor: string | null }>(
      `/devices/${id}/events${s ? `?${s}` : ""}`,
      { token },
    );
  },

  verifyEvent: (token: string, deviceId: string, eventId: string) =>
    apiFetch<VerifyChainResult>(`/devices/${deviceId}/events/${eventId}/verify`, { token }),

  pushVapidPublicKey: (token: string) =>
    apiFetch<{ publicKey: string | null }>("/push/vapid-public-key", { token }),

  pushSubscribe: (
    token: string,
    body: { endpoint: string; keys: { p256dh: string; auth: string }; user_agent?: string },
  ) => apiFetch<{ ok: boolean }>("/push/subscribe", { method: "POST", token, body }),

  pushUnsubscribe: (token: string, endpoint: string) =>
    apiFetch<{ ok: boolean }>("/push/unsubscribe", { method: "POST", token, body: { endpoint } }),

  telegramLink: (token: string) =>
    apiFetch<{ url: string; token: string; expires_at: string }>("/telegram/link", { method: "POST", token }),

  notificationPreferences: (token: string) =>
    apiFetch<{ items: Record<string, unknown>[] }>("/notifications/preferences", { token }),

  putNotificationPreference: (
    token: string,
    body: {
      canal: "email" | "push" | "telegram";
      evento_tipo: string;
      habilitado: boolean;
      telegram_chat_id?: string | null;
    },
  ) => apiFetch<{ ok: boolean }>("/notifications/preferences", { method: "PUT", token, body }),

  coldChainReport: (
    token: string,
    body: { device_id: string; from: string; to: string; format: "pdf" | "csv"; locale?: "es-AR" | "en" },
  ) =>
    apiFetch<{ report_id: string; download_url: string; verify_url: string }>("/reports/cold-chain", {
      method: "POST",
      token,
      body,
    }),

  putThresholds: (token: string, deviceId: string, body: Partial<DeviceThresholdsRow>) =>
    apiFetch<{ ok: boolean; event_id: string }>(`/devices/${deviceId}/thresholds`, {
      method: "PUT",
      token,
      body,
    }),

  publicQr: (token: string) =>
    fetch(`${getApiBaseUrl()}/public/qr/${encodeURIComponent(token)}`).then(async (res) => {
      const data = (await res.json()) as PublicQrResponse | { error: string };
      if (!res.ok) throw new ApiError("token_invalido", res.status, data);
      return data as PublicQrResponse;
    }),

  publicQrReport: (token: string) =>
    fetch(`${getApiBaseUrl()}/public/qr/${encodeURIComponent(token)}/reports/cold-chain`, {
      method: "POST",
    }).then(async (res) => {
      const data = (await res.json()) as { report_id: string; download_url: string; verify_url: string };
      if (!res.ok) throw new ApiError("error", res.status, data);
      return data;
    }),
};
