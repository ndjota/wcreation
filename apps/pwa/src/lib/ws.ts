export type WsMessage =
  | {
      type: "reading";
      device_id: string;
      data: Record<string, unknown>;
      ts: string;
    }
  | {
      type: "event";
      device_id: string;
      event: { tipo?: string; severidad?: string; payload?: Record<string, unknown> };
      ts: string;
    };

import { getWsBaseUrl } from "@/env";

type Listener = (msg: WsMessage) => void;

/** WebSocket singleton con reconexión exponencial suave. */
class RealtimeConnection {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private deviceIds = new Set<string>();
  private listeners = new Set<Listener>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setAuthToken(token: string | null): void {
    this.token = token;
    if (!token) {
      this.close();
      return;
    }
    this.connect();
  }

  setDeviceIds(ids: readonly string[]): void {
    this.deviceIds = new Set(ids);
    this.sendSubscribe();
  }

  private emit(msg: WsMessage): void {
    for (const l of this.listeners) l(msg);
  }

  private close(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    if (!this.token) return;
    if (this.reconnectTimer) return;
    const delay = Math.min(30_000, 800 * 2 ** this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private sendSubscribe(): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const device_ids = [...this.deviceIds];
    if (device_ids.length === 0) return;
    this.ws.send(JSON.stringify({ action: "subscribe", device_ids }));
  }

  private connect(): void {
    if (!this.token) return;
    this.close();
    const base = getWsBaseUrl();
    const url = new URL(`${base}/ws/realtime`);
    url.searchParams.set("access_token", this.token);
    const ws = new WebSocket(url.toString());
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.sendSubscribe();
    };

    ws.onmessage = (ev) => {
      try {
        const raw = JSON.parse(String(ev.data)) as WsMessage;
        if (typeof raw === "object" && "type" in raw) this.emit(raw);
      } catch {
        /* ignore */
      }
    };

    ws.onclose = () => {
      this.ws = null;
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };
  }
}

export const realtimeWs = new RealtimeConnection();
