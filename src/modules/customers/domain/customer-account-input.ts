import { BRAZIL_STATES } from "@/lib/constants";
import type {
  CustomerAddressInput,
  CustomerProfileInput,
  CustomerSignInInput,
  CustomerSignUpInput,
  PasswordResetInput,
} from "@/shared/contracts/customer";
import { invalid, objectInput, textInput, textInputAllowEmpty } from "@/shared/server/validation";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const validStates = new Set<string>(BRAZIL_STATES);

function emailInput(value: unknown): string {
  const email = textInput(value, 254).toLowerCase();
  if (!emailRe.test(email)) invalid();
  return email;
}

/** Strict Brazilian phone validation (DDD + 8 or 9 digits), stored normalized. */
function phoneInput(value: unknown): string {
  if (typeof value !== "string" || value.length > 32 || /[\u0000-\u001f\u007f]/u.test(value)) invalid();
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 11) invalid();
  return digits;
}

function stateInput(value: unknown): string {
  const state = typeof value === "string" ? value.trim().toUpperCase() : invalid();
  if (!validStates.has(state)) invalid();
  return state;
}

/** Strict password policy for new passwords (mirrors the client rules). */
function passwordInput(value: unknown): string {
  if (typeof value !== "string") invalid();
  if (value.length < 8 || value.length > 128) invalid();
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) invalid();
  if (/[\u0000-\u001f\u007f]/u.test(value)) invalid();
  return value;
}

export function signUpInput(value: unknown): CustomerSignUpInput {
  const input = objectInput(value, ["name", "email", "phone", "password"]);
  return { ...checkoutContactInput({ name: input.name, email: input.email, phone: input.phone }), password: passwordInput(input.password) };
}

export function checkoutContactInput(value: unknown): Pick<CustomerSignUpInput, "name" | "email" | "phone"> {
  const input = objectInput(value, ["name", "email", "phone"]);
  return {
    name: textInput(input.name, 120),
    email: emailInput(input.email),
    phone: phoneInput(input.phone),
  };
}

export function signInInput(value: unknown): CustomerSignInInput {
  const input = objectInput(value, ["email", "password"]);
  const email = emailInput(input.email);
  const password = input.password;
  // Do not enforce complexity on sign-in: a wrong password is a credential error.
  if (typeof password !== "string" || password.length < 1 || password.length > 128 || /[\u0000-\u001f\u007f]/u.test(password)) invalid();
  return { email, password };
}

export function profileInput(value: unknown): CustomerProfileInput {
  const input = objectInput(value, ["name", "phone", "city", "state"]);
  return {
    name: textInput(input.name, 120),
    phone: phoneInput(input.phone),
    city: textInput(input.city, 80),
    state: stateInput(input.state),
  };
}

export function addressInput(value: unknown): CustomerAddressInput {
  const input = objectInput(
    value,
    ["label", "zip", "street", "number", "complement", "city", "state", "isDefault"],
    true,
  );
  if (typeof input.zip !== "string" || input.zip.length > 16 || /[\u0000-\u001f\u007f]/u.test(input.zip)) invalid();
  const zip = input.zip.replace(/\D/g, "");
  if (zip.length !== 8) invalid();

  const labelRaw = input.label === undefined ? "" : textInputAllowEmpty(input.label, 40);
  const complement = input.complement === undefined ? "" : textInputAllowEmpty(input.complement, 120);
  if (input.isDefault !== undefined && typeof input.isDefault !== "boolean") invalid();

  return {
    label: labelRaw || "Principal",
    zip,
    street: textInput(input.street, 160),
    number: textInput(input.number, 24),
    complement,
    city: textInput(input.city, 80),
    state: stateInput(input.state),
    isDefault: input.isDefault,
  };
}

export function resetInput(value: unknown): PasswordResetInput {
  const input = objectInput(value, ["token", "password"]);
  return { token: textInput(input.token, 256), password: passwordInput(input.password) };
}
