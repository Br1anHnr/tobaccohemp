import type { SeriesPoint } from "@/types/admin";

const compactCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export function LineChart({
  data,
  ariaLabel,
  formatValue = (n) => compactCurrency.format(n),
}: {
  data: SeriesPoint[];
  ariaLabel: string;
  formatValue?: (n: number) => string;
}) {
  const w = 640;
  const h = 240;
  const pad = { top: 18, right: 16, bottom: 28, left: 64 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;

  const values = data.map((d) => d.value);
  const max = Math.max(...values) * 1.12;
  const min = 0;

  const xAt = (i: number) =>
    pad.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const yAt = (v: number) => pad.top + innerH - ((v - min) / (max - min || 1)) * innerH;

  const coords = data.map((d, i) => ({ x: xAt(i), y: yAt(d.value), ...d }));
  const linePath = coords
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const baseline = (pad.top + innerH).toFixed(1);
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${baseline} L ${coords[0].x.toFixed(1)} ${baseline} Z`;

  const ticks = [0, 0.5, 1].map((f) => ({
    y: pad.top + innerH - f * innerH,
    value: min + f * max,
  }));

  const labelIndices = [0, Math.floor(coords.length / 2), coords.length - 1].filter(
    (v, i, a) => a.indexOf(v) === i,
  );

  return (
    <svg
      className="chart-svg"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={ariaLabel}
    >
      <title>{ariaLabel}</title>
      <defs>
        <linearGradient id="admin-area" x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            style={{ stopColor: "var(--brand-yellow)", stopOpacity: 0.32 }}
          />
          <stop
            offset="100%"
            style={{ stopColor: "var(--brand-yellow)", stopOpacity: 0 }}
          />
        </linearGradient>
      </defs>

      {ticks.map((t) => (
        <g key={t.y}>
          <line
            className="grid-line"
            x1={pad.left}
            x2={w - pad.right}
            y1={t.y}
            y2={t.y}
          />
          <text
            className="axis-text"
            x={pad.left - 8}
            y={t.y + 3}
            textAnchor="end"
          >
            {formatValue(t.value)}
          </text>
        </g>
      ))}

      <path className="area" d={areaPath} fill="url(#admin-area)" />
      <path className="line" d={linePath} />
      {coords.map((p) => (
        <circle key={p.label} className="point" cx={p.x} cy={p.y} r={3} />
      ))}

      {labelIndices.map((i) => (
        <text
          key={data[i].label}
          className="axis-text"
          x={coords[i].x}
          y={h - 8}
          textAnchor={i === 0 ? "start" : i === coords.length - 1 ? "end" : "middle"}
        >
          {data[i].label}
        </text>
      ))}
    </svg>
  );
}
