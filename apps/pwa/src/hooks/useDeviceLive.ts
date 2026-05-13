import { useAuth } from "@/lib/auth";
import type { WsMessage } from "@/lib/ws";
import { realtimeWs } from "@/lib/ws";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useI18n } from "./useI18n";

export function useDeviceLive(deviceIds: readonly string[]) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const idsKey = deviceIds.join(",");
  const lastToast = useRef<string>("");

  useEffect(() => {
    if (!accessToken || deviceIds.length === 0) return;
    realtimeWs.setAuthToken(accessToken);
    realtimeWs.setDeviceIds(deviceIds);
    const unsub = realtimeWs.subscribe((msg: WsMessage) => {
      if (msg.type === "reading") {
        void queryClient.invalidateQueries({ queryKey: ["devices"] });
        void queryClient.invalidateQueries({ queryKey: ["device", msg.device_id] });
        void queryClient.invalidateQueries({ queryKey: ["readings", msg.device_id] });
      }
      if (msg.type === "event") {
        void queryClient.invalidateQueries({ queryKey: ["devices"] });
        void queryClient.invalidateQueries({ queryKey: ["device", msg.device_id] });
        void queryClient.invalidateQueries({ queryKey: ["events", msg.device_id] });
        const sev = msg.event.severidad;
        if (sev === "critical") {
          const k = `${msg.device_id}-${msg.ts}`;
          if (lastToast.current !== k) {
            lastToast.current = k;
            toast.error(t("devices:criticalToastTitle"), {
              description: t("devices:criticalToastBody"),
              duration: 12_000,
            });
            if (localStorage.getItem("wc_notification_sound") === "1") {
              try {
                const ctx = new AudioContext();
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.connect(g);
                g.connect(ctx.destination);
                o.frequency.value = 880;
                g.gain.value = 0.04;
                o.start();
                o.stop(ctx.currentTime + 0.12);
              } catch {
                /* ignore */
              }
            }
          }
        }
      }
    });
    return () => {
      unsub();
    };
  }, [accessToken, idsKey, deviceIds, queryClient, t]);
}
