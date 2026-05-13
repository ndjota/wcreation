import { memo } from "react";

/** Gráfico liviano (SVG) para vista pública: verde = en rango, rojo = fuera. */
export const PublicTempChart = memo(function PublicTempChart({
  points,
}: {
  points: { bucket: string; in_range: boolean }[];
}) {
  const w = 320;
  const h = 120;
  const pad = 8;
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${w} ${h}`}
      className="mx-auto max-w-full text-slate-800"
      role="img"
      aria-label="Temperatura últimas 24 horas"
    >
      <rect x="0" y="0" width={w} height={h} rx="12" fill="#f8fafc" stroke="#e2e8f0" />
      {points.map((p, i) => {
        const x = pad + i * step;
        const y0 = pad;
        const y1 = h - pad;
        const col = p.in_range ? "#bbf7d0" : "#fecaca";
        return <rect key={p.bucket} x={x - 4} y={y0} width="8" height={y1 - y0} fill={col} rx="3" />;
      })}
    </svg>
  );
});
