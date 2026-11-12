"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { demoProfile } from "@/data/account-demo";
import { authClient, fetchCustomerSession, type SignInInput, type SignUpInput } from "@/lib/auth";
import { STORAGE } from "@/lib/constants";
import type { AuthResult, CustomerProfile } from "@/types/account";

interface AccountState {
  /** True only while the visitor explores the demonstrative customer area. */
  demo: boolean;
  hydrated: boolean;
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
}

export const useAccount = create<AccountState>()(
  persist(
    (set, get) => ({
      demo: false,
      hydrated: false,
      customer: null,
      profile: demoProfile,
      startDemo: () => set({ demo: true, customer: null, profile: demoProfile }),
      endDemo: () => set({ demo: false, customer: null, profile: demoProfile }),
      loadSession: async () => {
        const account = await fetchCustomerSession();
        if (account) set({ customer: account, profile: account, demo: false });
      },
      signIn: async (input) => {
        const result = await authClient.signIn(input);
        if (result.ok && result.account) set({ customer: result.account, profile: result.account, demo: false });
        return result;
      },
      signUp: async (input) => {
        const result = await authClient.signUp(input);
        if (result.ok && result.account) set({ customer: result.account, profile: result.account, demo: false });
        return result;
      },
      signOut: async () => {
        await authClient.signOut();
        set({ customer: null, profile: demoProfile, demo: false });
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
