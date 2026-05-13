import { useDevices } from "@/hooks/useDevices";
import { useDeviceLive } from "@/hooks/useDeviceLive";
import { useI18n } from "@/hooks/useI18n";
import { ApiError } from "@/lib/api";
import { DeviceCard } from "./DeviceCard";

export function DeviceGrid() {
  const { data, isLoading, isError, error } = useDevices();
  const { locale, t } = useI18n();
  const ids = data?.items.map((d) => d.id) ?? [];
  useDeviceLive(ids);

  if (isLoading) {
    return <p className="text-sm text-slate-500">{t("loading", { ns: "common" })}</p>;
  }
  if (isError) {
    const detail =
      error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);
    return (
      <div className="space-y-1 text-sm text-red-600 dark:text-red-400">
        <p>{t("errorLoad", { ns: "common" })}</p>
        <p className="break-all font-mono text-xs text-slate-700 dark:text-slate-300">{detail}</p>
      </div>
    );
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
