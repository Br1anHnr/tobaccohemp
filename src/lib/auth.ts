import type { AuthResult, CustomerProfile } from "@/types/account";
import { AUTH } from "./constants";

export interface SignInInput {
  email: string;
  password: string;
}
export interface SignUpInput extends SignInInput {
  name: string;
}

/**
 * Contract for the customer authentication provider.
 * The real implementation must run against the approved backend and keep the
 * session in httpOnly cookies. Passwords must never be stored on the client.
 */
export interface AuthClient {
  signIn(input: SignInInput): Promise<AuthResult>;
  signUp(input: SignUpInput): Promise<AuthResult>;
  requestPasswordReset(email: string): Promise<AuthResult>;
  signOut(): Promise<AuthResult>;
}

const notConfigured = (): Promise<AuthResult> =>
  Promise.resolve({
    ok: false,
    code: "not_configured",
    message:
      "A autenticação de clientes ainda não está ativa. Nenhum dado foi enviado ou armazenado.",
  });

/** Placeholder used while no backend is configured. It never fakes success. */
const unavailableAuth: AuthClient = {
  signIn: notConfigured,
  signUp: notConfigured,
  requestPasswordReset: notConfigured,
  signOut: notConfigured,
};

export const authClient: AuthClient = unavailableAuth;
export const authEnabled = AUTH.enabled;

type Errors = Record<string, string>;
const text = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function validateEmail(data: FormData, errors: Errors = {}) {
  if (!isEmail(text(data, "email")))
    errors.email = "Informe um e-mail válido.";
  return errors;
}

export function validateSignIn(data: FormData) {
  const errors = validateEmail(data);
  if (!String(data.get("password") ?? "")) errors.password = "Informe sua senha.";
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

export function validateProfile(data: FormData) {
  const errors: Errors = {};
  if (text(data, "name").length < 3) errors.name = "Informe seu nome completo.";
  validateEmail(data, errors);
  const phone = text(data, "phone").replace(/\D/g, "");
  if (phone.length < 10 || phone.length > 11)
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
