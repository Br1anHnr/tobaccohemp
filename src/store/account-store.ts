"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { demoProfile } from "@/data/account-demo";
import {
  authClient,
  fetchCustomerSessionResult,
  type SignInInput,
  type SignUpInput,
} from "@/lib/auth";
import { STORAGE } from "@/lib/constants";
import type {
  AuthResult,
  CustomerAddress,
  CustomerAddressInput,
  CustomerProfile,
} from "@/types/account";

interface AccountState {
  /** True only while the visitor explores the demonstrative customer area. */
  demo: boolean;
  hydrated: boolean;
  sessionPending: boolean;
  sessionChecked: boolean;
  addressesLoaded: boolean;
  addressesLoading: boolean;
  addressesError: string | null;
  /** Signed-in customer, or null for guests and the demo area. */
  customer: CustomerProfile | null;
  /** Profile shown in the customer area (signed-in account or demo). */
  profile: CustomerProfile;
  startDemo: () => void;
  endDemo: () => void;
  loadSession: () => Promise<void>;
  refreshAddresses: () => Promise<AuthResult>;
  signIn: (input: SignInInput) => Promise<AuthResult>;
  signUp: (input: SignUpInput) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  saveProfile: (profile: CustomerProfile) => Promise<AuthResult>;
  saveAddress: (input: CustomerAddressInput) => Promise<AuthResult>;
  updateAddress: (id: string, input: CustomerAddressInput) => Promise<AuthResult>;
  deleteAddress: (id: string) => Promise<AuthResult>;
}

let inflightSession: Promise<void> | null = null;
let inflightAddresses: Promise<AuthResult> | null = null;

function applyAddresses(
  customer: CustomerProfile,
  addresses: CustomerAddress[],
): CustomerProfile {
  const primary = addresses.find((a) => a.isDefault) ?? addresses[0];
  return {
    ...customer,
    city: customer.city || primary?.city || "",
    state: customer.state || primary?.state || "",
    addresses,
  };
}

