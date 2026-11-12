/** Shared wire contract for the customer (storefront) authentication. */
export interface CustomerAccount {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  createdAt: string;
}

export type CustomerSignUpInput = { name: string; email: string; password: string };
export type CustomerSignInInput = { email: string; password: string };
export type CustomerProfileInput = { name: string; phone: string; city: string; state: string };
export type PasswordResetInput = { token: string; password: string };

export const customerEndpoints = {
  signup: "/api/auth/signup",
  login: "/api/auth/login",
  logout: "/api/auth/logout",
  session: "/api/auth/session",
  profile: "/api/auth/profile",
  forgot: "/api/auth/password/forgot",
  reset: "/api/auth/password/reset",
} as const;
