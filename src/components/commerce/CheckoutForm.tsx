"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Check,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { useCart } from "@/store/cart-store";
import { useAccount } from "@/store/account-store";
import { useCatalog } from "@/store/catalog-store";
import { formatPhone, formatZip, isValidPhone } from "@/lib/auth";
import { BRAZIL_STATES, STORAGE } from "@/lib/constants";
import { currency } from "@/lib/currency";
import { adminSessionChangedEvent, sessionExpiredEvent } from "@/lib/admin-service";
import { readSandboxAttempt, sandboxOrderId } from "@/lib/sandbox-attempt";
import {
  checkoutFields,
  contactFields,
  deliveryFields,
  validateDeliveryValues,
  evaluateCartEligibility,
} from "@/lib/checkout";
import type { CustomerAddress, CustomerProfile } from "@/types/account";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CartSummary } from "./CartSummary";
import { AsaasSandboxCheckout, type SandboxPaymentData } from "./AsaasSandboxCheckout";

type CheckoutFieldKey = (typeof checkoutFields)[number]["name"] | "state";
type AddressMode = "saved" | "edit" | "new";
type SandboxMode = "disabled" | "preview_sandbox" | "admin_sandbox" | "customer_sandbox";

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
  const addressesLoading = useAccount((s) => s.addressesLoading);
  const addressesError = useAccount((s) => s.addressesError);
  const refreshAddresses = useAccount((s) => s.refreshAddresses);
  const saveAddress = useAccount((s) => s.saveAddress);
  const updateAddress = useAccount((s) => s.updateAddress);
  const products = useCatalog((s) => s.products);
  const callbackOrderId = sandboxOrderId(useSearchParams().get("asaasOrder"));
  const adminLoginHref = `/admin/login?next=${encodeURIComponent(
    callbackOrderId ? `/checkout?asaasOrder=${callbackOrderId}` : "/checkout",
  )}`;

  const [overrides, setOverrides] = useState<Partial<Record<CheckoutFieldKey, string>>>({});
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressModeOverride, setAddressModeOverride] = useState<AddressMode | null>(null);
  const [sandboxAddressOpen, setSandboxAddressOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [addressLabel, setAddressLabel] = useState("");
  const [persistAddress, setPersistAddress] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [addressSaveError, setAddressSaveError] = useState("");
  const [addressSaveNotice, setAddressSaveNotice] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
  const summary = useRef<HTMLDivElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  const [sandboxMode, setSandboxMode] = useState<SandboxMode>(
    initialSandboxAvailable ? "preview_sandbox" : "disabled",
  );
  const sandboxAvailable = sandboxMode !== "disabled";
  const [sandboxConfigReady, setSandboxConfigReady] = useState(initialSandboxAvailable);
  const [sandboxConfigError, setSandboxConfigError] = useState(false);
  const [sandboxPayment, setActiveSandboxPayment] = useState<SandboxPaymentData | null>(null);
  const activeSandboxPayment = sandboxAvailable ? sandboxPayment : null;
  const [sandboxResetNotice, setSandboxResetNotice] = useState("");

  const handleSandboxPaymentChange = useCallback((next: SandboxPaymentData | null) => {
    if (next) setSandboxResetNotice("");
    setActiveSandboxPayment(next);
  }, []);

  useEffect(() => {
    if (initialSandboxAvailable) return;
    let controller: AbortController | undefined;
    const check = async () => {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      try {
        const res = await fetch("/api/checkout/asaas/config", { cache: "no-store", signal: current.signal });
        const body = await res.json();
        if (!res.ok || typeof body.data?.enabled !== "boolean") throw new Error();
        if (current.signal.aborted) return;
        const mode = body.data.mode;
        setSandboxMode(body.data.enabled && (mode === "admin_sandbox" || mode === "preview_sandbox" || mode === "customer_sandbox") ? mode : "disabled");
        setSandboxConfigError(false);
      } catch {
        if (current.signal.aborted) return;
        setSandboxMode("disabled");
        setSandboxConfigError(true);
      } finally {
        if (!current.signal.aborted) setSandboxConfigReady(true);
      }
    };
    void check();
    const events = ["focus", "pageshow", adminSessionChangedEvent, sessionExpiredEvent];
    events.forEach((event) => window.addEventListener(event, check));
    return () => {
      controller?.abort();
      events.forEach((event) => window.removeEventListener(event, check));
    };
  }, [callbackOrderId, initialSandboxAvailable, sessionPending, customer?.email]);

  const syncedCustomerRef = useRef<string | null>(null);
  useEffect(() => {
    if (!accountHydrated || !customer) {
      syncedCustomerRef.current = null;
      return;
    }
    if (syncedCustomerRef.current === customer.email) return;
    syncedCustomerRef.current = customer.email;
    void refreshAddresses();
  }, [accountHydrated, customer, refreshAddresses]);

  if (!cartHydrated || !accountHydrated || sessionPending || !sandboxConfigReady) {
    return <p role="status">Carregando sua seleção…</p>;
  }

  const hasAsaasLookup = Boolean(callbackOrderId || readSandboxAttempt(STORAGE.storefrontSandboxAttempt).orderId);
  const adminAccess = (
    <Link className="text-link" href={adminLoginHref}>Acesso administrativo</Link>
  );
  const accessMessage = sandboxConfigError
    ? "Não foi possível verificar a disponibilidade do checkout."
    : "Entre na sua conta para acompanhar o pedido.";
  const showEmpty = !items.length && !(sandboxAvailable && (hasAsaasLookup || Boolean(activeSandboxPayment)));
  if (showEmpty) {
    return (
      <>
        {sandboxResetNotice && (
          <div className="checkout-test-note" role="status">
            <p>{sandboxResetNotice}</p>
          </div>
        )}
        {hasAsaasLookup || sandboxConfigError ? (
          <div className="checkout-test-note" role="status"><p>{accessMessage} <Link href="/conta/pedidos">Meus pedidos</Link></p></div>
        ) : <EmptyState title="Escolha seus essenciais primeiro." />}
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
    customer && customerHasValidContact && !editingContact && (hasSavedAddresses || !sandboxAvailable),
  );

  const addressSource = addressMode === "new" ? null : activeSavedAddress;
  const fieldValue = (name: CheckoutFieldKey) =>
    overrides[name] ?? defaultFieldValue(customer, addressSource, name);
  const setFieldValue = (name: CheckoutFieldKey, value: string) => {
    setAddressSaveError("");
    setOverrides((prev) => ({ ...prev, [name]: value }));
  };

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
    setAddressSaveError("");
  };

  const openEditDelivery = () => {
    if (!activeSavedAddress) return;
    setAddressModeOverride("edit");
    setAddressLabel(activeSavedAddress.label);
    setPersistAddress(true);
    setAddressSaveError("");
    setAddressSaveNotice("");
    setErrors({});
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
    setAddressSaveError("");
    setAddressSaveNotice("");
    setErrors({});
    setOverrides((prev) => ({
      ...prev,
      zip: "",
      address: "",
      number: "",
      complement: "",
      city: customer?.city ?? "",
      state: customer?.state ?? "",
    }));
  };

  const saveDeliveryToAccount = async (requirePersist: boolean): Promise<boolean> => {
    setAddressSaveError("");
    setAddressSaveNotice("");
    const deliveryValues = {
      zip: fieldValue("zip"),
      address: fieldValue("address"),
      number: fieldValue("number"),
      complement: fieldValue("complement"),
      city: fieldValue("city"),
      state: fieldValue("state"),
    };
    const invalid = validateDeliveryValues(deliveryValues);
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      requestAnimationFrame(() => summary.current?.focus());
      return false;
    }

    if (!customer) {
      setAddressSaveError("Entre na sua conta para salvar o endereço de entrega.");
      requestAnimationFrame(() => alertRef.current?.focus());
      return false;
    }

    if (!persistAddress && !requirePersist) {
      return true;
    }

    setSavingAddress(true);
    try {
      const payload = {
        label: addressLabel.trim() || "Principal",
        zip: deliveryValues.zip,
        street: deliveryValues.address.trim(),
        number: deliveryValues.number.trim(),
        complement: deliveryValues.complement.trim(),
        city: deliveryValues.city.trim(),
        state: deliveryValues.state.trim().toUpperCase(),
        isDefault: addressMode === "edit" ? activeSavedAddress?.isDefault : true,
      };
      const res =
        addressMode === "edit" && activeSavedAddress
          ? await updateAddress(activeSavedAddress.id, payload)
          : await saveAddress(payload);
      if (!res.ok) {
        setAddressSaveError(res.message);
        requestAnimationFrame(() => alertRef.current?.focus());
        return false;
      }
      if (res.address?.id) {
        setSelectedAddressId(res.address.id);
      }
      setAddressModeOverride("saved");
      setSandboxAddressOpen(false);
      clearDeliveryOverrides();
      setAddressLabel("");
      setAddressSaveNotice("Endereço salvo na sua conta para próximas compras.");
      return true;
    } finally {
      setSavingAddress(false);
    }
  };

  const renderField = (field: (typeof checkoutFields)[number]) => (
    <label
      key={field.name}
      className={["address", "name"].includes(field.name) ? "field-wide" : ""}
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
        aria-describedby={errors[field.name] ? `error-${field.name}` : undefined}
      />
      {errors[field.name] && (
        <small className="field-error" id={`error-${field.name}`}>
          {errors[field.name]}
        </small>
      )}
    </label>
  );

  const deliveryFieldsPanel = (allowOptionalCheckbox: boolean) => (
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
      {customer && allowOptionalCheckbox && (
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
        <div className="checkout-guest-prompt">
          <p className="muted checkout-guest-hint">
            Entre na sua conta ou crie um cadastro para salvar seus endereços e acompanhar seus pedidos.
          </p>
          <div className="checkout-guest-actions">
            <ButtonLink href="/conta/entrar?next=/checkout">Entrar na conta</ButtonLink>
            <ButtonLink href="/conta/cadastro?next=/checkout" variant="secondary">
              Criar conta
            </ButtonLink>
          </div>
        </div>
      )}

      {customer && !showContactSummary && (
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

  const addressAlertText = addressSaveError || addressesError;
  const addressAlertBox = addressAlertText && (
    <div className="error-summary" role="alert" tabIndex={-1} ref={alertRef}>
      <strong>
        <AlertTriangle size={15} aria-hidden="true" /> Erro ao salvar ou carregar endereço
      </strong>
      <p>{addressAlertText}</p>
      {customer && (
        <button
          type="button"
          className="text-link checkout-inline-action"
          onClick={() => {
            setAddressSaveError("");
            void refreshAddresses();
          }}
        >
          <RefreshCw size={13} aria-hidden="true" /> Tentar recarregar endereços
        </button>
      )}
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
              <span>{activeSandboxPayment.checkoutDetails?.delivery ? "Endereço informado" : "A combinar"}</span>
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

  if (sandboxAvailable) {
    const checkoutDetails = sandboxMode === "customer_sandbox" ? {
      contact: { name: fieldValue("name"), email: fieldValue("email"), phone: fieldValue("phone") },
      delivery: hasSavedAddresses || sandboxAddressOpen ? {
        label: addressLabel || activeSavedAddress?.label || "Principal",
        zip: fieldValue("zip"), street: fieldValue("address"), number: fieldValue("number"),
        complement: fieldValue("complement"), city: fieldValue("city"), state: fieldValue("state"),
      } : undefined,
    } : undefined;
    const validateAndSaveSandboxDelivery = async (): Promise<boolean> => {
      if (checkoutDetails) {
        const { name, email, phone } = checkoutDetails.contact;
        const contactErrors: Record<string, string> = {};
        if (!name.trim()) contactErrors.name = "Preencha o nome completo.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) contactErrors.email = "Informe um e-mail válido.";
        if (!isValidPhone(phone)) contactErrors.phone = "Informe um telefone com DDD.";
        if (Object.keys(contactErrors).length) {
          setEditingContact(true);
          setErrors(contactErrors);
          requestAnimationFrame(() => summary.current?.focus());
          return false;
        }
      }
      const shouldValidateAddress =
        (hasSavedAddresses && addressMode !== "saved") ||
        (!hasSavedAddresses && sandboxAddressOpen);
      if (!shouldValidateAddress) {
        setErrors({});
        return true;
      }
      return saveDeliveryToAccount(false);
    };

    const showPreOrderSections = customer && items.length > 0 && !activeSandboxPayment && !hasAsaasLookup;

    return (
      <div className="commerce-columns checkout-columns">
        <div>
          <div className="checkout-test-note" role="note">
            {sandboxMode === "admin_sandbox" ? (
              <>
                <ShieldCheck size={15} aria-hidden="true" />
                <p>
                  <strong>Modo administrador ativo (Asaas Sandbox · banco isolado).</strong>{" "}
                  Sem cobrança real e sem alterar pedidos ou estoque comercial.{" "}
                  <Link href="/admin/asaas" className="text-link">
                    Painel Sandbox
                  </Link>
                </p>
              </>
            ) : (
              <>
                <Check size={15} aria-hidden="true" />
                <p>{sandboxMode === "preview_sandbox"
                  ? "Ambiente de homologação — cobranças reais estão desabilitadas neste Preview."
                  : "Pagamento de teste pelo Asaas Sandbox. Sem cobrança ou envio real."}</p>
              </>
            )}
          </div>

          {addressAlertBox}
          {addressSaveNotice && (
            <div className="checkout-test-note" role="status">
              <Check size={15} aria-hidden="true" />
              <p>{addressSaveNotice}</p>
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
                    ? deliveryFieldsPanel(true)
                    : <p className="muted">Entrega a combinar. Você pode adicionar um endereço acima ou seguir direto para o pagamento.</p>}
              </fieldset>
            </>
          )}

          <AsaasSandboxCheckout
            mode={sandboxMode}
            checkoutDetails={checkoutDetails}
            callbackOrderId={callbackOrderId}
            beforeCreate={validateAndSaveSandboxDelivery}
            onPaymentChange={handleSandboxPaymentChange}
            onResetNotice={setSandboxResetNotice}
          />
        </div>
        {summaryPanel}
      </div>
    );
  }

  // Honest commercial storefront checkout on Production (`main`): real billing is not active yet;
  // zero fake demo orders or misleading "Pedido recebido" screens, while preserving real address reuse.
  return (
    <div className="commerce-columns checkout-columns">
      <div>
        {!eligibility.allowed && (
          <div className="error-summary" role="alert">
            <strong>
              <AlertTriangle size={15} aria-hidden="true" /> Itens não elegíveis
            </strong>
            <p>{eligibility.blockedReasons[0]}</p>
          </div>
        )}

        {addressAlertBox}
        {addressSaveNotice && (
          <div className="checkout-test-note" role="status">
            <Check size={15} aria-hidden="true" />
            <p>{addressSaveNotice}</p>
          </div>
        )}
        {errorSummaryBox}

        {customerSection}

        <fieldset className="checkout-section">
          <div className="checkout-section-head">
            <legend>2. Entrega</legend>
            {customer && hasSavedAddresses && addressMode === "saved" && (
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
            {customer && hasSavedAddresses && addressMode !== "saved" && (
              <button
                type="button"
                className="text-link checkout-inline-action"
                onClick={() => {
                  setAddressModeOverride("saved");
                  clearDeliveryOverrides();
                  setErrors({});
                  setAddressSaveError("");
                }}
              >
                Usar endereço salvo
              </button>
            )}
          </div>

          {!customer ? (
            <p className="muted">
              Entre na sua conta acima para cadastrar seu endereço de entrega e reaproveitá-lo automaticamente nas próximas compras.
            </p>
          ) : addressesLoading && !savedAddresses.length ? (
            <p role="status" className="muted">
              Carregando endereços salvos…
            </p>
          ) : hasSavedAddresses && addressMode === "saved" ? (
            savedAddressesRadiogroup
          ) : (
            <>
              {deliveryFieldsPanel(false)}
              <div className="checkout-actions-row">
                <Button
                  type="button"
                  disabled={savingAddress}
                  onClick={() => {
                    void saveDeliveryToAccount(true);
                  }}
                >
                  {savingAddress && <LoaderCircle size={15} className="spin" aria-hidden="true" />}
                  {savingAddress
                    ? "Salvando endereço…"
                    : addressMode === "edit"
                      ? "Atualizar endereço na conta"
                      : "Salvar endereço na conta"}
                </Button>
                {hasSavedAddresses && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={savingAddress}
                    onClick={() => {
                      setAddressModeOverride("saved");
                      clearDeliveryOverrides();
                      setErrors({});
                      setAddressSaveError("");
                    }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </>
          )}
        </fieldset>

        <fieldset className="checkout-section checkout-payment-section">
          <legend>3. Pagamento</legend>
          <div className="checkout-test-note" role="status">
            <ShieldAlert size={16} aria-hidden="true" />
            <div>
              <p>
                <strong>Pagamentos online indisponíveis para pedidos comerciais.</strong>
              </p>
              <p className="muted">
                As cobranças via Pix e Cartão de crédito não estão ativas na loja pública e nenhum pedido é confirmado sem aprovação do provedor de pagamento.
              </p>
            </div>
          </div>
          <div className="checkout-actions-row">
            <ButtonLink href="/loja" variant="secondary">
              Continuar explorando a loja
            </ButtonLink>
            {customer && (
              <ButtonLink href="/conta/pedidos" variant="ghost">
                Ver meus pedidos
              </ButtonLink>
            )}
            {adminAccess}
          </div>
          {(sandboxConfigError || callbackOrderId) && <p role="status">{accessMessage}</p>}
        </fieldset>
      </div>
      {summaryPanel}
    </div>
  );
}
