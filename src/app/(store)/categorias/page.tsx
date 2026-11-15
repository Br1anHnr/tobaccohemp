import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { PageIntro } from "@/components/layout/PageIntro";
import { CategoryCard } from "@/components/commerce/CategoryCard";
import { getStorefrontCategories } from "@/lib/storefront";
export const metadata: Metadata = { title: "Categorias" };
export const dynamic = "force-dynamic";
export default async function CategoriesPage() {
  const categories = await getStorefrontCategories();
  return (
    <Container className="page-container">
      <PageIntro
        title="ESCOLHA SEU ESTILO"
        text="Cada categoria, uma forma de acompanhar sua rotina."
        breadcrumbs={[{ label: "Categorias" }]}
      />
      <div className="category-index">
        {categories.map((c) => (
          <div key={c.slug}>
            <CategoryCard category={c} />
            <p>{c.description}</p>
          </div>
        ))}
      </div>
    </Container>
  );
}
