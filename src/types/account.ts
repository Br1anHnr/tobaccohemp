import type { CustomerAddress, CustomerAddressInput } from "@/shared/contracts/customer";
import type { CartItem } from "./cart";

export type { CustomerAddress, CustomerAddressInput };

export interface CustomerProfile {
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  addresses?: CustomerAddress[];
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
  | {
      ok: true;
      account?: CustomerProfile;
      address?: CustomerAddress;
      addresses?: CustomerAddress[];
      resetToken?: string;
      message?: string;
    }
  | {
      ok: false;
      code: "invalid" | "unauthorized" | "network" | "unavailable" | "rate_limit" | "server";
      message: string;
    };
