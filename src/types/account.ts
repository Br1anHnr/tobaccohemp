import type { CartItem } from "./cart";

export interface CustomerProfile {
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
}

export type OrderStatus = "em-separacao" | "enviado" | "entregue" | "cancelado";

export interface CustomerOrder {
  number: string;
  createdAt: string;
  status: OrderStatus;
  items: CartItem[];
  shipping: number;
}

/** Result returned by any authentication adapter (demo or real). */
export type AuthResult =
  | { ok: true }
  | { ok: false; code: "not_configured" | "invalid" | "network"; message: string };
