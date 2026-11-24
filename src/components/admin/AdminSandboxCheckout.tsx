"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ExternalLink,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { ASAAS_SANDBOX, BRAZIL_STATES, STORAGE } from "@/lib/constants";
import { formatPhone, formatZip } from "@/lib/auth";
import { deliveryFields, validateDeliveryValues } from "@/lib/checkout";
import { currency } from "@/lib/currency";
import { readSandboxAttempt, sandboxOrderId, saveSandboxAttempt } from "@/lib/sandbox-attempt";
import {
  ORDER_STATUS_LABEL,
  ORDER_STOCK_STATUS_LABEL,
} from "@/modules/orders/domain/order-status";
import type { AdminRole } from "@/shared/contracts/admin";
import { useAccount } from "@/store/account-store";
import { useCart } from "@/store/cart-store";
import type { CustomerAddress, CustomerProfile } from "@/types/account";
import { Button, ButtonLink } from "@/components/ui/Button";
import type { sandboxPaymentView } from "@/modules/orders/infrastructure/asaas-sandbox";

interface SandboxProductItem {
  id: string;
  sku: string;
  slug: string;
  name: string;
  price_cents: number;
  variants: string[];
  stock: number;
}

type AdminPaymentView = Awaited<ReturnType<typeof sandboxPaymentView>> & {
  sandboxStock?: Array<{ productId: string; productName: string; quantity: number }>;
};

type DeliveryFieldKey = "zip" | "address" | "number" | "complement" | "city" | "state";
type AddressMode = "saved" | "edit" | "new";

const ATTEMPT_STORAGE_KEY = STORAGE.adminSandboxAttempt;
const SANDBOX_CHECKOUT_ORIGIN = new URL(ASAAS_SANDBOX.checkoutBase).origin;

