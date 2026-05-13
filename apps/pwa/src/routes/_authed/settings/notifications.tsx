import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { NOTIFICATION_EVENT_TIPOS } from "@wcreation/shared";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

export const Route = createFileRoute("/_authed/settings/notifications")({
  component: NotificationsPage,
});

type Canal = "email" | "push" | "telegram";

interface PrefRow {
  canal: Canal;
  evento_tipo: string;
  habilitado: boolean;
  telegram_chat_id?: string | null;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function NotificationsPage() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  const [sound, setSound] = useState(false);

  const prefsQ = useQuery({
    queryKey: ["notification-preferences", accessToken],
    queryFn: () => api.notificationPreferences(accessToken!),
    enabled: Boolean(accessToken),
  });

  const putPref = useMutation({
    mutationFn: (body: { canal: Canal; evento_tipo: string; habilitado: boolean }) =>
      api.putNotificationPreference(accessToken!, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
  });

  const items = (prefsQ.data?.items ?? []) as unknown as PrefRow[];

  const isOn = useCallback(
    (canal: Canal, tipo: string) => {
      return Boolean(items.find((p) => p.canal === canal && p.evento_tipo === tipo)?.habilitado);
    },
    [items],
  );

  const toggle = (canal: Canal, tipo: string, habilitado: boolean) => {
    if (!accessToken) return;
    void putPref.mutateAsync({ canal, evento_tipo: tipo, habilitado });
  };

  const linkTg = useMutation({
    mutationFn: () => api.telegramLink(accessToken!),
    onSuccess: (r) => {
      window.open(r.url, "_blank", "noopener,noreferrer");
    },
  });

  const subscribePush = useMutation({
    mutationFn: async () => {
      if (!accessToken) throw new Error("no_token");
      const { publicKey } = await api.pushVapidPublicKey(accessToken);
      if (!publicKey) throw new Error("no_vapid");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("bad_sub");
      await api.pushSubscribe(accessToken, {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        user_agent: navigator.userAgent,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
  });

  useEffect(() => {
    setSound(localStorage.getItem("wc_notification_sound") === "1");
  }, []);

  const hasTelegramLinked = items.some((p) => p.canal === "telegram" && p.telegram_chat_id);
  const pushConfigured = items.some((p) => p.canal === "push");

  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="text-lg font-semibold">Notificaciones</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Canales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Correo electrónico</p>
              <p className="text-xs text-slate-500">Usa el email de tu cuenta.</p>
            </div>
            <span className="text-xs text-slate-600">
              {prefsQ.data ? "configurado" : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Web Push</p>
              <p className="text-xs text-slate-500">
                {pushConfigured ? "Tenés preferencias push guardadas." : "Pendiente: activá push en este navegador."}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!accessToken || subscribePush.isPending}
              onClick={() => subscribePush.mutate()}
            >
              {subscribePush.isPending ? "…" : "Activar push"}
            </Button>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Telegram</p>
              <p className="text-xs text-slate-500">
                {hasTelegramLinked ? "Chat vinculado." : "Pendiente: abrí el enlace y tocá Iniciar."}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!accessToken || linkTg.isPending}
              onClick={() => linkTg.mutate()}
            >
              {linkTg.isPending ? "…" : "Linkear Telegram"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Eventos por canal</CardTitle>
        </CardHeader>
        <CardContent className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
          {NOTIFICATION_EVENT_TIPOS.map((tipo) => (
            <div key={tipo} className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{tipo}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {(["email", "push", "telegram"] as const).map((canal) => (
                  <div key={canal} className="flex items-center justify-between gap-2">
                    <Label className="text-xs capitalize">{canal}</Label>
                    <Switch
                      checked={isOn(canal, tipo)}
                      onCheckedChange={(c) => toggle(canal, tipo, c)}
                      disabled={!accessToken || putPref.isPending}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Preferencias locales</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-sm">Sonido ante evento crítico</Label>
            <p className="text-xs text-slate-500">Se reproduce un tono breve en este navegador.</p>
          </div>
          <Switch
            checked={sound}
            onCheckedChange={(c) => {
              setSound(c);
              localStorage.setItem("wc_notification_sound", c ? "1" : "0");
            }}
          />
        </CardContent>
      </Card>

      {subscribePush.isError && (
        <p className="text-xs text-red-700">No se pudo activar Web Push (¿HTTPS y permisos?).</p>
      )}
      {linkTg.isError && <p className="text-xs text-red-700">No se pudo generar el enlace de Telegram.</p>}
    </div>
  );
}
