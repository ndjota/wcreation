import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDevices } from "@/hooks/useDevices";
import { useI18n } from "@/hooks/useI18n";
import { api, type EventRow } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authed/events")({
  component: EventsPage,
});

function EventsPage() {
  const { accessToken } = useAuth();
  const { locale } = useI18n();
  const { t: te } = useTranslation("events");
  const { data: devs } = useDevices();

  const merged = useQuery({
    queryKey: ["all-events", devs?.items.map((d) => d.id).join(",")],
    queryFn: async (): Promise<(EventRow & { label: string })[]> => {
      if (!accessToken || !devs?.items.length) return [];
      const heads = devs.items.slice(0, 12);
      const batches = await Promise.all(
        heads.map(async (d) => {
          const r = await api.events(accessToken, d.id, { limit: 25 });
          return r.items.map((e) => ({ ...e, label: d.nombre }));
        }),
      );
      return batches.flat().sort((a, b) => b.ts.localeCompare(a.ts));
    },
    enabled: Boolean(accessToken) && Boolean(devs?.items.length),
  });

  const rows = useMemo(() => merged.data ?? [], [merged.data]);

  const exportCsv = () => {
    const header = ["ts", "device", "tipo", "severidad", "hash"].join(",");
    const esc = (v: string | number | boolean) => `"${String(v).replaceAll('"', '""')}"`;
    const lines = rows.map((e) => [e.ts, e.label, e.tipo, e.severidad, e.hash_sha256].map(esc).join(","));
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "events-export.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{te("title")}</h2>
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          onClick={exportCsv}
        >
          {te("exportCsv")}
        </button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ts</TableHead>
                <TableHead>Dispositivo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Severidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{formatDate(e.ts, locale)}</TableCell>
                  <TableCell>{e.label}</TableCell>
                  <TableCell>{e.tipo}</TableCell>
                  <TableCell>{e.severidad}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
