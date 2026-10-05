import type { CartItem, DemoOrder } from "@/types/cart";
import { cartCount, cartTotal } from "@/store/cart-store";
export const checkoutFields = [
  { name: "name", label: "Nome completo", autoComplete: "name" },
  { name: "email", label: "E-mail", type: "email", autoComplete: "email" },
  { name: "phone", label: "Telefone", type: "tel", autoComplete: "tel" },
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
export function validateCheckout(data: FormData) {
  const errors: Record<string, string> = {};
  for (const field of checkoutFields)
    if (!("optional" in field) && !String(data.get(field.name) ?? "").trim())
      errors[field.name] = `Preencha ${field.label.toLowerCase()}.`;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.get("email"))))
    errors.email = "Informe um e-mail válido.";
  const phone = String(data.get("phone")).replace(/\D/g, "");
  if (phone.length < 10 || phone.length > 11)
    errors.phone = "Informe um telefone com DDD (10 ou 11 dígitos).";
  if (String(data.get("zip")).replace(/\D/g, "").length !== 8)
    errors.zip = "Informe um CEP com 8 dígitos.";
  if (!/^[A-Z]{2}$/.test(String(data.get("state"))))
    errors.state = "Selecione o estado.";
  if (data.get("demo") !== "on")
    errors.demo = "Confirme que este é um pedido demonstrativo.";
  return errors;
}
// Replace this adapter with a server-side order service when real commerce is connected.
// Personal form data is intentionally never stored by this local demonstration.
export function createDemoOrder(items: CartItem[]): DemoOrder {
  return {
    number: `TH-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    total: cartTotal(items),
    count: cartCount(items),
    createdAt: new Date().toISOString(),
  };
}
