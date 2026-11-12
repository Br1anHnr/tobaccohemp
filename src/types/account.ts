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
  | { ok: true; account?: CustomerProfile; resetToken?: string; message?: string }
  | { ok: false; code: "invalid" | "network" | "unavailable" | "rate_limit"; message: string };
