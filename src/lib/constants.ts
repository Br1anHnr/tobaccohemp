export const STORE = {
  name: "Tobacco Hemp",
  logo: "/brand/tobacco-hemp-logo.png",
  instagramHandle: "@tobaccohemp",
  whatsapp: "",
  instagramUrl: "",
  tiktokUrl: "",
  address: "",
  hours: "",
  email: "",
};
export const STORAGE = {
  cart: "th-cart-v1",
  age: "th-age-confirmed",
  favorites: "th-favorites-v1",
  order: "th-demo-order",
  // Stores only the demo-mode flag in sessionStorage; never credentials.
  demoAccount: "th-demo-account",
};
// Customer authentication stays disabled until a real backend is configured.
export const AUTH = {
  enabled: false,
};
export const BRAZIL_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;
