import type { SeriesPoint } from "@/types/admin";

const compactCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export function BarChart({
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
  const pad = { top: 26, right: 12, bottom: 38, left: 64 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;

  const max = Math.max(...data.map((d) => d.value)) * 1.12;
  const min = 0;
  const yAt = (v: number) => pad.top + innerH - ((v - min) / (max - min || 1)) * innerH;

  const slot = innerW / data.length;
  const barW = Math.min(44, slot * 0.52);
  const ticks = [0, 0.5, 1].map((f) => ({
    y: pad.top + innerH - f * innerH,
    value: min + f * max,
  }));

  return (
    <svg
      className="chart-svg"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={ariaLabel}
    >
      <title>{ariaLabel}</title>
      <defs>
        <linearGradient id="admin-bar-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            style={{ stopColor: "var(--brand-yellow)", stopOpacity: 0.95 }}
          />
          <stop
            offset="100%"
            style={{ stopColor: "var(--brand-orange)", stopOpacity: 0.35 }}
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

      {data.map((d) => {
        const i = data.indexOf(d);
        const x = pad.left + slot * i + (slot - barW) / 2;
        const y = yAt(d.value);
        const height = pad.top + innerH - y;
        return (
          <g key={d.label}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={height}
              rx={3}
              fill="url(#admin-bar-gradient)"
            />
            <text
              className="axis-text"
              x={x + barW / 2}
              y={y - 7}
              textAnchor="middle"
            >
              {formatValue(d.value)}
            </text>
            <text
              className="axis-text"
              x={x + barW / 2}
              y={h - 14}
              textAnchor="middle"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
