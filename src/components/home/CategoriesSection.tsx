import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { CategoryCard } from "@/components/commerce/CategoryCard";
import { Reveal } from "@/components/ui/Reveal";
import { categories } from "@/data/categories";
export function CategoriesSection() {
  return (
    <section id="categorias" className="section categories-section">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Encontre o seu"
            title="ESCOLHA SEU ESTILO"
            action={{ label: "Todas as categorias", href: "/categorias" }}
          />
          <div className="categories-row">
            {categories.map((category) => (
              <CategoryCard key={category.slug} category={category} />
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
