import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatTemp } from "@/lib/format";
import type { DeviceListItem } from "@/lib/api";
import { DeviceStatusBadge, deriveDeviceVisualState } from "./DeviceStatusBadge";
import { Link } from "@tanstack/react-router";
import { Activity, Battery, Thermometer } from "lucide-react";
import type { AppLocale } from "@/lib/format";

export function DeviceCard({
  device,
  locale,
}: {
  device: DeviceListItem;
  locale: AppLocale;
}) {
  const r = device.ultimo_estado_redis;
  const ts = (r?.ts) ?? device.vista_vps?.last_reading_ts ?? device.ultimo_visto;
  const v = deriveDeviceVisualState(device);
  const ring = v === "crit" ? "ring-2 ring-red-600/40" : v === "warn" ? "ring-2 ring-amber-500/40" : "";

  return (
    <Link to="/devices/$deviceId" params={{ deviceId: device.id }}>
      <Card className={`h-full transition-shadow hover:shadow-md ${ring}`}>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
          <div className="min-w-0">
            <CardTitle className="truncate text-sm font-semibold">{device.nombre}</CardTitle>
            <p className="font-mono text-[11px] text-slate-500">{device.serial_number}</p>
          </div>
          <DeviceStatusBadge device={device} />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="flex items-center gap-1 text-[10px] font-medium uppercase text-slate-500">
                <Thermometer className="h-3 w-3" /> int.
              </p>
              <p className="font-mono text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                {formatTemp(typeof r?.temp_interna === "number" ? r.temp_interna : null, locale)}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-[10px] font-medium uppercase text-slate-500">
                <Activity className="h-3 w-3" /> amb.
              </p>
              <p className="font-mono text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                {formatTemp(typeof r?.temp_ambiente === "number" ? r.temp_ambiente : null, locale)}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-[10px] font-medium uppercase text-slate-500">
                <Battery className="h-3 w-3" /> bat.
              </p>
              <p className="font-mono text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                {typeof r?.bateria_pct === "number" ? `${String(r.bateria_pct)}%` : "—"}
              </p>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            <span className="font-mono">{ts ? formatDate(ts, locale) : "—"}</span>
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
