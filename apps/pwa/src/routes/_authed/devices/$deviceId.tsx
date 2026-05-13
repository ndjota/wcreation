import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeviceStatusBadge } from "@/components/devices/DeviceStatusBadge";
import { EventsTimeline } from "@/components/devices/EventsTimeline";
import { ReadingsChart } from "@/components/devices/ReadingsChart";
import { ThresholdsForm } from "@/components/devices/ThresholdsForm";
import { useDeviceEvents } from "@/hooks/useEvents";
import { useDeviceReadings } from "@/hooks/useDeviceReadings";
import { useI18n } from "@/hooks/useI18n";
import { api, type DeviceDetail, type DeviceListItem } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { formatDate, formatTemp } from "@/lib/format";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { subDays, subHours } from "date-fns";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authed/devices/$deviceId")({
  component: DeviceDetailPage,
});

function listItemFromDetail(d: DeviceDetail): DeviceListItem {
  return {
    id: d.id,
    tenant_id: d.tenant_id,
    group_id: d.group_id,
    serial_number: d.serial_number,
    nombre: d.nombre,
    estado: d.estado,
    ultimo_visto: d.ultimo_visto,
    ubicacion: d.ubicacion,
    thresholds: d.device_thresholds,
    ultimo_estado_redis: d.ultimo_estado_redis,
    vista_vps: null,
  };
}

