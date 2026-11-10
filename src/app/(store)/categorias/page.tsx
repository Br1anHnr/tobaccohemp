import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { PageIntro } from "@/components/layout/PageIntro";
import { CategoryCard } from "@/components/commerce/CategoryCard";
import { categories } from "@/data/categories";
export const metadata: Metadata = { title: "Categorias" };
export default function CategoriesPage() {
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
