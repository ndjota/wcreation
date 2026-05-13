import { useDevices } from "@/hooks/useDevices";
import { useDeviceLive } from "@/hooks/useDeviceLive";
import { useI18n } from "@/hooks/useI18n";
import { DeviceCard } from "./DeviceCard";

export function DeviceGrid() {
  const { data, isLoading, isError } = useDevices();
  const { locale, t } = useI18n();
  const ids = data?.items.map((d) => d.id) ?? [];
  useDeviceLive(ids);

  if (isLoading) {
    return <p className="text-sm text-slate-500">{t("loading", { ns: "common" })}</p>;
  }
  if (isError) {
    return <p className="text-sm text-red-600">{t("errorLoad", { ns: "common" })}</p>;
  }
  const items = data?.items ?? [];
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">{t("none", { ns: "devices" })}</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((d) => (
        <DeviceCard key={d.id} device={d} locale={locale} />
      ))}
    </div>
  );
}
