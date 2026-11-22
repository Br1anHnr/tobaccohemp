"use client";

import { create } from "zustand";
import type { Product } from "@/types/product";
import type { Category } from "@/types/category";

interface CatalogState {
  products: Product[];
  categories: Category[];
  hydrated: boolean;
  setCatalog: (products: Product[], categories: Category[]) => void;
}

export const useCatalog = create<CatalogState>()(set => ({
  products: [],
  categories: [],
  hydrated: false,
  setCatalog: (products, categories) => set({ products, categories, hydrated: true }),
}));

export const findProduct = (id: string): Product | undefined =>
  useCatalog.getState().products.find(product => product.id === id);

export const getProduct = (slug: string): Product | undefined =>
  useCatalog.getState().products.find(product => product.slug === slug);

export const getCategory = (slug: string): Category | undefined =>
  useCatalog.getState().categories.find(category => category.slug === slug);
