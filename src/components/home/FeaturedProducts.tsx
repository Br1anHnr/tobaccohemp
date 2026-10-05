import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ProductGrid } from "@/components/commerce/ProductGrid";
import { Reveal } from "@/components/ui/Reveal";
import { products } from "@/data/products";
export function FeaturedProducts() {
  return (
    <section className="section featured-section">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Nossa seleção"
            title="PRODUTOS EM DESTAQUE"
            action={{ label: "Ver todos os produtos", href: "/loja" }}
          />
          <ProductGrid products={products.filter((p) => p.isFeatured)} />
        </Reveal>
      </Container>
    </section>
  );
}