export const useAccount = create<AccountState>()(
  persist(
    (set, get) => ({
      demo: false,
      hydrated: false,
      sessionPending: false,
      sessionChecked: false,
      addressesLoaded: false,
      addressesLoading: false,
      addressesError: null,
      customer: null,
      profile: demoProfile,
      startDemo: () =>
        set({
          demo: true,
          customer: null,
          profile: demoProfile,
          sessionPending: false,
          addressesLoaded: false,
          addressesError: null,
        }),
      endDemo: () =>
        set({
          demo: false,
          customer: null,
          profile: demoProfile,
          sessionPending: false,
          addressesLoaded: false,
          addressesError: null,
        }),
      loadSession: async () => {
        if (inflightSession) return inflightSession;
        set({ sessionPending: true });
        inflightSession = fetchCustomerSessionResult()
          .then((result) => {
            if (!result.ok) {
              set({ sessionPending: false });
              return;
            }
            if (result.account) {
              set({
                customer: result.account,
                profile: result.account,
                demo: false,
                sessionChecked: true,
                sessionPending: false,
                addressesLoaded: true,
                addressesError: null,
              });
            } else {
              set((state) => ({
                customer: null,
                profile: state.demo ? state.profile : demoProfile,
                sessionChecked: true,
                sessionPending: false,
                addressesLoaded: false,
                addressesError: null,
              }));
            }
          })
          .catch(() => {
            set({ sessionPending: false });
          })
          .finally(() => {
            inflightSession = null;
          });
        return inflightSession;
      },
      refreshAddresses: async () => {
        const current = get().customer;
        if (!current) {
          return {
            ok: false,
            code: "unauthorized",
            message: "Entre na sua conta para carregar seus endereços.",
          };
        }
        if (inflightAddresses) return inflightAddresses;
        set({ addressesLoading: true, addressesError: null });
        inflightAddresses = authClient
          .fetchAddresses()
          .then((result): AuthResult => {
            const latest = get().customer;
            if (!latest) {
              set({ addressesLoading: false });
              return {
                ok: false,
                code: "unauthorized",
                message: "Entre na sua conta para carregar seus endereços.",
              };
            }
            if (result.ok && Array.isArray(result.addresses)) {
              const next = applyAddresses(latest, result.addresses);
              set({
                customer: next,
                profile: next,
                addressesLoaded: true,
                addressesLoading: false,
                addressesError: null,
              });
              return result;
            }
            if (!result.ok && result.code === "unauthorized") {
              set({
                customer: null,
                profile: demoProfile,
                demo: false,
                sessionChecked: true,
                addressesLoaded: false,
                addressesLoading: false,
                addressesError:
                  "Sua sessão expirou. Entre novamente para carregar seus endereços.",
              });
              return result;
            }
            const failureMessage = !result.ok
              ? result.message
              : "Não foi possível carregar seus endereços salvos.";
            set({
              addressesLoading: false,
              addressesError: failureMessage,
            });
            return result.ok
              ? { ok: false, code: "server", message: failureMessage }
              : result;
          })
          .catch((): AuthResult => {
            const message = "Não foi possível carregar seus endereços salvos.";
            set({ addressesLoading: false, addressesError: message });
            return { ok: false, code: "network", message };
          })
          .finally(() => {
            inflightAddresses = null;
          });
        return inflightAddresses;
      },
      signIn: async (input) => {
        const result = await authClient.signIn(input);
        if (result.ok && result.account) {
          set({
            customer: result.account,
            profile: result.account,
            demo: false,
            sessionChecked: true,
            sessionPending: false,
            addressesLoaded: true,
            addressesLoading: false,
            addressesError: null,
          });
        }
        return result;
      },
      signUp: async (input) => {
        const result = await authClient.signUp(input);
        if (result.ok && result.account) {
          set({
            customer: result.account,
            profile: result.account,
            demo: false,
            sessionChecked: true,
            sessionPending: false,
            addressesLoaded: true,
            addressesLoading: false,
            addressesError: null,
          });
        }
        return result;
      },
      signOut: async () => {
        await authClient.signOut();
        set({
          customer: null,
          profile: demoProfile,
          demo: false,
          sessionChecked: true,
          sessionPending: false,
          addressesLoaded: false,
          addressesLoading: false,
          addressesError: null,
        });
      },
      saveProfile: async (profile) => {
        if (get().customer) {
          const result = await authClient.updateProfile(profile);
          if (result.ok && result.account) {
            set({ customer: result.account, profile: result.account });
          }
          return result;
        }
        set({ profile });
        return { ok: true } as AuthResult;
      },
      saveAddress: async (input) => {
        const current = get().customer;
        if (!current) {
          return {
            ok: false,
            code: "unauthorized",
            message: "Entre na sua conta para salvar endereços.",
          };
        }
        const result = await authClient.saveAddress(input);
        if (result.ok && Array.isArray(result.addresses)) {
          const latest = get().customer ?? current;
          const next = applyAddresses(latest, result.addresses);
          set({
            customer: next,
            profile: next,
            addressesLoaded: true,
            addressesError: null,
          });
          return result;
        }
        if (!result.ok && result.code === "unauthorized") {
          set({
            customer: null,
            profile: demoProfile,
            addressesLoaded: false,
            addressesError: result.message,
          });
          return result;
        }
        return result.ok
          ? {
              ok: false,
              code: "server",
              message: "Não foi possível confirmar o endereço salvo. Tente novamente.",
            }
          : result;
      },
      updateAddress: async (id, input) => {
        const current = get().customer;
        if (!current) {
          return {
            ok: false,
            code: "unauthorized",
            message: "Entre na sua conta para editar endereços.",
          };
        }
        const result = await authClient.updateAddress(id, input);
        if (result.ok && Array.isArray(result.addresses)) {
          const latest = get().customer ?? current;
          const next = applyAddresses(latest, result.addresses);
          set({
            customer: next,
            profile: next,
            addressesLoaded: true,
            addressesError: null,
          });
          return result;
        }
        if (!result.ok && result.code === "unauthorized") {
          set({
            customer: null,
            profile: demoProfile,
            addressesLoaded: false,
            addressesError: result.message,
          });
          return result;
        }
        return result.ok
          ? {
              ok: false,
              code: "server",
              message:
                "Não foi possível confirmar a atualização do endereço. Tente novamente.",
            }
          : result;
      },
      deleteAddress: async (id) => {
        const current = get().customer;
        if (!current) {
          return {
            ok: false,
            code: "unauthorized",
            message: "Entre na sua conta para remover endereços.",
          };
        }
        const result = await authClient.deleteAddress(id);
        if (result.ok && Array.isArray(result.addresses)) {
          const latest = get().customer ?? current;
          const next = applyAddresses(latest, result.addresses);
          set({
            customer: next,
            profile: next,
            addressesLoaded: true,
            addressesError: null,
          });
          return result;
        }
        if (!result.ok && result.code === "unauthorized") {
          set({
            customer: null,
            profile: demoProfile,
            addressesLoaded: false,
            addressesError: result.message,
          });
          return result;
        }
        return result.ok
          ? {
              ok: false,
              code: "server",
              message:
                "Não foi possível confirmar a remoção do endereço. Tente novamente.",
            }
          : result;
      },
    }),
    {
      name: STORAGE.demoAccount,
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          try {
            return sessionStorage.getItem(name);
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            sessionStorage.setItem(name, value);
          } catch {
            /* Demo flag stays in memory. */
          }
        },
        removeItem: (name) => {
          try {
            sessionStorage.removeItem(name);
          } catch {
            /* Nothing to clean. */
          }
        },
      })),
      skipHydration: true,
      // Only the demo flag is persisted — never the session, profile or password.
      partialize: (state) => ({ demo: state.demo }),
      merge: (persisted, current) => ({
        ...current,
        demo: (persisted as { demo?: unknown } | undefined)?.demo === true,
      }),
    },
  ),
);
