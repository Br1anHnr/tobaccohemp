import {
  customerEndpoints,
  type CustomerAccount,
  type CustomerAddress,
  type CustomerAddressInput,
} from "@/shared/contracts/customer";
import type { AuthResult, CustomerProfile } from "@/types/account";
import { AUTH } from "./constants";

export interface SignInInput {
  email: string;
  password: string;
}
export interface SignUpInput extends SignInInput {
  name: string;
  phone: string;
}

/**
 * Contract for the customer authentication provider, backed by the real
 * `/api/auth/*` routes. The session lives in an httpOnly cookie; passwords are
 * sent once per request and never stored on the client.
 */
export interface AuthClient {
  signIn(input: SignInInput): Promise<AuthResult>;
  signUp(input: SignUpInput): Promise<AuthResult>;
  requestPasswordReset(email: string): Promise<AuthResult>;
  resetPassword(token: string, password: string): Promise<AuthResult>;
  updateProfile(profile: CustomerProfile): Promise<AuthResult>;
  fetchAddresses(): Promise<AuthResult>;
  saveAddress(input: CustomerAddressInput): Promise<AuthResult>;
  updateAddress(id: string, input: CustomerAddressInput): Promise<AuthResult>;
  deleteAddress(id: string): Promise<AuthResult>;
  signOut(): Promise<AuthResult>;
}

const toProfile = (account: CustomerAccount): CustomerProfile => ({
  name: account.name,
  email: account.email,
  phone: account.phone,
  city: account.city,
  state: account.state,
  addresses: account.addresses ?? [],
});

export type AuthErrorCode = "invalid" | "unauthorized" | "network" | "unavailable" | "rate_limit" | "server";
type CallResult = { data: unknown } | { error: { code: AuthErrorCode; message: string } };

async function call(path: string, init: RequestInit = {}): Promise<CallResult> {
  try {
    const response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      headers: init.body ? { "Content-Type": "application/json", ...(init.headers ?? {}) } : init.headers,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const code: AuthErrorCode =
        response.status === 503 ? "unavailable" :
        response.status === 429 ? "rate_limit" :
        response.status === 401 ? "unauthorized" :
        response.status >= 500 ? "server" : "invalid";
      const message = body?.error?.message ?? "Não foi possível concluir a operação.";
      return { error: { code, message } };
    }
    return { data: body?.data };
  } catch {
    return { error: { code: "network", message: "Não foi possível conectar ao servidor." } };
  }
}

const error = (result: CallResult): AuthResult =>
  "error" in result ? { ok: false, code: result.error.code, message: result.error.message } : { ok: true };

