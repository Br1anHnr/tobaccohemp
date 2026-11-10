"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { demoProfile } from "@/data/account-demo";
import { STORAGE } from "@/lib/constants";
import type { CustomerProfile } from "@/types/account";

interface AccountState {
  /** True only while the visitor explores the demonstrative customer area. */
  demo: boolean;
  hydrated: boolean;
  /** Fictitious profile kept in memory only (never persisted). */
  profile: CustomerProfile;
  startDemo: () => void;
  endDemo: () => void;
  updateProfile: (profile: CustomerProfile) => void;
}

export const useAccount = create<AccountState>()(
  persist(
    (set) => ({
      demo: false,
      hydrated: false,
      profile: demoProfile,
      startDemo: () => set({ demo: true, profile: demoProfile }),
      endDemo: () => set({ demo: false, profile: demoProfile }),
      updateProfile: (profile) => set({ profile }),
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
      // Only the demo flag is persisted — no profile, e-mail or password.
      partialize: (state) => ({ demo: state.demo }),
      merge: (persisted, current) => ({
        ...current,
        demo: (persisted as { demo?: unknown } | undefined)?.demo === true,
      }),
    },
  ),
);