function DeviceDetailPage() {
  const { deviceId } = Route.useParams();
  const { accessToken, auth } = useAuth();
  const { t, locale } = useI18n();
  const { t: td } = useTranslation("devices");
  const [range, setRange] = useState<"24" | "48" | "7d" | "30d">("48");
  const [interval, setInterval] = useState<"raw" | "1m" | "5m" | "1h" | "1d">("5m");
  const [evTipo, setEvTipo] = useState<string>("");
  const [evSev, setEvSev] = useState<string>("");

  const deviceQ = useQuery({
    queryKey: ["device", deviceId],
    queryFn: async () => {
      if (!accessToken) throw new Error("no token");
      return api.device(accessToken, deviceId);
    },
    enabled: Boolean(accessToken && deviceId),
  });

  const rangeBounds = useMemo(() => {
    const to = new Date();
    const from =
      range === "24"
        ? subHours(to, 24)
        : range === "48"
          ? subHours(to, 48)
          : range === "7d"
            ? subDays(to, 7)
            : subDays(to, 30);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [range]);

  const readingsQ = useDeviceReadings(deviceId, rangeBounds, interval);

  const eventsQ = useDeviceEvents(deviceId, {
    ...(evTipo ? { tipo: evTipo } : {}),
    ...(evSev ? { severidad: evSev } : {}),
  });

  const accessPerm = useQuery({
    queryKey: ["uda", deviceId, auth.profile?.id],
    queryFn: async () => {
      if (!auth.profile?.id || !deviceId || auth.profile.role_code !== "responsable") return "owner" as const;
      const { data } = await supabase
        .schema("wcreation")
        .from("user_device_access")
        .select("permiso")
        .eq("user_id", auth.profile.id)
        .eq("device_id", deviceId)
        .maybeSingle();
      return (data?.permiso as "ver" | "configurar" | undefined) ?? null;
    },
    enabled: Boolean(deviceId && auth.profile?.id),
  });

  const d = deviceQ.data;
  const listItem = d ? listItemFromDetail(d) : null;

  const canEditThresholds =
    auth.profile?.role_code === "superadmin" ||
    auth.profile?.role_code === "owner_admin" ||
    (auth.profile?.role_code === "responsable" &&
      accessPerm.data === "configurar" &&
      Boolean(d?.device_thresholds?.modificable_por_responsable));

  const flatEvents = eventsQ.data?.pages.flatMap((p) => p.items) ?? [];

  const exportCsv = () => {
    const header = ["ts", "tipo", "severidad", "hash", "device_id"].join(",");
    const esc = (v: string | number | boolean) => `"${String(v).replaceAll('"', '""')}"`;
    const lines = flatEvents.map((e) => [e.ts, e.tipo, e.severidad, e.hash_sha256, e.device_id].map(esc).join(","));
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `events-${deviceId}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const [verifyResult, setVerifyResult] = useState<string | null>(null);

  const runVerify = async () => {
    if (!accessToken || !deviceId || flatEvents.length === 0) {
      setVerifyResult(td("selectEvent"));
      return;
    }
    const last = flatEvents[0];
    if (!last) return;
    const r = await api.verifyEvent(accessToken, deviceId, last.id);
    setVerifyResult(
      `${td("signatureOk")}: ${r.firma_valida ? "OK" : td("signatureBad")} · ${td("chainOk")}: ${r.cadena_valida ? "OK" : td("chainBad")}`,
    );
  };

  if (deviceQ.isLoading) return <p className="text-sm text-slate-500">{t("loading")}</p>;
  if (deviceQ.isError || !d) return <p className="text-sm text-red-600">{t("errorLoad")}</p>;
  if (!listItem) return null;

  const r = d.ultimo_estado_redis;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-slate-500">{d.serial_number}</p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">{d.nombre}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <DeviceStatusBadge device={listItem} />
            <Badge variant="outline">{d.estado}</Badge>
            <Link to="/devices" className="text-xs font-medium text-accent hover:underline">
              ← {t("nav.devices")}
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] uppercase text-slate-500">{td("kpiInterna")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-semibold">{formatTemp(typeof r?.temp_interna === "number" ? r.temp_interna : null, locale)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] uppercase text-slate-500">{td("kpiAmbiente")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-semibold">{formatTemp(typeof r?.temp_ambiente === "number" ? r.temp_ambiente : null, locale)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] uppercase text-slate-500">{td("kpiBateria")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-semibold">{typeof r?.bateria_pct === "number" ? `${r.bateria_pct}%` : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] uppercase text-slate-500">{td("kpiRed")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-semibold">{r?.red_electrica === false ? td("redOff") : td("redOn")}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{td("tabOverview")}</TabsTrigger>
          <TabsTrigger value="history">{td("tabHistory")}</TabsTrigger>
          <TabsTrigger value="events">{td("tabEvents")}</TabsTrigger>
          <TabsTrigger value="thresholds">{td("tabThresholds")}</TabsTrigger>
          <TabsTrigger value="cert">{td("tabCertificate")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardContent className="py-4 text-sm text-slate-600">
              <p className="font-mono text-xs">Última telemetría: {r?.ts ? formatDate(r.ts, locale) : "—"}</p>
              <p className="mt-2 text-xs">Firmware: {typeof r?.fw === "string" ? r.fw : "—"}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">{td("range24")}</SelectItem>
                <SelectItem value="48">{td("range48")}</SelectItem>
                <SelectItem value="7d">{td("range7d")}</SelectItem>
                <SelectItem value="30d">{td("range30d")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={interval} onValueChange={(v) => setInterval(v as typeof interval)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="raw">{td("intervalRaw")}</SelectItem>
                <SelectItem value="1m">1 min</SelectItem>
                <SelectItem value="5m">{td("interval5m")}</SelectItem>
                <SelectItem value="1h">{td("interval1h")}</SelectItem>
                <SelectItem value="1d">{td("interval1d")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Card>
            <CardContent className="pt-4">
              {readingsQ.isLoading ? (
                <p className="text-sm text-slate-500">{t("loading")}</p>
              ) : (
                <ReadingsChart items={readingsQ.data?.items ?? []} thresholds={d.device_thresholds} locale={locale} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input placeholder="tipo" value={evTipo} onChange={(e) => setEvTipo(e.target.value)} className="max-w-xs" />
            <Input placeholder="severidad" value={evSev} onChange={(e) => setEvSev(e.target.value)} className="max-w-xs" />
          </div>
          <EventsTimeline
            items={flatEvents}
            locale={locale}
            hasNext={eventsQ.hasNextPage}
            onLoadMore={() => void eventsQ.fetchNextPage()}
            onExportCsv={exportCsv}
          />
        </TabsContent>

        <TabsContent value="thresholds">
          <ThresholdsForm deviceId={deviceId} initial={d.device_thresholds} readOnly={!canEditThresholds} />
          {!canEditThresholds ? <p className="mt-2 text-xs text-slate-500">{td("readOnlyThresholds")}</p> : null}
        </TabsContent>

        <TabsContent value="cert" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{td("tabCertificate")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 font-mono text-xs">
              {d.certificado ? (
                <>
                  <p>
                    <span className="text-slate-500">Fingerprint</span> {d.certificado.fingerprint}
                  </p>
                  <p>
                    <span className="text-slate-500">CN</span> {d.certificado.common_name}
                  </p>
                  <p>
                    <span className="text-slate-500">Válido</span> {formatDate(d.certificado.emitido_en, locale)} —{" "}
                    {formatDate(d.certificado.expira_en, locale)}
                  </p>
                </>
              ) : (
                <p className="text-slate-500">Sin certificado registrado.</p>
              )}
              <Button type="button" variant="secondary" onClick={() => void runVerify()}>
                {td("verifyChain")}
              </Button>
              {verifyResult ? <p className="text-sm text-slate-700 dark:text-slate-300">{verifyResult}</p> : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
