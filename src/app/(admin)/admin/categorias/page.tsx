import type { Metadata } from "next";
import { CategoriesTable } from "@/components/admin/CategoriesTable";

export const metadata: Metadata = {
  title: "Categorias",
};

export default function AdminCategoriesPage() {
  return (
    <>
      <div className="admin-page-head">
        <p className="eyebrow">Gestão</p>
        <h1>
          Categorias<span className="accent-dot">.</span>
        </h1>
        <p>
          Organize o catálogo em categorias. Categorias vazias ficam ocultas da
          vitrine e podem ser removidas com segurança.
        </p>
      </div>
      <CategoriesTable />
    </>
  );
}
