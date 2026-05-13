import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeviceGrid } from "@/components/devices/DeviceGrid";
import { useDevices } from "@/hooks/useDevices";
import { useI18n } from "@/hooks/useI18n";
import { api, type EventRow } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export const Route = createFileRoute("/_authed/dashboard")({
  component: DashboardPage,
});

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{value}</p>
      </CardContent>
    </Card>
  );
}

function DashboardPage() {
  const { accessToken, auth } = useAuth();
  const { t, locale } = useI18n();
  const role = auth.profile?.role_code;
  const { data: devs } = useDevices();

  const summary = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      if (!accessToken) throw new Error("no token");
      return api.dashboardSummary(accessToken);
    },
    enabled: Boolean(accessToken) && role !== "public_viewer",
  });

  const tenants = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      if (!accessToken) throw new Error("no token");
      return api.tenants(accessToken);
    },
    enabled: Boolean(accessToken) && role === "superadmin",
  });

  const mergedEvents = useQuery({
    queryKey: ["dashboard-events", devs?.items.map((d) => d.id).join(",")],
    queryFn: async (): Promise<(EventRow & { device_label: string })[]> => {
      if (!accessToken || !devs?.items.length) return [];
      const heads = devs.items.slice(0, 8);
      const batches = await Promise.all(
        heads.map(async (d) => {
          const r = await api.events(accessToken, d.id, { limit: 12 });
          return r.items.map((e) => ({ ...e, device_label: d.nombre }));
        }),
      );
      return batches
        .flat()
        .sort((a, b) => b.ts.localeCompare(a.ts))
        .slice(0, 36);
    },
    enabled: Boolean(accessToken) && Boolean(devs?.items.length) && role !== "public_viewer",
  });

  const kpis = summary.data;

  const title =
    role === "superadmin"
      ? "Panel global"
      : role === "owner_admin"
        ? "Panel del tenant"
        : role === "responsable"
          ? "Panel de sucursal"
          : "Panel";

  const eventRows = useMemo(() => mergedEvents.data ?? [], [mergedEvents.data]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
        <p className="text-sm text-slate-500">{t("dashboardIntro")}</p>
      </div>

      {summary.isLoading ? <p className="text-sm text-slate-500">{t("loading")}</p> : null}
      {summary.isError ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {summary.error instanceof Error ? summary.error.message : String(summary.error)}
        </p>
      ) : null}
      {summary.isSuccess && kpis ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {role === "superadmin" && kpis.tenants_total != null ? (
            <Kpi label="Tenants activos" value={kpis.tenants_total} />
          ) : null}
          <Kpi label="Dispositivos" value={kpis.devices_total} />
          <Kpi label="Dispositivos activos" value={kpis.devices_activos} />
          <Kpi label="Eventos críticos (24 h)" value={kpis.critical_events_24h} />
          <Kpi label="Alertas (24 h)" value={kpis.alert_events_24h} />
          {role !== "superadmin" ? (
            <>
              <Kpi label="Pérdida cadena (30 d)" value={kpis.cadena_frio_perdida_mes} />
              <Kpi
                label="Batería prom. (último estado)"
                value={kpis.bateria_promedio_pct != null ? `${String(kpis.bateria_promedio_pct)}%` : "—"}
              />
              <Kpi label="Locales con alerta MV" value={kpis.devices_con_alerta_mv} />
            </>
          ) : null}
        </div>
      ) : null}

      {role === "superadmin" && tenants.data ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slug</TableHead>
                  <TableHead>Razón social</TableHead>
                  <TableHead>CUIT</TableHead>
                  <TableHead>Alta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.data.items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.slug}</TableCell>
                    <TableCell>{row.razon_social}</TableCell>
                    <TableCell>{row.cuit ?? "—"}</TableCell>
                    <TableCell>{formatDate(row.created_at, locale)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Dispositivos</h3>
          <DeviceGrid />
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Línea de tiempo reciente</h3>
          <Card>
            <CardContent className="space-y-3 py-4">
              {eventRows.length === 0 ? (
                <p className="text-xs text-slate-500">Sin eventos recientes.</p>
              ) : (
                eventRows.map((e) => (
                  <div key={e.id} className="border-b border-slate-100 pb-2 last:border-0 dark:border-slate-800">
                    <p className="font-mono text-[10px] text-slate-400">{formatDate(e.ts, locale)}</p>
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200">{e.device_label}</p>
                    <p className="font-mono text-[11px] text-slate-600">
                      {e.tipo} · {e.severidad}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
