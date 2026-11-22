"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  MapPin,
  Pencil,
  Plus,
  UserCheck,
} from "lucide-react";
import { useCart } from "@/store/cart-store";
import { useAccount } from "@/store/account-store";
import { useCatalog } from "@/store/catalog-store";
import { useOrder } from "@/store/order-store";
import { formatPhone, formatZip, isValidPhone } from "@/lib/auth";
import { BRAZIL_STATES, STORAGE } from "@/lib/constants";
import { currency } from "@/lib/currency";
import {
  checkoutFields,
  contactFields,
  deliveryFields,
  validateCheckoutValues,
  createDemoOrder,
  evaluateCartEligibility,
} from "@/lib/checkout";
import type { OrderPaymentMethod } from "@/shared/contracts/orders";
import type { CustomerAddress, CustomerProfile } from "@/types/account";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { CartSummary } from "./CartSummary";
import { AsaasSandboxCheckout, type SandboxPaymentData } from "./AsaasSandboxCheckout";

type CheckoutFieldKey = (typeof checkoutFields)[number]["name"] | "state";
type AddressMode = "saved" | "edit" | "new";

function defaultFieldValue(
  customer: CustomerProfile | null,
  address: CustomerAddress | null,
  field: CheckoutFieldKey,
): string {
  switch (field) {
    case "name":
      return customer?.name ?? "";
    case "email":
      return customer?.email ?? "";
    case "phone":
      return customer?.phone ?? "";
    case "zip":
      return address?.zip ?? "";
    case "address":
      return address?.street ?? "";
    case "number":
      return address?.number ?? "";
    case "complement":
      return address?.complement ?? "";
    case "city":
      return address?.city || customer?.city || "";
    case "state":
      return address?.state || customer?.state || "";
  }
}

