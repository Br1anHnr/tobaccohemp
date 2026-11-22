import type { Metadata } from "next";
import { ProductsTable } from "@/components/admin/ProductsTable";

export const metadata: Metadata = {
  title: "Produtos & estoque",
};

export default function AdminProductsPage() {
  return (
    <>
      <div className="admin-page-head">
        <p className="eyebrow">Gestão</p>
        <h1>
          Produtos &amp; estoque<span className="accent-dot">.</span>
        </h1>
        <p>
          Cadastre e edite produtos reais com fotos no Cloudflare R2, variações,
          tags e estoque.
        </p>
      </div>
      <ProductsTable />
    </>
  );
}
