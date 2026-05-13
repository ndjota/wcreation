import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { AppLocale } from "@/lib/format";
import type { EventRow } from "@/lib/api";
import { useI18n } from "@/hooks/useI18n";

function sevVariant(s: string): "ok" | "warn" | "crit" | "default" {
  if (s === "critical") return "crit";
  if (s === "warning") return "warn";
  if (s === "info") return "ok";
  return "default";
}

export function EventsTimeline({
  items,
  locale,
  hasNext,
  onLoadMore,
  onExportCsv,
}: {
  items: EventRow[];
  locale: AppLocale;
  hasNext?: boolean;
  onLoadMore: () => void;
  onExportCsv: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onExportCsv}>
          {t("events:exportCsv")}
        </Button>
      </div>
      <ol className="relative space-y-4 border-l border-slate-200 pl-4 dark:border-slate-800">
        {items.map((e) => (
          <li key={e.id} className="ml-1">
            <div className="absolute -left-[5px] mt-1.5 h-2 w-2 rounded-full bg-slate-400 ring-4 ring-slate-50 dark:bg-slate-600 dark:ring-slate-950" />
            <div className="rounded-md border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={sevVariant(e.severidad)}>{e.severidad}</Badge>
                <span className="font-mono text-[11px] text-slate-500">{e.tipo}</span>
                <span className="font-mono text-[11px] text-slate-400">{formatDate(e.ts, locale)}</span>
              </div>
              <p className="mt-2 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                {e.hash_sha256.slice(0, 16)}…
              </p>
            </div>
          </li>
        ))}
      </ol>
      {hasNext ? (
        <Button type="button" variant="outline" size="sm" onClick={onLoadMore}>
          {t("common:loadMore")}
        </Button>
      ) : null}
    </div>
  );
}
