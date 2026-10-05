"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ArrowRight } from "lucide-react";
import { useCart } from "@/store/cart-store";
import { useOrder } from "@/store/order-store";
import { STORAGE } from "@/lib/constants";
import { findProduct } from "@/data/products";
import { currency } from "@/lib/currency";
import {
  checkoutFields,
  validateCheckout,
  createDemoOrder,
} from "@/lib/checkout";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { CartSummary } from "./CartSummary";
const states = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];
export function CheckoutForm() {
  const items = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);
  const clear = useCart((s) => s.clear);
  const setOrder = useOrder((s) => s.setOrder);
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const lock = useRef(false);
  const summary = useRef<HTMLDivElement>(null);
  if (!hydrated) return <p role="status">Carregando sua seleção…</p>;
  if (!items.length)
    return <EmptyState title="Escolha seus essenciais primeiro." />;
  return (
    <div className="commerce-columns checkout-columns">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (lock.current) return;
          const data = new FormData(event.currentTarget);
          const invalid = validateCheckout(data);
          setErrors(invalid);
          if (Object.keys(invalid).length) {
            requestAnimationFrame(() => summary.current?.focus());
            return;
          }
          lock.current = true;
          setSubmitting(true);
          const order = createDemoOrder(items);
          setOrder(order);
          try {
            sessionStorage.setItem(STORAGE.order, JSON.stringify(order));
          } catch {
            /* In-memory receipt remains available. */
          }
          clear();
          router.push("/pedido-confirmado");
        }}
      >
        <div className="demo-note">
          <Check size={17} />
          <p>
            Checkout demonstrativo. Nenhuma cobrança será realizada.
            <br />
            Use dados fictícios para testar a experiência.
          </p>
        </div>
        {Object.keys(errors).length > 0 && (
          <div
            className="error-summary"
            role="alert"
            tabIndex={-1}
            ref={summary}
          >
            <strong>Confira os campos abaixo.</strong>
            <ul>
              {Object.entries(errors).map(([key, text]) => (
                <li key={key}>
                  <a href={`#checkout-${key}`}>{text}</a>
                </li>
              ))}
            </ul>
          </div>
        )}
        <fieldset>
          <legend>Seus dados</legend>
          <p className="muted">Campos obrigatórios, exceto complemento.</p>
          <div className="form-grid">
            {checkoutFields.map((field) => (
              <label
                key={field.name}
                className={
                  ["address", "name", "complement"].includes(field.name)
                    ? "field-wide"
                    : ""
                }
                htmlFor={`checkout-${field.name}`}
              >
                {field.label}
                <input
                  aria-label={field.label}
                  id={`checkout-${field.name}`}
                  name={field.name}
                  type={"type" in field ? field.type : "text"}
                  autoComplete={field.autoComplete}
                  required={!("optional" in field)}
                  maxLength={
                    field.name === "phone" ? 20 : field.name === "zip" ? 9 : 160
                  }
                  aria-invalid={Boolean(errors[field.name])}
                  aria-describedby={
                    errors[field.name] ? `error-${field.name}` : undefined
                  }
                />
                {errors[field.name] && (
                  <small className="field-error" id={`error-${field.name}`}>
                    {errors[field.name]}
                  </small>
                )}
              </label>
            ))}
            <label htmlFor="checkout-state">
              Estado
              <select
                aria-label="Estado"
                id="checkout-state"
                name="state"
                autoComplete="address-level1"
                defaultValue=""
                required
                aria-invalid={Boolean(errors.state)}
                aria-describedby={errors.state ? "error-state" : undefined}
              >
                <option value="">Selecione</option>
                {states.map((state) => (
                  <option key={state}>{state}</option>
                ))}
              </select>
              {errors.state && (
                <small className="field-error" id="error-state">
                  {errors.state}
                </small>
              )}
            </label>
          </div>
        </fieldset>
        <label className="checkbox-label demo-checkbox">
          <input
            id="checkout-demo"
            type="checkbox"
            name="demo"
            required
            aria-invalid={Boolean(errors.demo)}
            aria-describedby={errors.demo ? "error-demo" : undefined}
          />{" "}
          Entendo que este pedido é apenas uma demonstração.
        </label>
        {errors.demo && (
          <p className="field-error" id="error-demo">
            {errors.demo}
          </p>
        )}
        <Button type="submit" disabled={submitting} className="checkout-submit">
          {submitting ? "Finalizando…" : "Finalizar pedido"}
          <ArrowRight size={18} />
        </Button>
      </form>
      <aside className="summary-panel">
        <h2>Sua seleção</h2>
        <div className="checkout-items">
          {items.map((item) => {
            const p = findProduct(item.productId)!;
            return (
              <p key={`${item.productId}:${item.variant}`}>
                <span>
                  {item.quantity} × {p.name}
                  {item.variant ? ` · ${item.variant}` : ""}
                </span>
                <strong>{currency(p.price * item.quantity)}</strong>
              </p>
            );
          })}
        </div>
        <CartSummary checkout />
      </aside>
    </div>
  );
}
