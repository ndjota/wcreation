import { getApiBaseUrl } from "@/env";
import { LangSwitcher } from "@/components/shared/LangSwitcher";
import { useI18n } from "@/hooks/useI18n";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/reports/verify/$reportId")({
  component: ReportVerifyPage,
});

interface VerifyPayload {
  report_id: string;
  emitido_en: string;
  period_from: string;
  period_to: string;
  formato: string;
  pdf_sha256: string;
  report_signature: string;
  dispositivo_nombre: string | null;
  dispositivo_serial: string | null;
  tenant_razon_social: string | null;
  emitido_por_sistema: boolean;
}

async function fetchVerify(id: string): Promise<VerifyPayload> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/reports/verify/${encodeURIComponent(id)}`);
  const data = (await res.json()) as VerifyPayload | { error: string };
  if (!res.ok) throw new Error("not_found");
  return data as VerifyPayload;
}

function ReportVerifyPage() {
  const { reportId } = Route.useParams();
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["report-verify", reportId],
    queryFn: () => fetchVerify(reportId),
  });
  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto flex max-w-lg justify-end">
        <LangSwitcher />
      </div>
      <div className="mx-auto mt-4 max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">{t("public:reportVerifyTitle")}</h1>
        {q.isLoading && <p className="mt-4 text-sm text-slate-600">{t("common:loading")}</p>}
        {q.isError && (
          <p className="mt-4 text-sm text-red-700">{t("public:reportVerifyNotFound")}</p>
        )}
        {q.data && (
          <dl className="mt-6 space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">{t("public:reportId")}</dt>
              <dd className="font-mono text-xs break-all">{q.data.report_id}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("public:issuedAt")}</dt>
              <dd>{new Date(q.data.emitido_en).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("public:period")}</dt>
              <dd>
                {q.data.period_from} — {q.data.period_to}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("public:pdfHash")}</dt>
              <dd className="font-mono text-xs break-all">{q.data.pdf_sha256}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("public:signature")}</dt>
              <dd className="font-mono text-xs break-all">{q.data.report_signature}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("public:device")}</dt>
              <dd>
                {q.data.dispositivo_nombre ?? "—"} ({q.data.dispositivo_serial ?? "—"})
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("public:tenant")}</dt>
              <dd>{q.data.tenant_razon_social ?? "—"}</dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
