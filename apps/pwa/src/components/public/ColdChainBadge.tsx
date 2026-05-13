import { cn } from "@/lib/cn";
import { useI18n } from "@/hooks/useI18n";

export function ColdChainBadge({ estado }: { estado: "ok" | "alerta" | "critico" }) {
  const { t } = useI18n();
  const cfg =
    estado === "ok"
      ? {
          label: t("public:badgeOk"),
          className: "border-lime-600 bg-lime-100 text-lime-950",
        }
      : estado === "alerta"
        ? {
            label: t("public:badgeWarn"),
            className: "border-amber-600 bg-amber-100 text-amber-950",
          }
        : {
            label: t("public:badgeCrit"),
            className: "border-red-700 bg-red-100 text-red-950",
          };
  return (
    <div
      className={cn(
        "mx-auto flex max-w-md flex-col items-center justify-center rounded-md border-2 px-6 py-10 text-center shadow-sm",
        cfg.className,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700/80">WCreation</p>
      <p className="mt-4 text-2xl font-semibold leading-tight">{cfg.label}</p>
    </div>
  );
}
