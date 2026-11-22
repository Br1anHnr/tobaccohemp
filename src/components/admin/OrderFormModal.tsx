"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createAdminOrder, fetchProducts } from "@/lib/admin-service";
import { currency } from "@/lib/currency";
import { ALLOWED_ACCESSORY_CATEGORIES } from "@/modules/orders/domain/eligibility";
import type { AdminProduct } from "@/types/admin";
import type { OrderChannel, OrderPaymentMethod } from "@/shared/contracts/orders";
import { Modal } from "@/components/ui/Modal";
import { FormField } from "@/components/ui/FormField";

function newIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `admin-order-${globalThis.crypto.randomUUID()}`;
  }
  return `admin-order-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function OrderFormModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [customerLabel, setCustomerLabel] = useState("");
  const [channel, setChannel] = useState<OrderChannel>("site");
  const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethod>("pix");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const idempotencyKeyRef = useRef("");

  const resetIdempotencyKey = () => {
    idempotencyKeyRef.current = newIdempotencyKey();
  };

  useEffect(() => {
    if (!open) return;
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = newIdempotencyKey();
    }
    let active = true;
    fetchProducts()
      .then((list) => {
        if (!active) return;
        const available = list.filter(
          (p) =>
            !p.archived &&
            p.active !== false &&
            p.stock > 0 &&
            Boolean(p.categorySlug && ALLOWED_ACCESSORY_CATEGORIES.has(p.categorySlug)),
        );
        setProducts(available);
        if (available.length && !productId) {
          setProductId(available[0].id);
        }
      })
      .catch(() => {
        if (active) setError("Não foi possível carregar os produtos disponíveis.");
      });
    return () => {
      active = false;
    };
  }, [open, productId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const qty = Number.parseInt(quantity, 10);
    if (!productId) {
      setError("Selecione um produto elegível em estoque.");
      return;
    }
    if (!Number.isSafeInteger(qty) || qty < 1 || qty > 99) {
      setError("Informe uma quantidade válida (1 a 99).");
      return;
    }

    setPending(true);
    setError("");
    try {
      await createAdminOrder({
        customerLabel: customerLabel.trim() || "Pedido demonstrativo",
        channel,
        paymentMethod,
        idempotencyKey: idempotencyKeyRef.current || newIdempotencyKey(),
        items: [{ productId, quantity: qty }],
      });
      resetIdempotencyKey();
      setCustomerLabel("");
      setQuantity("1");
      onCreated();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível registrar o pedido demonstrativo.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo pedido demonstrativo"
      description="Cria um registro sintético com preços congelados e provedor desacoplado. Nenhuma cobrança real é gerada."
    >
      <form onSubmit={submit} className="admin-form">
        <div className="field">
          <label htmlFor="order-product">Produto elegível</label>
          <select
            id="order-product"
            value={productId}
            onChange={(event) => {
              resetIdempotencyKey();
              setProductId(event.target.value);
            }}
            required
          >
            {products.length === 0 ? (
              <option value="">Nenhum produto disponível</option>
            ) : (
              products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · {currency(product.price)} ({product.stock} un.)
                </option>
              ))
            )}
          </select>
        </div>

        <FormField
          id="order-quantity"
          label="Quantidade"
          type="number"
          min={1}
          max={99}
          value={quantity}
          onChange={(event) => {
            resetIdempotencyKey();
            setQuantity(event.target.value);
          }}
          required
        />

        <FormField
          id="order-customer-label"
          label="Identificação do pedido (opcional)"
          placeholder="Ex.: Teste Pix sandbox"
          value={customerLabel}
          onChange={(event) => {
            resetIdempotencyKey();
            setCustomerLabel(event.target.value);
          }}
        />

        <div className="field">
          <label htmlFor="order-channel">Canal</label>
          <select
            id="order-channel"
            value={channel}
            onChange={(event) => {
              resetIdempotencyKey();
              setChannel(event.target.value as OrderChannel);
            }}
          >
            <option value="site">Checkout no site (demo)</option>
            <option value="whatsapp_link">Link via WhatsApp (demo)</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="order-method">Forma de pagamento simulada</label>
          <select
            id="order-method"
            value={paymentMethod}
            onChange={(event) => {
              resetIdempotencyKey();
              setPaymentMethod(event.target.value as OrderPaymentMethod);
            }}
          >
            <option value="pix">Pix (demo)</option>
            <option value="card">Cartão hospedado (demo)</option>
            <option value="demo">Demonstração</option>
          </select>
        </div>

        {error && <p role="alert">{error}</p>}

        <div className="admin-form__actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
            disabled={pending}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={pending || products.length === 0}
          >
            {pending ? "Criando…" : "Criar pedido demo"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
