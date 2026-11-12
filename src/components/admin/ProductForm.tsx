"use client";

import { useState, type FormEvent } from "react";
import { createProduct } from "@/lib/admin-service";
import { Modal } from "@/components/ui/Modal";
import { FormField } from "@/components/ui/FormField";

export function ProductForm({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Informe o nome.";
    if (!sku.trim()) errors.sku = "Informe o SKU.";
    const parsed = Number(String(price).trim().replace(",", "."));
    if (!price.trim() || !Number.isFinite(parsed) || parsed < 0) {
      errors.price = "Informe um preço válido.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setPending(true);
    setError("");
    try {
      await createProduct({
        name: name.trim(),
        sku: sku.trim().toUpperCase(),
        priceCents: Math.round(parsed * 100),
        active: true,
      });
      setName("");
      setSku("");
      setPrice("");
      onCreated();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível cadastrar o produto.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cadastrar produto"
      description="Crie um produto no catálogo administrativo. O estoque inicia zerado e pode ser ajustado na lista."
    >
      <form onSubmit={submit} className="admin-form">
        <FormField
          id="product-name"
          label="Nome"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={fieldErrors.name}
          required
        />
        <FormField
          id="product-sku"
          label="SKU"
          value={sku}
          onChange={(event) => setSku(event.target.value)}
          error={fieldErrors.sku}
          hint="Letras, números, ponto, hífen ou sublinhado."
          required
        />
        <FormField
          id="product-price"
          label="Preço (R$)"
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          error={fieldErrors.price}
          required
        />
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
            disabled={pending}
          >
            {pending ? "Cadastrando…" : "Cadastrar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
