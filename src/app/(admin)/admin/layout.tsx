import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import "@/styles/admin.css";

export const metadata: Metadata = {
  title: "Painel administrativo",
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AdminShell>{children}</AdminShell>;
}
