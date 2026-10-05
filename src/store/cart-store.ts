"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { findProduct } from "@/data/products";
import { STORAGE } from "@/lib/constants";
import { itemKey } from "@/lib/utils";
import type { CartItem } from "@/types/cart";

interface CartState {
  items: CartItem[];
  favorites: string[];
  overlay: "cart" | "search" | "menu" | "account" | null;
  hydrated: boolean;
  storageError: boolean;
  setOverlay: (overlay: CartState["overlay"]) => void;
  add: (id: string, quantity?: number, variant?: string) => void;
  quantity: (id: string, variant: string | undefined, quantity: number) => void;
  remove: (id: string, variant?: string) => void;
  clear: () => void;
  toggleFavorite: (id: string) => void;
}
export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      favorites: [],
      overlay: null,
      hydrated: false,
      storageError: false,
      setOverlay: (overlay) => set({ overlay }),
      add: (id, quantity = 1, variant) => {
        const product = findProduct(id);
        if (
          !product ||
          product.stock < 1 ||
          (variant && !product.variants?.includes(variant))
        )
          return;
        const count = Number.isFinite(quantity)
          ? Math.max(1, Math.floor(quantity))
          : 1;
        set((state) => {
          const existing = state.items.find(
            (item) =>
              itemKey(item.productId, item.variant) === itemKey(id, variant),
          );
          const otherCount = state.items
            .filter((item) => item.productId === id && item !== existing)
            .reduce((sum, item) => sum + item.quantity, 0);
          const available = Math.max(0, product.stock - otherCount);
          if (!available) return { overlay: "cart" };
          return {
            overlay: "cart",
            items: existing
              ? state.items.map((item) =>
                  item === existing
                    ? {
                        ...item,
                        quantity: Math.min(available, item.quantity + count),
                      }
                    : item,
                )
              : [
                  ...state.items,
                  {
                    productId: id,
                    quantity: Math.min(available, count),
                    variant,
                  },
                ],
          };
        });
      },
      quantity: (id, variant, quantity) =>
        set((state) => {
          const product = findProduct(id);
          if (!product || !Number.isFinite(quantity)) return state;
          const otherCount = state.items
            .filter(
              (item) =>
                item.productId === id &&
                itemKey(id, item.variant) !== itemKey(id, variant),
            )
            .reduce((sum, item) => sum + item.quantity, 0);
          return {
            items: state.items.map((item) =>
              itemKey(item.productId, item.variant) === itemKey(id, variant)
                ? {
                    ...item,
                    quantity: Math.min(
                      Math.max(1, Math.floor(quantity)),
                      product.stock - otherCount,
                    ),
                  }
                : item,
            ),
          };
        }),
      remove: (id, variant) =>
        set((state) => ({
          items: state.items.filter(
            (item) =>
              itemKey(item.productId, item.variant) !== itemKey(id, variant),
          ),
        })),
      clear: () => set({ items: [], overlay: null }),
      toggleFavorite: (id) =>
        set((state) => ({
          favorites: state.favorites.includes(id)
            ? state.favorites.filter((value) => value !== id)
            : [...state.favorites, id],
        })),
    }),
    {
      name: STORAGE.cart,
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          try {
            return localStorage.getItem(name);
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, value);
          } catch {
            if (!useCart.getState().storageError)
              useCart.setState({ storageError: true });
          }
        },
        removeItem: (name) => {
          try {
            localStorage.removeItem(name);
          } catch {
            /* Memory state remains usable. */
          }
        },
      })),
      skipHydration: true,
      partialize: (state) => ({
        items: state.items,
        favorites: state.favorites,
      }),
      merge: (persisted, current) => {
        const data = persisted as Partial<CartState> | undefined;
        const totals: Record<string, number> = {};
        const keys = new Set<string>();
        const items = (Array.isArray(data?.items) ? data.items : []).flatMap(
          (item): CartItem[] => {
            if (
              !item ||
              typeof item.productId !== "string" ||
              !Number.isInteger(item.quantity) ||
              item.quantity < 1
            )
              return [];
            const product = findProduct(item.productId);
            const key = itemKey(item.productId, item.variant);
            if (
              !product ||
              (item.variant && !product.variants?.includes(item.variant)) ||
              keys.has(key)
            )
              return [];
            const quantity = Math.min(
              item.quantity,
              product.stock - (totals[product.id] ?? 0),
            );
            if (quantity <= 0) return [];
            totals[product.id] = (totals[product.id] ?? 0) + quantity;
            keys.add(key);
            return [{ productId: product.id, variant: item.variant, quantity }];
          },
        );
        return {
          ...current,
          items,
          favorites: Array.isArray(data?.favorites)
            ? data.favorites.filter(
                (id) => typeof id === "string" && findProduct(id),
              )
            : [],
        };
      },
    },
  ),
);
export const cartTotal = (items: CartItem[]) =>
  items.reduce(
    (sum, item) =>
      sum + (findProduct(item.productId)?.price ?? 0) * item.quantity,
    0,
  );
export const cartCount = (items: CartItem[]) =>
  items.reduce((sum, item) => sum + item.quantity, 0);
