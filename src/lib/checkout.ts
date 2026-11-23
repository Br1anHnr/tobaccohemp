import { findProduct as findStaticProduct } from "@/data/products";
import { evaluateOrderEligibility, type OrderEligibilitySummary } from "@/modules/orders/domain/eligibility";
import type { CartItem } from "@/types/cart";
import type { Product } from "@/types/product";

function resolveProduct(id: string, catalogProducts?: readonly Product[]): Product | undefined {
  return catalogProducts?.find((p) => p.id === id) ?? findStaticProduct(id);
}

export const contactFields = [
  { name: "name", label: "Nome completo", autoComplete: "name" },
  { name: "email", label: "E-mail", type: "email", autoComplete: "email" },
  { name: "phone", label: "Telefone", type: "tel", autoComplete: "tel" },
] as const;

export const deliveryFields = [
  { name: "zip", label: "CEP", autoComplete: "postal-code" },
  { name: "address", label: "Endereço", autoComplete: "address-line1" },
  { name: "number", label: "Número", autoComplete: "off" },
  {
    name: "complement",
    label: "Complemento (opcional)",
    autoComplete: "address-line2",
    optional: true,
  },
  { name: "city", label: "Cidade", autoComplete: "address-level2" },
] as const;

export const checkoutFields = [...contactFields, ...deliveryFields] as const;

export type DeliveryValues = {
  zip: string;
  address: string;
  number: string;
  complement: string;
  city: string;
  state: string;
};

export type CheckoutValues = DeliveryValues & {
  name: string;
  email: string;
  phone: string;
  demo?: boolean;
};

export function validateDeliveryValues(values: DeliveryValues) {
  const errors: Record<string, string> = {};
  for (const field of deliveryFields) {
    const val = String(values[field.name] ?? "").trim();
    if (!("optional" in field) && !val)
      errors[field.name] = `Preencha ${field.label.toLowerCase()}.`;
  }
  if (values.zip.replace(/\D/g, "").length !== 8)
    errors.zip = "Informe um CEP com 8 dígitos.";
  if (!/^[A-Z]{2}$/.test(values.state.trim().toUpperCase()))
    errors.state = "Selecione o estado.";
  return errors;
}

export function validateCheckoutValues(values: CheckoutValues) {
  const errors: Record<string, string> = {};
  for (const field of checkoutFields) {
    const val = String(values[field.name] ?? "").trim();
    if (!("optional" in field) && !val)
      errors[field.name] = `Preencha ${field.label.toLowerCase()}.`;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
    errors.email = "Informe um e-mail válido.";
  const phone = values.phone.replace(/\D/g, "");
  if (phone.length < 10 || phone.length > 11)
    errors.phone = "Informe um telefone com DDD (10 ou 11 dígitos).";
  if (values.zip.replace(/\D/g, "").length !== 8)
    errors.zip = "Informe um CEP com 8 dígitos.";
  if (!/^[A-Z]{2}$/.test(values.state.trim().toUpperCase()))
    errors.state = "Selecione o estado.";
  return errors;
}

export function validateCheckout(data: FormData) {
  return validateCheckoutValues({
    name: String(data.get("name") ?? ""),
    email: String(data.get("email") ?? ""),
    phone: String(data.get("phone") ?? ""),
    zip: String(data.get("zip") ?? ""),
    address: String(data.get("address") ?? ""),
    number: String(data.get("number") ?? ""),
    complement: String(data.get("complement") ?? ""),
    city: String(data.get("city") ?? ""),
    state: String(data.get("state") ?? ""),
  });
}

export function evaluateCartEligibility(
  items: CartItem[],
  catalogProducts?: readonly Product[],
): OrderEligibilitySummary {
  return evaluateOrderEligibility(
    items.map((item) => {
      const product = resolveProduct(item.productId, catalogProducts);
      return {
        product: product
          ? {
              id: product.id,
              name: product.name,
              sku: (product.slug ?? product.id).toUpperCase(),
              categorySlug: product.categorySlug,
              active: true,
              stock: product.stock,
              tags: product.tags,
            }
          : undefined,
        quantity: item.quantity,
      };
    }),
  );
}