function defaultDeliveryValue(
  customer: CustomerProfile | null,
  address: CustomerAddress | null,
  field: DeliveryFieldKey,
): string {
  switch (field) {
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

export function AdminSandboxCheckout() {
  const accountHydrated = useAccount((s) => s.hydrated);
  const sessionPending = useAccount((s) => s.sessionPending);
  const customer = useAccount((s) => s.customer);
  const addressesLoading = useAccount((s) => s.addressesLoading);
  const addressesError = useAccount((s) => s.addressesError);
  const refreshAddresses = useAccount((s) => s.refreshAddresses);
  const saveAddress = useAccount((s) => s.saveAddress);
  const updateAddress = useAccount((s) => s.updateAddress);

  const [role, setRole] = useState<AdminRole | null>(null);
  const [roleChecked, setRoleChecked] = useState(false);
  const [sandboxProducts, setSandboxProducts] = useState<SandboxProductItem[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");

  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [method, setMethod] = useState<"pix" | "card">("card");

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressModeOverride, setAddressModeOverride] = useState<AddressMode | null>(null);
  const [overrides, setOverrides] = useState<Partial<Record<DeliveryFieldKey, string>>>({});
  const [addressLabel, setAddressLabel] = useState("");
  const [persistAddress, setPersistAddress] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [addressError, setAddressError] = useState("");
  const [addressNotice, setAddressNotice] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);

  const [payment, setPayment] = useState<AdminPaymentView | null>(null);
  const [hasSavedOrder, setHasSavedOrder] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [redirectingUrl, setRedirectingUrl] = useState<string | null>(null);

  const keyRef = useRef<string | null>(null);
  const orderIdRef = useRef<string | null>(null);
  const lockRef = useRef(false);
  const selectedProductIdRef = useRef("");
  const syncedEmailRef = useRef<string | null>(null);
  const errorBoxRef = useRef<HTMLDivElement>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/asaas", { cache: "no-store" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          body?.error?.message ?? "Não foi possível carregar o ambiente Asaas Sandbox.",
        );
      }
      const rows = (body?.data?.products ?? []) as SandboxProductItem[];
      setSandboxProducts(rows);
      setProductsError("");
      if (rows.length) {
        const currentCart = useCart.getState().items;
        const cartMatch = currentCart.find((line) =>
          rows.some((p) => p.id === line.productId && p.stock > 0),
        );
        if (cartMatch) {
          const prod = rows.find((p) => p.id === cartMatch.productId)!;
          selectedProductIdRef.current = prod.id;
          setSelectedProductId(prod.id);
          setSelectedVariant(prod.variants.find((variant) => variant === cartMatch.variant) ?? prod.variants[0] ?? "");
          setQuantity(Math.min(Math.max(1, cartMatch.quantity), prod.stock));
        } else if (!selectedProductIdRef.current || !rows.some((p) => p.id === selectedProductIdRef.current)) {
          const preferred =
            rows.find((p) => p.id === "case-01" && p.stock > 0) ??
            rows.find((p) => p.stock > 0) ??
            rows[0];
          if (preferred) {
            selectedProductIdRef.current = preferred.id;
            setSelectedProductId(preferred.id);
            setSelectedVariant(preferred.variants[0] || "");
            setQuantity(1);
          }
        }
      }
    } catch (err) {
      setProductsError(
        err instanceof Error ? err.message : "Falha ao carregar itens Sandbox.",
      );
    } finally {
      setProductsLoading(false);
    }
  }, []);

  const loadOrder = useCallback(async (id: string) => {
    const response = await fetch(`/api/admin/asaas/orders/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    const body = await response.json().catch(() => null);
    if (response.status === 404) {
      try {
        sessionStorage.removeItem(ATTEMPT_STORAGE_KEY);
      } catch {
        /* Ignore storage restrictions. */
      }
      keyRef.current = null;
      orderIdRef.current = null;
      setHasSavedOrder(false);
      setPayment(null);
      setStatusMessage("Tentativa de teste não encontrada no banco isolado.");
      if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("asaasOrder")) {
        window.history.replaceState(null, "", "/admin/teste-pagamento");
      }
      return;
    }
    if (!response.ok) {
      throw new Error(body?.error?.message ?? "Falha ao consultar pedido Sandbox.");
    }
    setPayment(body.data as AdminPaymentView);
    setStatusMessage("");
  }, []);

  useEffect(() => {
    Promise.resolve(useCart.persist.rehydrate()).catch(() => {});
    Promise.resolve(useAccount.persist.rehydrate()).finally(() => {
      const state = useAccount.getState();
      useAccount.setState({ hydrated: true });
      if (!state.customer && !state.sessionChecked) {
        void state.loadSession();
      }
    });

    void fetch("/api/admin/auth/session", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        const userRole = body?.data?.role;
        if (userRole === "admin" || userRole === "operator") {
          setRole(userRole);
        }
        if (userRole === "admin") {
          const callbackId = sandboxOrderId(new URLSearchParams(window.location.search).get("asaasOrder"));
          const saved = readSandboxAttempt(ATTEMPT_STORAGE_KEY);
          keyRef.current = callbackId && callbackId !== saved.orderId ? null : saved.key;
          orderIdRef.current = callbackId ?? saved.orderId;
          setHasSavedOrder(Boolean(orderIdRef.current));
          if (orderIdRef.current) {
            void loadOrder(orderIdRef.current).catch((err) =>
              setStatusMessage(err instanceof Error ? err.message : "Erro ao carregar pedido."),
            );
          }
        }
      })
      .catch(() => {})
      .finally(() => setRoleChecked(true));

    void Promise.resolve().then(loadDashboard);
  }, [loadDashboard, loadOrder]);

  useEffect(() => {
    if (!accountHydrated || !customer) {
      syncedEmailRef.current = null;
      return;
    }
    if (syncedEmailRef.current === customer.email) return;
    syncedEmailRef.current = customer.email;
    void refreshAddresses().then((result) => {
      if (!result.ok && result.code !== "unavailable") {
        setAddressError(result.message);
      }
    });
  }, [accountHydrated, customer, refreshAddresses]);

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
  const addressSource = addressMode === "new" ? null : activeSavedAddress;

  const fieldValue = (name: DeliveryFieldKey) =>
    overrides[name] ?? defaultDeliveryValue(customer, addressSource, name);
  const setFieldValue = (name: DeliveryFieldKey, value: string) => {
    setAddressError("");
    setOverrides((prev) => ({ ...prev, [name]: value }));
  };

  const clearDeliveryOverrides = () =>
    setOverrides({});

  const openEditDelivery = () => {
    if (!activeSavedAddress) return;
    setAddressModeOverride("edit");
    setAddressLabel(activeSavedAddress.label);
    setPersistAddress(true);
    setAddressError("");
    setAddressNotice("");
    setFieldErrors({});
    setOverrides({
      zip: activeSavedAddress.zip,
      address: activeSavedAddress.street,
      number: activeSavedAddress.number,
      complement: activeSavedAddress.complement,
      city: activeSavedAddress.city,
      state: activeSavedAddress.state,
    });
  };

  const openNewDelivery = () => {
    setAddressModeOverride("new");
    setAddressLabel("");
    setPersistAddress(true);
    setAddressError("");
    setAddressNotice("");
    setFieldErrors({});
    setOverrides({
      zip: "",
      address: "",
      number: "",
      complement: "",
      city: customer?.city ?? "",
      state: customer?.state ?? "",
    });
  };

  const persistDeliveryIfNeeded = async (forcePersist: boolean): Promise<boolean> => {
    if (!customer) return true;
    if (hasSavedAddresses && addressMode === "saved") return true;

    const values = {
      zip: fieldValue("zip"),
      address: fieldValue("address"),
      number: fieldValue("number"),
      complement: fieldValue("complement"),
      city: fieldValue("city"),
      state: fieldValue("state"),
    };
    const invalid = validateDeliveryValues(values);
    setFieldErrors(invalid);
    if (Object.keys(invalid).length > 0) {
      setAddressError("Preencha os campos obrigatórios de entrega antes de continuar.");
      requestAnimationFrame(() => errorBoxRef.current?.focus());
      return false;
    }

    if (!persistAddress && !forcePersist) {
      return true;
    }

    setSavingAddress(true);
    setAddressError("");
    setAddressNotice("");
    try {
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
        setAddressError(res.message);
        requestAnimationFrame(() => errorBoxRef.current?.focus());
        return false;
      }
      if (res.address?.id) {
        setSelectedAddressId(res.address.id);
      }
      setAddressModeOverride("saved");
      clearDeliveryOverrides();
      setAddressLabel("");
      setAddressNotice("Endereço salvo na conta do cliente para próximas compras.");
      return true;
    } finally {
      setSavingAddress(false);
    }
  };

  const resetAttempt = async () => {
    try {
      sessionStorage.removeItem(ATTEMPT_STORAGE_KEY);
    } catch {
      /* Ignore storage restrictions. */
    }
    keyRef.current = null;
    orderIdRef.current = null;
    setHasSavedOrder(false);
    setPayment(null);
    setRedirectingUrl(null);
    setStatusMessage("");
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("asaasOrder")) {
      window.history.replaceState(null, "", "/admin/teste-pagamento");
    }
    await loadDashboard();
  };

  const handleCheckoutSubmit = async () => {
    if (lockRef.current || role !== "admin") return;
    lockRef.current = true;
    setBusy(true);
    setStatusMessage("");
    setRedirectingUrl(null);
    try {
      if (orderIdRef.current) {
        await loadOrder(orderIdRef.current);
        await loadDashboard();
        return;
      }

      const selectedProduct = sandboxProducts.find((p) => p.id === selectedProductId);
      if (!selectedProduct || selectedProduct.stock < quantity) {
        throw new Error("Produto Sandbox sem estoque isolado suficiente para este teste.");
      }

      if (customer) {
        const addressOk = await persistDeliveryIfNeeded(false);
        if (!addressOk) return;
      }

      keyRef.current ??= crypto.randomUUID();
      saveSandboxAttempt(ATTEMPT_STORAGE_KEY, keyRef.current, null);

      const response = await fetch("/api/admin/asaas/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: method,
          idempotencyKey: keyRef.current,
          items: [
            {
              productId: selectedProduct.id,
              quantity,
              ...(selectedVariant ? { variant: selectedVariant } : {}),
            },
          ],
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Não foi possível criar cobrança no Asaas Sandbox.");
      }

      const data = body.data as AdminPaymentView;
      orderIdRef.current = data.order.id;
      setHasSavedOrder(true);
      setPayment(data);
      saveSandboxAttempt(ATTEMPT_STORAGE_KEY, keyRef.current, data.order.id);
      await loadDashboard();

      if (method === "card" && data.order.checkoutUrl) {
        let parsedOrigin = "";
        try {
          parsedOrigin = new URL(data.order.checkoutUrl).origin;
        } catch {
          parsedOrigin = "";
        }
        if (parsedOrigin === SANDBOX_CHECKOUT_ORIGIN) {
          setRedirectingUrl(data.order.checkoutUrl);
          window.location.assign(data.order.checkoutUrl);
          return;
        }
      }
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : "Falha ao iniciar pagamento de teste.",
      );
    } finally {
      setBusy(false);
      lockRef.current = false;
    }
  };

  const handleCancelOrder = async () => {
    if (!payment || busy) return;
    setBusy(true);
    setStatusMessage("");
    try {
      const response = await fetch("/api/admin/asaas/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: payment.order.id }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Não foi possível cancelar a tentativa.");
      }
      await loadOrder(payment.order.id);
      await loadDashboard();
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : "Falha ao cancelar pedido de teste.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!roleChecked || !accountHydrated || sessionPending) {
    return (
      <div className="table-card admin-sandbox-card" role="status">
        <p className="muted">Verificando sessão administrativa e perfil do cliente…</p>
      </div>
    );
  }

  if (role !== "admin") {
    return (
      <div className="table-card admin-sandbox-card" role="alert">
        <h2>Acesso restrito a administrador</h2>
        <p className="muted">
          Somente administradores autenticados podem executar testes do Asaas Sandbox na URL principal.
        </p>
      </div>
    );
  }

  const activeProduct = sandboxProducts.find((p) => p.id === selectedProductId) ?? null;
  const maxQty = activeProduct ? Math.max(1, activeProduct.stock) : 1;
  const effectiveAddressesError = addressesError && !addressError ? addressesError : addressError;

  return (
    <div className="admin-sandbox-layout">
      <div className="checkout-test-note" role="note">
        <ShieldCheck size={16} aria-hidden="true" />
        <p>
          <strong>Banco Sandbox isolado ativo.</strong> Pedidos e baixas de estoque aqui não alteram pedidos comerciais nem estoque do Neon principal.
        </p>
      </div>

      {productsError && (
        <div className="error-summary" role="alert">
          <strong>Erro no ambiente Sandbox</strong>
          <p>{productsError}</p>
        </div>
      )}

      {effectiveAddressesError && (
        <div className="error-summary" role="alert" tabIndex={-1} ref={errorBoxRef}>
          <strong>
            <AlertTriangle size={15} aria-hidden="true" /> Erro no endereço do cliente
          </strong>
          <p>{effectiveAddressesError}</p>
          {customer && (
            <button
              type="button"
              className="text-link checkout-inline-action"
              onClick={() => {
                setAddressError("");
                void refreshAddresses();
              }}
            >
              <RefreshCw size={13} aria-hidden="true" /> Recarregar endereços do Neon
            </button>
          )}
        </div>
      )}

      {addressNotice && (
        <div className="checkout-test-note" role="status">
          <Check size={15} aria-hidden="true" />
          <p>{addressNotice}</p>
        </div>
      )}

      <div className="admin-sandbox-grid">
        <div className="admin-sandbox-main">
          {/* 1. Cliente & Endereco (Neon principal) */}
          <section className="table-card admin-sandbox-card" aria-labelledby="sandbox-customer-title">
            <div className="checkout-section-head">
              <h2 id="sandbox-customer-title">1. Cliente e endereço de entrega</h2>
              {customer && hasSavedAddresses && addressMode === "saved" && (
                <div className="checkout-section-actions">
                  <button
                    type="button"
                    className="text-link checkout-inline-action"
                    onClick={openEditDelivery}
                  >
                    <Pencil size={13} aria-hidden="true" /> Editar endereço
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
                    setFieldErrors({});
                    setAddressError("");
                  }}
                >
                  Usar endereço salvo
                </button>
              )}
            </div>

            {!customer ? (
              <div className="admin-sandbox-guest">
                <p className="muted">
                  Nenhuma sessão de cliente ativa neste navegador. Entre com sua conta de cliente para validar o preenchimento automático de endereço e o histórico em Meus pedidos, ou execute um teste administrativo direto abaixo.
                </p>
                <div className="checkout-actions-row">
                  <ButtonLink href="/conta/entrar?next=/admin/teste-pagamento" variant="secondary">
                    Entrar como cliente
                  </ButtonLink>
                </div>
              </div>
            ) : (
              <>
                <div className="checkout-account-banner" role="status">
                  <UserCheck size={17} aria-hidden="true" />
                  <div className="checkout-account-content">
                    <p className="checkout-account-title">
                      <strong>{customer.name}</strong> · {customer.email}
                    </p>
                    {customer.phone && (
                      <p className="checkout-account-meta">
                        Telefone: {formatPhone(customer.phone)}
                      </p>
                    )}
                  </div>
                  <Link href="/conta/perfil" className="text-link">
                    Gerenciar endereços
                  </Link>
                </div>

                {addressesLoading && !savedAddresses.length ? (
                  <p role="status" className="muted">
                    Carregando endereços salvos…
                  </p>
                ) : hasSavedAddresses && addressMode === "saved" ? (
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
                            name="sandboxSavedAddress"
                            value={address.id}
                            checked={selected}
                            onChange={() => {
                              setSelectedAddressId(address.id);
                              setAddressModeOverride("saved");
                              clearDeliveryOverrides();
                            }}
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
                              {address.city}/{address.state} · CEP {formatZip(address.zip)}
                            </small>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="admin-sandbox-address-form">
                    <div className="form-grid">
                      {deliveryFields.map((field) => (
                        <label
                          key={field.name}
                          className={field.name === "address" ? "field-wide" : ""}
                          htmlFor={`checkout-${field.name}`}
                        >
                          {field.label}
                          <input
                            id={`checkout-${field.name}`}
                            name={field.name}
                            type="text"
                            autoComplete={field.autoComplete}
                            required={!("optional" in field)}
                            value={fieldValue(field.name as DeliveryFieldKey)}
                            onChange={(e) =>
                              setFieldValue(field.name as DeliveryFieldKey, e.target.value)
                            }
                            maxLength={field.name === "zip" ? 9 : 160}
                            aria-invalid={Boolean(fieldErrors[field.name])}
                          />
                          {fieldErrors[field.name] && (
                            <small className="field-error">{fieldErrors[field.name]}</small>
                          )}
                        </label>
                      ))}
                      <label htmlFor="checkout-state">
                        Estado
                        <select
                          id="checkout-state"
                          name="state"
                          value={fieldValue("state")}
                          onChange={(e) => setFieldValue("state", e.target.value)}
                          required
                          aria-invalid={Boolean(fieldErrors.state)}
                        >
                          <option value="">Selecione</option>
                          {BRAZIL_STATES.map((uf) => (
                            <option key={uf}>{uf}</option>
                          ))}
                        </select>
                        {fieldErrors.state && (
                          <small className="field-error">{fieldErrors.state}</small>
                        )}
                      </label>
                      <label className="field-wide" htmlFor="checkout-address-label">
                        Identificação do endereço (opcional)
                        <input
                          id="checkout-address-label"
                          name="addressLabel"
                          type="text"
                          placeholder="Ex.: Casa, Escritório"
                          value={addressLabel}
                          onChange={(e) => setAddressLabel(e.target.value)}
                          maxLength={40}
                        />
                      </label>
                    </div>
                    <label className="checkbox-label checkout-save-address">
                      <input
                        id="checkout-save-address"
                        type="checkbox"
                        checked={persistAddress}
                        onChange={(e) => setPersistAddress(e.target.checked)}
                      />{" "}
                      Salvar endereço na conta do cliente para próximas compras
                    </label>
                    <div className="checkout-actions-row">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={savingAddress}
                        onClick={() => {
                          void persistDeliveryIfNeeded(true);
                        }}
                      >
                        {savingAddress && (
                          <LoaderCircle size={15} className="spin" aria-hidden="true" />
                        )}
                        {savingAddress ? "Salvando endereço…" : "Salvar endereço agora"}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {/* 2. Pedido & Pagamento Sandbox */}
          {!payment && !hasSavedOrder && (
            <section className="table-card admin-sandbox-card" aria-labelledby="sandbox-payment-title">
              <h2 id="sandbox-payment-title">2. Item e pagamento Asaas Sandbox</h2>

              {productsLoading ? (
                <p className="muted" role="status">
                  Carregando estoque isolado do Sandbox…
                </p>
              ) : !sandboxProducts.length ? (
                <p role="alert">Nenhum produto Sandbox habilitado nesta configuração.</p>
              ) : (
                <div className="admin-sandbox-fields">
                  <div className="form-grid">
                    <label className="field-wide" htmlFor="sandbox-product">
                      Produto sintético (banco isolado)
                      <select
                        id="sandbox-product"
                        value={selectedProductId}
                        onChange={(e) => {
                          const next = sandboxProducts.find((p) => p.id === e.target.value);
                          selectedProductIdRef.current = e.target.value;
                          setSelectedProductId(e.target.value);
                          setSelectedVariant(next?.variants[0] || "");
                          setQuantity(1);
                        }}
                      >
                        {sandboxProducts.map((p) => (
                          <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                            {p.name} · {currency(p.price_cents / 100)} (Estoque isolado: {p.stock})
                          </option>
                        ))}
                      </select>
                    </label>

                    {activeProduct && activeProduct.variants.length > 0 && (
                      <label htmlFor="sandbox-variant">
                        Variante
                        <select
                          id="sandbox-variant"
                          value={selectedVariant}
                          onChange={(e) => setSelectedVariant(e.target.value)}
                        >
                          {activeProduct.variants.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    <label htmlFor="sandbox-quantity">
                      Quantidade
                      <input
                        id="sandbox-quantity"
                        type="number"
                        min={1}
                        max={maxQty}
                        value={quantity}
                        onChange={(e) =>
                          setQuantity(Math.min(maxQty, Math.max(1, Number(e.target.value) || 1)))
                        }
                      />
                    </label>
                  </div>

                  <fieldset className="checkout-payment-section">
                    <legend>Forma de pagamento (Sandbox)</legend>
                    <div className="checkout-choice-grid">
                      <label className="checkout-choice" htmlFor="admin-sandbox-card">
                        <input
                          id="admin-sandbox-card"
                          type="radio"
                          name="adminSandboxMethod"
                          checked={method === "card"}
                          onChange={() => setMethod("card")}
                        />
                        <span>
                          <strong>Cartão de crédito (Asaas hospedado)</strong>
                          <small>
                            Redireciona diretamente para sandbox.asaas.com para concluir o teste.
                          </small>
                        </span>
                      </label>
                      <label className="checkout-choice" htmlFor="admin-sandbox-pix">
                        <input
                          id="admin-sandbox-pix"
                          type="radio"
                          name="adminSandboxMethod"
                          checked={method === "pix"}
                          onChange={() => setMethod("pix")}
                        />
                        <span>
                          <strong>Pix (Asaas Sandbox)</strong>
                          <small>
                            Cria cobrança Pix real no Sandbox e reconcilia via webhook.
                          </small>
                        </span>
                      </label>
                    </div>
                  </fieldset>
                </div>
              )}

              <div className="checkout-actions-row">
                <Button
                  type="button"
                  disabled={busy || savingAddress || productsLoading || !activeProduct || activeProduct.stock < 1}
                  onClick={() => {
                    void handleCheckoutSubmit();
                  }}
                >
                  {busy
                    ? method === "card"
                      ? "Criando checkout e redirecionando…"
                      : "Gerando cobrança Sandbox…"
                    : method === "card"
                      ? "Pagar com cartão no Asaas Sandbox"
                      : "Gerar cobrança Pix no Asaas Sandbox"}
                  <ArrowRight size={17} aria-hidden="true" />
                </Button>
              </div>
            </section>
          )}

          {/* 3. Acompanhamento pós-criação / retorno do checkout hospedado */}
          {(payment || hasSavedOrder) && (
            <section className="table-card admin-sandbox-card" aria-live="polite">
              {payment ? (
                <>
                  <div className="checkout-section-head">
                    <div>
                      <p className="eyebrow">Asaas Sandbox · Pedido {payment.order.orderNumber}</p>
                      <h2>
                        {ORDER_STATUS_LABEL[payment.order.status]} ·{" "}
                        {currency(payment.order.totalCents / 100)}
                      </h2>
                    </div>
                    <span className={`badge-status badge-status--${payment.order.status}`}>
                      <span className="dot" />
                      {ORDER_STATUS_LABEL[payment.order.status]}
                    </span>
                  </div>

                  <p className="muted">
                    Estoque: <strong>{ORDER_STOCK_STATUS_LABEL[payment.order.stockStatus ?? "none"]}</strong>
                    {payment.order.providerReference
                      ? ` · Referência Asaas: ${payment.order.providerReference}`
                      : ""}
                  </p>

                  {payment.sandboxStock && payment.sandboxStock.length > 0 && (
                    <div className="admin-sandbox-stock-row">
                      {payment.sandboxStock.map((item) => (
                        <span key={item.productId} className="admin-sandbox-stock-pill">
                          {item.productName}: <strong>{item.quantity} un.</strong> (isolado)
                        </span>
                      ))}
                    </div>
                  )}

                  {redirectingUrl && (
                    <div className="checkout-test-note" role="status">
                      <LoaderCircle size={15} className="spin" aria-hidden="true" />
                      <p>
                        Redirecionando para o checkout hospedado do Asaas Sandbox…{" "}
                        <a className="text-link" href={redirectingUrl}>
                          Clique aqui se não redirecionar
                        </a>
                      </p>
                    </div>
                  )}

                  {payment.order.checkoutUrl &&
                    payment.order.status === "pending_payment" &&
                    payment.attemptState === "ready" &&
                    !redirectingUrl && (
                      <div className="checkout-actions-row">
                        <a className="button button-primary" href={payment.order.checkoutUrl}>
                          Abrir checkout hospedado do Asaas
                          <ExternalLink size={16} aria-hidden="true" />
                        </a>
                      </div>
                    )}

                  {payment.pix && (
                    <div className="asaas-qr">
                      <Image
                        unoptimized
                        src={`data:image/png;base64,${payment.pix.encodedImage}`}
                        alt="QR Code Pix do pedido"
                        width={220}
                        height={220}
                      />
                      <label className="asaas-code">
                        Pix Copia e Cola
                        <textarea readOnly value={payment.pix.payload} aria-label="Pix Copia e Cola" />
                      </label>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(payment.pix!.payload);
                            setStatusMessage("Código Pix copiado.");
                          } catch {
                            setStatusMessage("Selecione e copie o código acima.");
                          }
                        }}
                      >
                        Copiar código Pix
                      </Button>
                    </div>
                  )}

                  {payment.warning && (
                    <p role="status" className="muted">
                      Aviso do provedor: {payment.warning}
                      {payment.diagnostic?.code ? ` (${payment.diagnostic.code})` : ""}. Você ainda pode acompanhar e reconciliar a cobrança abaixo.
                    </p>
                  )}

                  <h3>Histórico do pedido</h3>
                  <ul className="order-history-list">
                    {payment.order.history.map((entry) => (
                      <li key={entry.id}>
                        <div className="order-history-list__head">
                          <strong>{ORDER_STATUS_LABEL[entry.toStatus]}</strong>
                          <span>{new Date(entry.createdAt).toLocaleString("pt-BR")}</span>
                        </div>
                        <p>{entry.reason}</p>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p role="status" className="muted">
                  Carregando tentativa Sandbox…
                </p>
              )}

              <div className="checkout-actions-row">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    void handleCheckoutSubmit();
                  }}
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  {busy ? "Atualizando…" : "Atualizar status"}
                </Button>
                {payment &&
                  !["paid", "refunded", "canceled", "expired"].includes(payment.order.status) && (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        void handleCancelOrder();
                      }}
                    >
                      Cancelar e liberar estoque
                    </Button>
                  )}
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    void resetAttempt();
                  }}
                >
                  Fazer nova compra de teste
                </Button>
              </div>

              <div className="checkout-actions-row">
                <Link href="/admin/asaas" className="text-link">
                  Ver painel Asaas Sandbox
                </Link>
                {customer && (
                  <Link href="/conta/pedidos" className="text-link">
                    Ver em Meus pedidos
                  </Link>
                )}
              </div>
            </section>
          )}

          {statusMessage && (
            <p role="status" className="muted">
              {statusMessage}
            </p>
          )}
        </div>

        {/* Coluna lateral: Resumo & Estoque isolado */}
        <aside className="table-card admin-sandbox-card admin-sandbox-aside">
          <h2>Resumo do teste</h2>
          {payment ? (
            <>
              <div className="checkout-items">
                {payment.order.items.map((item) => (
                  <p key={item.id}>
                    <span>
                      {item.quantity} × {item.productName}
                      {item.variant ? ` · ${item.variant}` : ""}
                    </span>
                    <strong>{currency(item.lineTotalCents / 100)}</strong>
                  </p>
                ))}
              </div>
              <div className="summary-total">
                <span>Total Sandbox</span>
                <strong>{currency(payment.order.totalCents / 100)}</strong>
              </div>
            </>
          ) : activeProduct ? (
            <>
              <div className="checkout-items">
                <p>
                  <span>
                    {quantity} × {activeProduct.name}
                    {selectedVariant ? ` · ${selectedVariant}` : ""}
                  </span>
                  <strong>{currency((activeProduct.price_cents * quantity) / 100)}</strong>
                </p>
              </div>
              <div className="summary-total">
                <span>Total Sandbox</span>
                <strong>{currency((activeProduct.price_cents * quantity) / 100)}</strong>
              </div>
              <p className="muted">
                Estoque disponível no banco isolado: <strong>{activeProduct.stock} un.</strong>
              </p>
            </>
          ) : (
            <p className="muted">Selecione um item para iniciar.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
