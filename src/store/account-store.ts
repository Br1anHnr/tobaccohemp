"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { demoProfile } from "@/data/account-demo";
import { authClient, fetchCustomerSession, type SignInInput, type SignUpInput } from "@/lib/auth";
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
  /** Signed-in customer, or null for guests and the demo area. */
  customer: CustomerProfile | null;
  /** Profile shown in the customer area (signed-in account or demo). */
  profile: CustomerProfile;
  startDemo: () => void;
  endDemo: () => void;
  loadSession: () => Promise<void>;
  signIn: (input: SignInInput) => Promise<AuthResult>;
  signUp: (input: SignUpInput) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  saveProfile: (profile: CustomerProfile) => Promise<AuthResult>;
  saveAddress: (input: CustomerAddressInput) => Promise<AuthResult>;
  updateAddress: (id: string, input: CustomerAddressInput) => Promise<AuthResult>;
  deleteAddress: (id: string) => Promise<AuthResult>;
}

let inflightSession: Promise<void> | null = null;

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
      customer: null,
      profile: demoProfile,
      startDemo: () => set({ demo: true, customer: null, profile: demoProfile, sessionPending: false }),
      endDemo: () => set({ demo: false, customer: null, profile: demoProfile, sessionPending: false }),
      loadSession: async () => {
        if (inflightSession) return inflightSession;
        set({ sessionPending: true });
        inflightSession = fetchCustomerSession()
          .then((account) => {
            if (account) {
              set({ customer: account, profile: account, demo: false, sessionChecked: true, sessionPending: false });
            } else {
              set({ sessionChecked: true, sessionPending: false });
            }
          })
          .catch(() => {
            set({ sessionChecked: true, sessionPending: false });
          })
          .finally(() => {
            inflightSession = null;
          });
        return inflightSession;
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
          });
        }
        return result;
      },
      signOut: async () => {
        await authClient.signOut();
        set({ customer: null, profile: demoProfile, demo: false, sessionChecked: true, sessionPending: false });
      },
      saveProfile: async (profile) => {
        if (get().customer) {
          const result = await authClient.updateProfile(profile);
          if (result.ok && result.account) set({ customer: result.account, profile: result.account });
          return result;
        }
        set({ profile });
        return { ok: true } as AuthResult;
      },
      saveAddress: async (input) => {
        const current = get().customer;
        if (!current) {
          return { ok: false, code: "invalid", message: "Entre na sua conta para salvar endereços." };
        }
        const result = await authClient.saveAddress(input);
        if (result.ok && result.addresses) {
          const next = applyAddresses(current, result.addresses);
          set({ customer: next, profile: next });
        }
        return result;
      },
      updateAddress: async (id, input) => {
        const current = get().customer;
        if (!current) {
          return { ok: false, code: "invalid", message: "Entre na sua conta para editar endereços." };
        }
        const result = await authClient.updateAddress(id, input);
        if (result.ok && result.addresses) {
          const next = applyAddresses(current, result.addresses);
          set({ customer: next, profile: next });
        }
        return result;
      },
      deleteAddress: async (id) => {
        const current = get().customer;
        if (!current) {
          return { ok: false, code: "invalid", message: "Entre na sua conta para remover endereços." };
        }
        const result = await authClient.deleteAddress(id);
        if (result.ok && result.addresses) {
          const next = applyAddresses(current, result.addresses);
          set({ customer: next, profile: next });
        }
        return result;
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
