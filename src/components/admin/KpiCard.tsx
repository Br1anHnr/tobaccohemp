import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  delta,
  direction,
  hint,
  icon,
}: {
  label: string;
  value: string;
  delta: number | null;
  direction: "up" | "down";
  hint: string;
  icon: ReactNode;
}) {
  const positive = direction === "up";
  return (
    <article className="kpi-card">
      <div className="kpi-card__top">
        <span className="kpi-card__label">{label}</span>
        <span className="kpi-card__icon" aria-hidden="true">
          {icon}
        </span>
      </div>
      <p className="kpi-card__value">{value}</p>
      <span className={`kpi-card__delta ${delta === null ? "" : positive ? "is-up" : "is-down"}`}>
        {delta === null ? null : positive ? (
          <ArrowUpRight size={14} aria-hidden="true" />
        ) : (
          <ArrowDownRight size={14} aria-hidden="true" />
        )}
        {delta === null ? "Sem comparação" : `${delta.toLocaleString("pt-BR")}%`}
      </span>
      <span className="kpi-card__hint">{hint}</span>
    </article>
  );
}
