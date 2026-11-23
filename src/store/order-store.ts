"use client";
import { create } from "zustand";
import type { DemoOrder } from "@/types/cart";
export const useOrder = create<{
  order: DemoOrder | null;
  setOrder: (order: DemoOrder | null) => void;
}>((set) => ({ order: null, setOrder: (order) => set({ order }) }));
