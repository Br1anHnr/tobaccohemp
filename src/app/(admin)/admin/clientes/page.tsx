import type { Metadata } from "next";
import { CustomersTable } from "@/components/admin/CustomersTable";

export const metadata: Metadata = {
  title: "Clientes",
};

export default function AdminClientsPage() {
  return (
    <>
      <div className="admin-page-head">
        <p className="eyebrow">Gestão</p>
        <h1>
          Clientes<span className="accent-dot">.</span>
        </h1>
        <p>
          Pesquise e filtre a base de clientes. Os cadastros exibidos são
          fictícios e não representam clientes reais.
        </p>
      </div>
      <CustomersTable />
    </>
  );
}
