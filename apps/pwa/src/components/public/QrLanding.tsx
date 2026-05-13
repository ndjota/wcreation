import { ColdChainBadge } from "@/components/public/ColdChainBadge";
import { PublicTempChart } from "@/components/public/PublicTempChart";
import { LangSwitcher } from "@/components/shared/LangSwitcher";
import { env } from "@/env";
import { formatRelative } from "@/lib/format";
import type { PublicQrResponse } from "@/lib/api";
import { api } from "@/lib/api";
import { useI18n } from "@/hooks/useI18n";
import { useMutation } from "@tanstack/react-query";
import { useMemo } from "react";

export function QrLanding({ token, data }: { token: string; data: PublicQrResponse }) {
  const { t, locale } = useI18n();
  const chart = data.chart_24h ?? [];
  const events = data.events_public ?? [];

  const reportMut = useMutation({
    mutationFn: () => api.publicQrReport(token),
    onSuccess: (res) => {
      window.open(res.download_url, "_blank", "noopener,noreferrer");
    },
  });

  const labels = useMemo(
    () => ({
        ok: t("public:eventOk"),
        incidente: t("public:eventIncident"),
      }),
    [t],
  );

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto flex w-full max-w-lg justify-end">
        <LangSwitcher />
      </div>
      <header className="mx-auto w-full max-w-lg text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">WCreation</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">{data.nombre_local}</h1>
      </header>
      <main className="mx-auto mt-8 flex w-full max-w-lg flex-1 flex-col gap-8">
        <ColdChainBadge estado={data.estado} />
        <p className="text-center text-sm text-slate-600">
          {data.ultima_verificacion
            ? t("public:lastCheck", { time: formatRelative(data.ultima_verificacion, locale) })
            : t("public:noRecent")}
        </p>

        {chart.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800">{t("public:chartTitle")}</h2>
            <p className="mt-1 text-xs text-slate-500">{t("public:chartLegend")}</p>
            <div className="mt-4">
              <PublicTempChart points={chart} />
            </div>
          </section>
        )}

        {events.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800">{t("public:eventsTitle")}</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {events.slice(0, 20).map((e) => (
                <li key={e.at} className="flex justify-between gap-3 border-b border-slate-100 pb-2 last:border-0">
                  <span>{e.kind === "verificacion_ok" ? labels.ok : labels.incidente}</span>
                  <span className="text-xs text-slate-500">
                    {formatRelative(e.at, locale)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="pb-4">
          <button
            type="button"
            disabled={reportMut.isPending}
            onClick={() => reportMut.mutate()}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
          >
            {reportMut.isPending ? t("common:loading") : t("public:downloadReport")}
          </button>
          {reportMut.isError && (
            <p className="mt-2 text-center text-xs text-red-700">{t("public:reportError")}</p>
          )}
        </div>
      </main>
      <footer className="mx-auto mt-8 w-full max-w-lg pb-6 text-center text-[11px] text-slate-500">
        <p>{t("public:footerSystem", { host: "wcreation.ndjota.io" })}</p>
        <p className="mt-1 text-slate-400">{t("public:footerPatente", { ref: env.VITE_PUBLIC_PATENTE_REF })}</p>
      </footer>
    </div>
  );
}
