import type { CustomerProfileInput, CustomerSignInInput, CustomerSignUpInput, PasswordResetInput } from "@/shared/contracts/customer";
import { invalid, objectInput, textInput } from "@/shared/server/validation";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function emailInput(value: unknown): string {
  const email = textInput(value, 254).toLowerCase();
  if (!emailRe.test(email)) invalid();
  return email;
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
  const input = objectInput(value, ["name", "email", "password"]);
  return { name: textInput(input.name, 120), email: emailInput(input.email), password: passwordInput(input.password) };
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
  const phone = typeof input.phone === "string" ? input.phone.replace(/\D/g, "") : invalid();
  if (phone.length < 10 || phone.length > 11) invalid();
  const state = typeof input.state === "string" ? input.state.trim().toUpperCase() : invalid();
  if (!/^[A-Z]{2}$/.test(state)) invalid();
  return {
    name: textInput(input.name, 120),
    phone,
    city: textInput(input.city, 80),
    state,
  };
}

export function resetInput(value: unknown): PasswordResetInput {
  const input = objectInput(value, ["token", "password"]);
  return { token: textInput(input.token, 256), password: passwordInput(input.password) };
}
