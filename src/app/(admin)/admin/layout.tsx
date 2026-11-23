import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminSandboxEnabled, sandboxEnabled } from "@/modules/orders/infrastructure/asaas-client";
import "@/styles/admin.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Painel administrativo",
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AdminShell sandboxEnabled={sandboxEnabled() || adminSandboxEnabled()}>{children}</AdminShell>;
}
