"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { useCart } from "@/store/cart-store";
import { useAccount } from "@/store/account-store";
import { useCatalog } from "@/store/catalog-store";
import { useOrder } from "@/store/order-store";
import { BRAZIL_STATES, STORAGE } from "@/lib/constants";
import { currency } from "@/lib/currency";
import {
  checkoutFields,
  validateCheckout,
  createDemoOrder,
  evaluateCartEligibility,
} from "@/lib/checkout";
import { ONLINE_COMMERCE_POLICY } from "@/modules/orders/domain/eligibility";
import type { OrderChannel, OrderPaymentMethod } from "@/shared/contracts/orders";
import type { CustomerProfile } from "@/types/account";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { CartSummary } from "./CartSummary";

type CheckoutFieldKey = (typeof checkoutFields)[number]["name"] | "state";

function accountFieldDefault(
  customer: CustomerProfile | null,
  field: CheckoutFieldKey,
): string {
  if (!customer) return "";
  switch (field) {
    case "name":
      return customer.name;
    case "email":
      return customer.email;
    case "phone":
      return customer.phone;
    case "city":
      return customer.city;
    case "state":
      return customer.state;
    default:
      return "";
  }
}

export function CheckoutForm() {
  const items = useCart((s) => s.items);
  const cartHydrated = useCart((s) => s.hydrated);
  const accountHydrated = useAccount((s) => s.hydrated);
  const customer = useAccount((s) => s.customer);
  const products = useCatalog((s) => s.products);
  const clear = useCart((s) => s.clear);
  const setOrder = useOrder((s) => s.setOrder);
  const router = useRouter();
  const [overrides, setOverrides] = useState<
    Partial<Record<CheckoutFieldKey, string>>
  >({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [eligibilityError, setEligibilityError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [channel, setChannel] = useState<OrderChannel>("site");
  const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethod>("pix");
  const lock = useRef(false);
  const summary = useRef<HTMLDivElement>(null);

  if (!cartHydrated || !accountHydrated)
    return <p role="status">Carregando sua seleção…</p>;
  if (!items.length)
    return <EmptyState title="Escolha seus essenciais primeiro." />;

  const eligibility = evaluateCartEligibility(items, products);
  const fieldValue = (name: CheckoutFieldKey) =>
    overrides[name] ?? accountFieldDefault(customer, name);
  const setFieldValue = (name: CheckoutFieldKey, value: string) =>
    setOverrides((prev) => ({ ...prev, [name]: value }));

  return (
    <div className="commerce-columns checkout-columns">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (lock.current) return;
          if (!eligibility.allowed) {
            setEligibilityError(
              eligibility.blockedReasons[0] ??
                "Há itens não elegíveis para pedido online.",
            );
            return;
          }
          const data = new FormData(event.currentTarget);
          const invalid = validateCheckout(data);
          setErrors(invalid);
          if (Object.keys(invalid).length) {
            requestAnimationFrame(() => summary.current?.focus());
            return;
          }
          lock.current = true;
          setSubmitting(true);
          try {
            const order = createDemoOrder(items, {
              channel,
              paymentMethod,
              products,
            });
            setOrder(order);
            try {
              sessionStorage.setItem(STORAGE.order, JSON.stringify(order));
            } catch {
              /* In-memory receipt remains available. */
            }
            clear();
            router.push("/pedido-confirmado");
          } catch (cause) {
            lock.current = false;
            setSubmitting(false);
            setEligibilityError(
              cause instanceof Error
                ? cause.message
                : "Não foi possível gerar o pedido demonstrativo.",
            );
          }
        }}
      >
        <div className="demo-note">
          <Check size={17} aria-hidden="true" />
          <p>
            Checkout demonstrativo. Nenhuma cobrança será realizada.
            <br />
            Use dados fictícios para testar a experiência. Os dados pessoais do
            formulário não são salvos.
          </p>
        </div>

        {customer && (
          <div className="checkout-account-banner" role="status">
            <UserCheck size={18} aria-hidden="true" />
            <div>
              <p className="checkout-account-title">
                Sessão ativa: <strong>{customer.name}</strong> ({customer.email})
              </p>
              <p className="checkout-account-copy">
                Seus dados cadastrais foram reaproveitados automaticamente —
                nenhum novo cadastro é necessário. Preencha apenas os dados
                restantes de entrega para o pedido demonstrativo.
              </p>
              <Link href="/conta/perfil" className="text-link">
                Gerenciar dados da conta
              </Link>
            </div>
          </div>
        )}

        {(!eligibility.allowed || eligibilityError) && (
          <div className="error-summary" role="alert">
            <strong>
              <AlertTriangle size={15} aria-hidden="true" /> Pedido bloqueado por
              política de elegibilidade
            </strong>
            <p>{eligibilityError || eligibility.blockedReasons[0]}</p>
          </div>
        )}

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
          <legend>
            {customer ? "Dados do pedido e entrega" : "Seus dados"}
          </legend>
          <p className="muted">
            {customer
              ? "Dados da sua conta já preenchidos abaixo. Campos obrigatórios, exceto complemento."
              : "Campos obrigatórios, exceto complemento. Você pode finalizar como visitante, sem criar conta."}
          </p>
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
                  value={fieldValue(field.name)}
                  onChange={(event) =>
                    setFieldValue(field.name, event.target.value)
                  }
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
                value={fieldValue("state")}
                onChange={(event) => setFieldValue("state", event.target.value)}
                required
                aria-invalid={Boolean(errors.state)}
                aria-describedby={errors.state ? "error-state" : undefined}
              >
                <option value="">Selecione</option>
                {BRAZIL_STATES.map((state) => (
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

        <fieldset className="checkout-payment-section">
          <legend>Canal e pagamento (simulação)</legend>
          <p className="muted">
            Arquitetura desacoplada de gateway (PagBank/Asaas não conectados).{" "}
            {ONLINE_COMMERCE_POLICY.notice}
          </p>

          <div className="checkout-choice-group">
            <span className="checkout-choice-label">Canal de conclusão</span>
            <div className="checkout-choice-grid">
              <label className="checkout-choice" htmlFor="channel-site">
                <input
                  id="channel-site"
                  type="radio"
                  name="channel"
                  value="site"
                  checked={channel === "site"}
                  onChange={() => setChannel("site")}
                />
                <span>
                  <strong>Checkout no site (demonstração)</strong>
                  <small>
                    Fluxo principal no site, sem exigir troca de canal para o
                    WhatsApp.
                  </small>
                </span>
              </label>
              <label className="checkout-choice" htmlFor="channel-whatsapp">
                <input
                  id="channel-whatsapp"
                  type="radio"
                  name="channel"
                  value="whatsapp_link"
                  checked={channel === "whatsapp_link"}
                  onChange={() => setChannel("whatsapp_link")}
                />
                <span>
                  <strong>Continuar no WhatsApp (link Pix simulado)</strong>
                  <small>
                    Opção paralela de atendimento; gera prévia fictícia sem envio
                    real.
                  </small>
                </span>
              </label>
            </div>
          </div>

          <div className="checkout-choice-group">
            <span className="checkout-choice-label">
              Forma de pagamento demonstrativa
            </span>
            <div className="checkout-choice-grid">
              <label className="checkout-choice" htmlFor="method-pix">
                <input
                  id="method-pix"
                  type="radio"
                  name="paymentMethod"
                  value="pix"
                  checked={paymentMethod === "pix"}
                  onChange={() => setPaymentMethod("pix")}
                />
                <span>
                  <strong>Pix (simulação)</strong>
                  <small>
                    Gera código Pix Copia e Cola fictício, sem valor financeiro.
                  </small>
                </span>
              </label>
              <label className="checkout-choice" htmlFor="method-card">
                <input
                  id="method-card"
                  type="radio"
                  name="paymentMethod"
                  value="card"
                  checked={paymentMethod === "card"}
                  onChange={() => setPaymentMethod("card")}
                />
                <span>
                  <strong>Cartão (checkout hospedado simulado)</strong>
                  <small>
                    Nenhum número de cartão ou CVV é coletado na aplicação.
                  </small>
                </span>
              </label>
            </div>
          </div>

          <p className="checkout-provider-note">
            <ShieldCheck size={15} aria-hidden="true" />
            Provedor ativo: <strong>Demo / Sandbox</strong> (desacoplado de
            cobrança real).
          </p>
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
        <Button
          type="submit"
          disabled={submitting || !eligibility.allowed}
          className="checkout-submit"
        >
          {submitting ? "Finalizando…" : "Finalizar pedido"}
          <ArrowRight size={18} />
        </Button>
      </form>
      <aside className="summary-panel">
        <h2>Sua seleção</h2>
        <div className="checkout-items">
          {items.map((item) => {
            const p = products.find((product) => product.id === item.productId);
            if (!p) return null;
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