const httpAuth: AuthClient = {
  async signIn(input) {
    const result = await call(customerEndpoints.login, { method: "POST", body: JSON.stringify(input) });
    if ("error" in result) return error(result);
    return { ok: true, account: toProfile(result.data as CustomerAccount) };
  },
  async signUp(input) {
    const result = await call(customerEndpoints.signup, { method: "POST", body: JSON.stringify(input) });
    if ("error" in result) return error(result);
    return { ok: true, account: toProfile(result.data as CustomerAccount) };
  },
  async requestPasswordReset(email) {
    const result = await call(customerEndpoints.forgot, { method: "POST", body: JSON.stringify({ email }) });
    if ("error" in result) return error(result);
    const data = result.data as { message?: string; resetToken?: string };
    return { ok: true, resetToken: data.resetToken, message: data.message };
  },
  async resetPassword(token, password) {
    const result = await call(customerEndpoints.reset, { method: "POST", body: JSON.stringify({ token, password }) });
    return error(result);
  },
  async updateProfile(profile) {
    const result = await call(customerEndpoints.profile, {
      method: "PATCH",
      body: JSON.stringify({ name: profile.name, phone: profile.phone, city: profile.city, state: profile.state }),
    });
    if ("error" in result) return error(result);
    return { ok: true, account: toProfile(result.data as CustomerAccount) };
  },
  async fetchAddresses() {
    const result = await call(customerEndpoints.addresses);
    if ("error" in result) return error(result);
    if (!Array.isArray(result.data)) {
      return { ok: false, code: "server", message: "Resposta inválida ao carregar seus endereços." };
    }
    return { ok: true, addresses: result.data as CustomerAddress[] };
  },
  async saveAddress(input) {
    const result = await call(customerEndpoints.addresses, {
      method: "POST",
      body: JSON.stringify(input),
    });
    if ("error" in result) return error(result);
    const data = result.data as { address?: CustomerAddress; addresses?: CustomerAddress[] } | null;
    if (!data?.address || !Array.isArray(data.addresses)) {
      return { ok: false, code: "server", message: "Não foi possível confirmar o endereço salvo." };
    }
    return { ok: true, address: data.address, addresses: data.addresses };
  },
  async updateAddress(id, input) {
    const result = await call(`${customerEndpoints.addresses}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    if ("error" in result) return error(result);
    const data = result.data as { address?: CustomerAddress; addresses?: CustomerAddress[] } | null;
    if (!data?.address || !Array.isArray(data.addresses)) {
      return { ok: false, code: "server", message: "Não foi possível confirmar a atualização do endereço." };
    }
    return { ok: true, address: data.address, addresses: data.addresses };
  },
  async deleteAddress(id) {
    const result = await call(`${customerEndpoints.addresses}/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if ("error" in result) return error(result);
    if (!Array.isArray(result.data)) {
      return { ok: false, code: "server", message: "Não foi possível confirmar a remoção do endereço." };
    }
    return { ok: true, addresses: result.data as CustomerAddress[] };
  },
  async signOut() {
    const result = await call(customerEndpoints.logout, { method: "POST" });
    return error(result);
  },
};

export const authClient: AuthClient = httpAuth;
export const authEnabled = AUTH.enabled;

export type SessionLookupResult =
  | { ok: true; account: CustomerProfile | null }
  | { ok: false; code: AuthErrorCode; message: string };

/** Resolves the current signed-in customer, distinguishing transient errors from signed-out state. */
export async function fetchCustomerSessionResult(): Promise<SessionLookupResult> {
  const result = await call(customerEndpoints.session);
  if ("error" in result) {
    return { ok: false, code: result.error.code, message: result.error.message };
  }
  return { ok: true, account: result.data ? toProfile(result.data as CustomerAccount) : null };
}

/** Resolves the current signed-in customer from the session cookie (or null). */
export async function fetchCustomerSession(): Promise<CustomerProfile | null> {
  const result = await fetchCustomerSessionResult();
  return result.ok ? result.account : null;
}

type Errors = Record<string, string>;
const text = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidPhone(value: string): boolean {
  const digits = phoneDigits(value);
  return digits.length === 10 || digits.length === 11;
}

export function formatPhone(value: string): string {
  const digits = phoneDigits(value);
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return value;
}

export function formatZip(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : value;
}

export function validateEmail(data: FormData, errors: Errors = {}) {
  if (!isEmail(text(data, "email")))
    errors.email = "Informe um e-mail válido.";
  return errors;
}

export function validateSignIn(data: FormData) {
  const errors = validateEmail(data);
  if (!String(data.get("password") ?? "")) errors["password"] = "Informe sua senha.";
  return errors;
}

export function passwordIssues(password: string) {
  const issues: string[] = [];
  if (password.length < 8) issues.push("ao menos 8 caracteres");
  if (!/[A-Za-z]/.test(password)) issues.push("uma letra");
  if (!/\d/.test(password)) issues.push("um número");
  return issues;
}

export function validateSignUp(data: FormData) {
  const errors: Errors = {};
  if (text(data, "name").length < 3) errors.name = "Informe seu nome completo.";
  validateEmail(data, errors);
  if (!isValidPhone(text(data, "phone")))
    errors.phone = "Informe um telefone com DDD (10 ou 11 dígitos).";
  const password = String(data.get("password") ?? "");
  const issues = passwordIssues(password);
  if (issues.length) errors.password = `A senha precisa ter ${issues.join(", ")}.`;
  if (password !== String(data.get("confirm") ?? ""))
    errors.confirm = "As senhas não coincidem.";
  if (data.get("adult") !== "on")
    errors.adult = "Confirme que você tem 18 anos ou mais.";
  if (data.get("terms") !== "on")
    errors.terms = "Aceite os termos de uso e a política de privacidade.";
  return errors;
}

export function validateResetPassword(data: FormData) {
  const errors: Errors = {};
  const password = String(data.get("password") ?? "");
  const issues = passwordIssues(password);
  if (issues.length) errors.password = `A senha precisa ter ${issues.join(", ")}.`;
  if (password !== String(data.get("confirm") ?? ""))
    errors.confirm = "As senhas não coincidem.";
  return errors;
}

export function validateProfile(data: FormData) {
  const errors: Errors = {};
  if (text(data, "name").length < 3) errors.name = "Informe seu nome completo.";
  validateEmail(data, errors);
  if (!isValidPhone(text(data, "phone")))
    errors.phone = "Informe um telefone com DDD (10 ou 11 dígitos).";
  if (!text(data, "city")) errors.city = "Informe sua cidade.";
  if (!/^[A-Z]{2}$/.test(text(data, "state"))) errors.state = "Selecione o estado.";
  return errors;
}

export function profileFromForm(data: FormData): CustomerProfile {
  return {
    name: text(data, "name"),
    email: text(data, "email"),
    phone: text(data, "phone"),
    city: text(data, "city"),
    state: text(data, "state"),
  };
}

export function validateAddressForm(data: FormData): Errors {
  const errors: Errors = {};
  if (text(data, "zip").replace(/\D/g, "").length !== 8)
    errors.zip = "Informe um CEP com 8 dígitos.";
  if (!text(data, "street")) errors.street = "Informe o endereço.";
  if (!text(data, "number")) errors.number = "Informe o número.";
  if (!text(data, "city")) errors.city = "Informe a cidade.";
  if (!/^[A-Z]{2}$/.test(text(data, "state"))) errors.state = "Selecione o estado.";
  return errors;
}

export function addressFromForm(data: FormData): CustomerAddressInput {
  return {
    label: text(data, "label") || "Principal",
    zip: text(data, "zip"),
    street: text(data, "street"),
    number: text(data, "number"),
    complement: text(data, "complement"),
    city: text(data, "city"),
    state: text(data, "state"),
    isDefault: data.get("isDefault") === "on",
  };
}