export function CheckoutForm({
  initialSandboxAvailable = false,
}: {
  initialSandboxAvailable?: boolean;
}) {
  const items = useCart((s) => s.items);
  const cartHydrated = useCart((s) => s.hydrated);
  const accountHydrated = useAccount((s) => s.hydrated);
  const sessionPending = useAccount((s) => s.sessionPending);
  const customer = useAccount((s) => s.customer);
  const saveAddress = useAccount((s) => s.saveAddress);
  const updateAddress = useAccount((s) => s.updateAddress);
  const products = useCatalog((s) => s.products);
  const clear = useCart((s) => s.clear);
  const setOrder = useOrder((s) => s.setOrder);
  const router = useRouter();

  const [overrides, setOverrides] = useState<Partial<Record<CheckoutFieldKey, string>>>({});
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressModeOverride, setAddressModeOverride] = useState<AddressMode | null>(null);
  const [sandboxAddressOpen, setSandboxAddressOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [addressLabel, setAddressLabel] = useState("");
  const [persistAddress, setPersistAddress] = useState(true);
  const [demoConfirmed, setDemoConfirmed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [eligibilityError, setEligibilityError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethod>("pix");
  const lock = useRef(false);
  const summary = useRef<HTMLDivElement>(null);

  const [sandboxAvailable, setSandboxAvailable] = useState(initialSandboxAvailable);
  const [sandboxConfigReady, setSandboxConfigReady] = useState(initialSandboxAvailable);
  const [activeSandboxPayment, setActiveSandboxPayment] = useState<SandboxPaymentData | null>(null);
  const [sandboxResetNotice, setSandboxResetNotice] = useState("");
  const handleSandboxPaymentChange = useCallback((next: SandboxPaymentData | null) => {
    if (next) setSandboxResetNotice("");
    setActiveSandboxPayment(next);
  }, []);

  useEffect(() => {
    if (initialSandboxAvailable) return;
    void fetch("/api/checkout/asaas/config")
      .then((r) => r.json())
      .then((body) => {
        setSandboxAvailable(body.data?.enabled === true);
      })
      .catch(() => {})
      .finally(() => setSandboxConfigReady(true));
  }, [initialSandboxAvailable]);

  let hasAsaasLookup = false;
  if (cartHydrated && accountHydrated && typeof window !== "undefined") {
    hasAsaasLookup = new URLSearchParams(window.location.search).has("asaasOrder");
    if (!hasAsaasLookup) {
      try {
        hasAsaasLookup = Boolean(sessionStorage.getItem("th-asaas-sandbox-attempt"));
      } catch {
        /* Ignore storage restrictions. */
      }
    }
  }

  const waitingConfig = !sandboxConfigReady && (!items.length ? hasAsaasLookup : true);
  if (!cartHydrated || !accountHydrated || sessionPending || (!sandboxConfigReady && waitingConfig && !items.length)) {
    return <p role="status">Carregando sua seleção…</p>;
  }
  if (!sandboxConfigReady && items.length > 0 && hasAsaasLookup) {
    return <p role="status">Carregando sua seleção…</p>;
  }

  const showEmpty = !items.length && !(sandboxAvailable && (hasAsaasLookup || Boolean(activeSandboxPayment)));
  if (showEmpty) {
    return (
      <>
        {sandboxResetNotice && (
          <div className="checkout-test-note" role="status">
            <p>{sandboxResetNotice}</p>
          </div>
        )}
        <EmptyState title="Escolha seus essenciais primeiro." />
      </>
    );
  }

  const eligibility = evaluateCartEligibility(items, products);
  const savedAddresses = customer?.addresses ?? [];
  const defaultAddress =
    savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0] ?? null;
  const activeSavedAddress =
    (selectedAddressId
      ? savedAddresses.find((a) => a.id === selectedAddressId)
      : null) ?? defaultAddress;

  const hasSavedAddresses = Boolean(customer && savedAddresses.length > 0);
  const addressMode: AddressMode = hasSavedAddresses
    ? addressModeOverride ?? "saved"
    : "new";

  const customerHasValidContact = Boolean(
    customer &&
      customer.name.trim().length >= 3 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim()) &&
      isValidPhone(customer.phone),
  );
  const showContactSummary = Boolean(
    customer && hasSavedAddresses && customerHasValidContact && !editingContact,
  );

  const addressSource = addressMode === "new" ? null : activeSavedAddress;
  const fieldValue = (name: CheckoutFieldKey) =>
    overrides[name] ?? defaultFieldValue(customer, addressSource, name);
  const setFieldValue = (name: CheckoutFieldKey, value: string) =>
    setOverrides((prev) => ({ ...prev, [name]: value }));

  const clearDeliveryOverrides = () =>
    setOverrides((prev) => {
      const next = { ...prev };
      delete next.zip;
      delete next.address;
      delete next.number;
      delete next.complement;
      delete next.city;
      delete next.state;
      return next;
    });

  const switchToSavedAddress = (address: CustomerAddress) => {
    setSelectedAddressId(address.id);
    setAddressModeOverride("saved");
    clearDeliveryOverrides();
    setErrors({});
  };

  const openEditDelivery = () => {
    if (!activeSavedAddress) return;
    setAddressModeOverride("edit");
    setAddressLabel(activeSavedAddress.label);
    setPersistAddress(true);
    setOverrides((prev) => ({
      ...prev,
      zip: activeSavedAddress.zip,
      address: activeSavedAddress.street,
      number: activeSavedAddress.number,
      complement: activeSavedAddress.complement,
      city: activeSavedAddress.city,
      state: activeSavedAddress.state,
    }));
  };

  const openNewDelivery = () => {
    setAddressModeOverride("new");
    setAddressLabel("");
    setPersistAddress(true);
    setOverrides((prev) => ({
      ...prev,
      zip: "",
      address: "",
      number: "",
      complement: "",
      city: "",
      state: "",
    }));
  };

  const renderField = (field: (typeof checkoutFields)[number]) => (
    <label
      key={field.name}
      className={
        ["address", "name"].includes(field.name)
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
        onChange={(event) => setFieldValue(field.name, event.target.value)}
        maxLength={field.name === "phone" ? 20 : field.name === "zip" ? 9 : 160}
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
  );

  const deliveryFieldsPanel = (
    <>
      <div className="form-grid">
        {deliveryFields.map(renderField)}
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
        {customer && (
          <label className="field-wide" htmlFor="checkout-address-label">
            Nome do endereço (opcional)
            <input
              id="checkout-address-label"
              name="addressLabel"
              type="text"
              placeholder="Ex.: Casa, Trabalho"
              value={addressLabel}
              onChange={(event) => setAddressLabel(event.target.value)}
              maxLength={40}
            />
          </label>
        )}
      </div>
      {customer && (
        <label className="checkbox-label checkout-save-address">
          <input
            id="checkout-save-address"
            type="checkbox"
            checked={persistAddress}
            onChange={(event) => setPersistAddress(event.target.checked)}
          />{" "}
          {addressMode === "edit"
            ? "Atualizar endereço salvo na minha conta"
            : "Salvar endereço na minha conta para próximos pedidos"}
        </label>
      )}
    </>
  );

  const customerSection = (
    <fieldset className="checkout-section">
      <div className="checkout-section-head">
        <legend>1. Seus dados</legend>
        {customer && showContactSummary && (
          <button
            type="button"
            className="text-link checkout-inline-action"
            onClick={() => setEditingContact(true)}
          >
            <Pencil size={13} aria-hidden="true" /> Editar
          </button>
        )}
      </div>

      {customer ? (
        <div className="checkout-account-banner" role="status">
          <UserCheck size={17} aria-hidden="true" />
          <div className="checkout-account-content">
            <p className="checkout-account-title">
              <strong>{fieldValue("name")}</strong> · {fieldValue("email")}
            </p>
            {fieldValue("phone") && (
              <p className="checkout-account-meta">
                Telefone: {formatPhone(fieldValue("phone"))}
              </p>
            )}
            {!showContactSummary && (
              <p className="checkout-account-copy">
                Dados da sua conta preenchidos abaixo.{" "}
                <Link href="/conta/perfil" className="text-link">
                  Gerenciar conta
                </Link>
              </p>
            )}
          </div>
          {showContactSummary && (
            <Link href="/conta/perfil" className="text-link">
              Minha conta
            </Link>
          )}
        </div>
      ) : (
        <p className="muted checkout-guest-hint">
          Finalize como visitante ou{" "}
          <Link href="/conta/entrar" className="text-link">
            entre na sua conta
          </Link>
          .
        </p>
      )}

      {!showContactSummary && (
        <div className="form-grid">
          {contactFields.map(renderField)}
        </div>
      )}
    </fieldset>
  );

  const savedAddressesRadiogroup = (
    <div className="checkout-saved-addresses" role="radiogroup" aria-label="Endereços salvos">
      {savedAddresses.map((address) => {
        const selected = activeSavedAddress?.id === address.id;
        return (
          <label
            key={address.id}
            className={`checkout-address-option ${selected ? "is-selected" : ""}`}
          >
            <input
              type="radio"
              name="savedAddress"
              value={address.id}
              checked={selected}
              onChange={() => switchToSavedAddress(address)}
            />
            <span>
              <strong>
                <MapPin size={14} aria-hidden="true" /> {address.label}
                {address.isDefault && (
                  <em className="address-badge">Principal</em>
                )}
              </strong>
              <small>
                {address.street}, {address.number}
                {address.complement ? ` — ${address.complement}` : ""}
              </small>
              <small>
                {address.city}/{address.state} · CEP{" "}
                {formatZip(address.zip)}
              </small>
            </span>
          </label>
        );
      })}
    </div>
  );

  const errorSummaryBox = Object.keys(errors).length > 0 && (
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
  );

  const summaryPanel = (
    <aside className="summary-panel">
      <h2>Resumo do pedido</h2>
      {activeSandboxPayment ? (
        <>
          <div className="checkout-items">
            {activeSandboxPayment.order.items.map((item) => (
              <p key={item.id}>
                <span>
                  {item.quantity} × {item.productName}
                  {item.variant ? ` · ${item.variant}` : ""}
                </span>
                <strong>{currency(item.lineTotalCents / 100)}</strong>
              </p>
            ))}
          </div>
          <div className="cart-summary">
            <p>
              <span>Subtotal</span>
              <strong>{currency(activeSandboxPayment.order.subtotalCents / 100)}</strong>
            </p>
            <p>
              <span>Entrega</span>
              <span>A combinar</span>
            </p>
            <div className="summary-total">
              <span>Total</span>
              <strong>{currency(activeSandboxPayment.order.totalCents / 100)}</strong>
            </div>
            <small>Cobranças reais estão desabilitadas neste ambiente.</small>
          </div>
        </>
      ) : (
        <>
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
        </>
      )}
    </aside>
  );

  // Unified Sandbox checkout (replaces redundant demo checkout when Preview Sandbox is active).
  if (sandboxAvailable) {
    const validateAndSaveSandboxDelivery = async (): Promise<boolean> => {
      const shouldValidateAddress =
        (hasSavedAddresses && addressMode !== "saved") ||
        (!hasSavedAddresses && sandboxAddressOpen);
      if (!shouldValidateAddress) {
        setErrors({});
        return true;
      }
      const values = {
        name: fieldValue("name"),
        email: fieldValue("email"),
        phone: fieldValue("phone"),
        zip: fieldValue("zip"),
        address: fieldValue("address"),
        number: fieldValue("number"),
        complement: fieldValue("complement"),
        city: fieldValue("city"),
        state: fieldValue("state"),
        demo: true,
      };
      const invalid = validateCheckoutValues(values);
      setErrors(invalid);
      if (Object.keys(invalid).length) {
        requestAnimationFrame(() => summary.current?.focus());
        return false;
      }
      if (customer && persistAddress) {
        const payload = {
          label: addressLabel.trim() || "Principal",
          zip: values.zip,
          street: values.address.trim(),
          number: values.number.trim(),
          complement: values.complement.trim(),
          city: values.city.trim(),
          state: values.state.trim().toUpperCase(),
          isDefault: true,
        };
        const res =
          addressMode === "edit" && activeSavedAddress
            ? await updateAddress(activeSavedAddress.id, payload)
            : await saveAddress(payload);
        if (!res.ok) {
          setEligibilityError(res.message);
          return false;
        }
        setAddressModeOverride("saved");
        setSandboxAddressOpen(false);
        clearDeliveryOverrides();
      }
      setEligibilityError("");
      return true;
    };

    const showPreOrderSections = customer && items.length > 0 && !activeSandboxPayment && !hasAsaasLookup;

    return (
      <div className="commerce-columns checkout-columns">
        <div>
          <div className="checkout-test-note" role="note">
            <Check size={15} aria-hidden="true" />
            <p>Ambiente de homologação — cobranças reais estão desabilitadas neste Preview.</p>
          </div>

          {eligibilityError && (
            <div className="error-summary" role="alert">
              <strong>
                <AlertTriangle size={15} aria-hidden="true" /> Não foi possível continuar
              </strong>
              <p>{eligibilityError}</p>
            </div>
          )}

          {errorSummaryBox}

          {showPreOrderSections && (
            <>
              {customerSection}
              <fieldset className="checkout-section">
                <div className="checkout-section-head">
                  <legend>2. Entrega</legend>
                  {hasSavedAddresses && addressMode === "saved" && (
                    <div className="checkout-section-actions">
                      <button
                        type="button"
                        className="text-link checkout-inline-action"
                        onClick={openEditDelivery}
                      >
                        <Pencil size={13} aria-hidden="true" /> Editar entrega
                      </button>
                      <button
                        type="button"
                        className="text-link checkout-inline-action"
                        onClick={openNewDelivery}
                      >
                        <Plus size={14} aria-hidden="true" /> Novo endereço
                      </button>
                    </div>
                  )}
                  {hasSavedAddresses && addressMode !== "saved" && (
                    <button
                      type="button"
                      className="text-link checkout-inline-action"
                      onClick={() => {
                        setAddressModeOverride("saved");
                        clearDeliveryOverrides();
                      }}
                    >
                      Usar endereço salvo
                    </button>
                  )}
                  {!hasSavedAddresses && !sandboxAddressOpen && (
                    <button
                      type="button"
                      className="text-link checkout-inline-action"
                      onClick={() => setSandboxAddressOpen(true)}
                    >
                      <Plus size={14} aria-hidden="true" /> Adicionar endereço
                    </button>
                  )}
                  {!hasSavedAddresses && sandboxAddressOpen && (
                    <button
                      type="button"
                      className="text-link checkout-inline-action"
                      onClick={() => {
                        setSandboxAddressOpen(false);
                        setErrors({});
                      }}
                    >
                      Fechar endereço
                    </button>
                  )}
                </div>

                {hasSavedAddresses && addressMode === "saved"
                  ? savedAddressesRadiogroup
                  : (hasSavedAddresses || sandboxAddressOpen)
                    ? deliveryFieldsPanel
                    : <p className="muted">Entrega a combinar. Você pode adicionar um endereço acima ou seguir direto para o pagamento.</p>}
              </fieldset>
            </>
          )}

          <AsaasSandboxCheckout
            beforeCreate={validateAndSaveSandboxDelivery}
            onPaymentChange={handleSandboxPaymentChange}
            onResetNotice={setSandboxResetNotice}
          />
        </div>
        {summaryPanel}
      </div>
    );
  }

  // Fallback non-billing checkout when payment gateway is disabled (static/production-safe mode).
  return (
    <div className="commerce-columns checkout-columns">
      <form
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          if (lock.current) return;
          if (!eligibility.allowed) {
            setEligibilityError(
              eligibility.blockedReasons[0] ??
                "Há itens não elegíveis para pedido online.",
            );
            return;
          }

          const values = {
            name: fieldValue("name"),
            email: fieldValue("email"),
            phone: fieldValue("phone"),
            zip: fieldValue("zip"),
            address: fieldValue("address"),
            number: fieldValue("number"),
            complement: fieldValue("complement"),
            city: fieldValue("city"),
            state: fieldValue("state"),
            demo: demoConfirmed,
          };

          const invalid = validateCheckoutValues(values);
          setErrors(invalid);
          if (Object.keys(invalid).length) {
            if (
              showContactSummary &&
              (invalid.name || invalid.email || invalid.phone)
            ) {
              setEditingContact(true);
            }
            if (
              addressMode === "saved" &&
              (invalid.zip ||
                invalid.address ||
                invalid.number ||
                invalid.city ||
                invalid.state)
            ) {
              openEditDelivery();
            }
            requestAnimationFrame(() => summary.current?.focus());
            return;
          }

          lock.current = true;
          setSubmitting(true);
          try {
            if (customer && persistAddress && addressMode !== "saved") {
              const payload = {
                label: addressLabel.trim() || "Principal",
                zip: values.zip,
                street: values.address.trim(),
                number: values.number.trim(),
                complement: values.complement.trim(),
                city: values.city.trim(),
                state: values.state.trim().toUpperCase(),
                isDefault: true,
              };
              const res =
                addressMode === "edit" && activeSavedAddress
                  ? await updateAddress(activeSavedAddress.id, payload)
                  : await saveAddress(payload);
              if (!res.ok && res.code === "invalid") {
                lock.current = false;
                setSubmitting(false);
                setEligibilityError(res.message);
                return;
              }
            }

            const order = createDemoOrder(items, {
              channel: "site",
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
                : "Não foi possível registrar o pedido.",
            );
          }
        }}
      >
        <div className="checkout-test-note" role="note">
          <Check size={15} aria-hidden="true" />
          <p>Ambiente de homologação — cobranças reais estão desabilitadas.</p>
        </div>

        {(!eligibility.allowed || eligibilityError) && (
          <div className="error-summary" role="alert">
            <strong>
              <AlertTriangle size={15} aria-hidden="true" /> Não foi possível
              continuar
            </strong>
            <p>{eligibilityError || eligibility.blockedReasons[0]}</p>
          </div>
        )}

        {errorSummaryBox}

        {customerSection}

        <fieldset className="checkout-section">
          <div className="checkout-section-head">
            <legend>2. Entrega</legend>
            {hasSavedAddresses && addressMode === "saved" && (
              <div className="checkout-section-actions">
                <button
                  type="button"
                  className="text-link checkout-inline-action"
                  onClick={openEditDelivery}
                >
                  <Pencil size={13} aria-hidden="true" /> Editar entrega
                </button>
                <button
                  type="button"
                  className="text-link checkout-inline-action"
                  onClick={openNewDelivery}
                >
                  <Plus size={14} aria-hidden="true" /> Novo endereço
                </button>
              </div>
            )}
            {hasSavedAddresses && addressMode !== "saved" && (
              <button
                type="button"
                className="text-link checkout-inline-action"
                onClick={() => {
                  setAddressModeOverride("saved");
                  clearDeliveryOverrides();
                }}
              >
                Usar endereço salvo
              </button>
            )}
          </div>

          {hasSavedAddresses && addressMode === "saved"
            ? savedAddressesRadiogroup
            : deliveryFieldsPanel}
        </fieldset>

        <fieldset className="checkout-section checkout-payment-section">
          <legend>3. Forma de pagamento</legend>
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
                <strong>Pix</strong>
                <small>Sem cobrança real neste ambiente.</small>
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
                <strong>Cartão de crédito</strong>
                <small>Nenhum dado de cartão é solicitado neste site.</small>
              </span>
            </label>
          </div>
        </fieldset>

        <label className="checkbox-label demo-checkbox">
          <input
            id="checkout-demo"
            type="checkbox"
            name="demo"
            required
            checked={demoConfirmed}
            onChange={(event) => setDemoConfirmed(event.target.checked)}
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
      {summaryPanel}
    </div>
  );
}
