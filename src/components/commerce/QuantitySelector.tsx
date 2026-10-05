"use client";
import { Minus, Plus } from "lucide-react";
export function QuantitySelector({
  value,
  onChange,
  max = 99,
  label = "produto",
}: {
  value: number;
  onChange: (value: number) => void;
  max?: number;
  label?: string;
}) {
  return (
    <div className="quantity">
      <button
        type="button"
        aria-label={`Diminuir quantidade de ${label}`}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={14} />
      </button>
      <output aria-label={`Quantidade de ${label}`}>{value}</output>
      <button
        type="button"
        aria-label={`Aumentar quantidade de ${label}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
