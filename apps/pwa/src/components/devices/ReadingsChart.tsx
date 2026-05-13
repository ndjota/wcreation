import type { ReadingRow } from "@/lib/api";
import type { DeviceThresholdsRow } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { AppLocale } from "@/lib/format";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function ReadingsChart({
  items,
  thresholds,
  locale,
}: {
  items: ReadingRow[];
  thresholds: DeviceThresholdsRow | null;
  locale: AppLocale;
}) {
  const data = items.map((r) => ({
    t: r.ts,
    ti: r.temp_interna,
    ta: r.temp_ambiente,
  }));

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 6" stroke="currentColor" className="text-slate-200/80 dark:text-slate-800/80" />
          <XAxis
            dataKey="t"
            tickFormatter={(v) => formatDate(String(v), locale, true).split(",")[0] ?? ""}
            stroke="currentColor"
            className="text-[10px] text-slate-500"
            tick={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10 }}
            minTickGap={24}
          />
          <YAxis
            stroke="currentColor"
            className="text-[10px] text-slate-500"
            tick={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10 }}
            domain={["auto", "auto"]}
            width={36}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 6,
              border: "1px solid rgb(226 232 240)",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 11,
            }}
            labelFormatter={(v) => formatDate(String(v), locale)}
          />
          {thresholds?.temp_interna_min != null ? (
            <ReferenceLine y={thresholds.temp_interna_min} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} />
          ) : null}
          {thresholds?.temp_interna_max != null ? (
            <ReferenceLine y={thresholds.temp_interna_max} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} />
          ) : null}
          <Area type="monotone" dataKey="ti" stroke="#1e3a8a" fill="#1e3a8a" fillOpacity={0.08} strokeWidth={1.5} name="int." isAnimationActive={false} />
          <Line type="monotone" dataKey="ta" stroke="#64748b" strokeWidth={1.5} dot={false} name="amb." isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
