import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import type { DeviceListItem } from "@/lib/api";

export type DeviceVisualState = "ok" | "warn" | "crit";

export function deriveDeviceVisualState(d: DeviceListItem): DeviceVisualState {
  const crit = d.vista_vps?.ultimos_eventos_criticos;
  if (Array.isArray(crit) && crit.length > 0) return "crit";

  const r = d.ultimo_estado_redis;
  const th = d.thresholds;
  if (!r || !th) return "ok";

  const ti = r.temp_interna;
  if (typeof ti === "number") {
    if (th.temp_interna_min != null && ti < th.temp_interna_min) return "warn";
    if (th.temp_interna_max != null && ti > th.temp_interna_max) return "warn";
  }
  const ta = r.temp_ambiente;
  if (typeof ta === "number") {
    if (th.temp_ambiente_min != null && ta < th.temp_ambiente_min) return "warn";
    if (th.temp_ambiente_max != null && ta > th.temp_ambiente_max) return "warn";
  }
  if (typeof r.bateria_pct === "number" && th.bateria_min_pct != null && r.bateria_pct < th.bateria_min_pct) {
    return "warn";
  }
  if (r.red_electrica === false) return "warn";
  return "ok";
}

export function DeviceStatusBadge({ device }: { device: DeviceListItem }) {
  const v = deriveDeviceVisualState(device);
  const { t } = useI18n();
  const label = v === "ok" ? t("devices:statusOk") : v === "warn" ? t("devices:statusWarn") : t("devices:statusCrit");
  const variant = v === "ok" ? "ok" : v === "warn" ? "warn" : "crit";
  return (
    <Badge variant={variant} className={cn("border font-mono text-[10px]")}>
      {label}
    </Badge>
  );
}
