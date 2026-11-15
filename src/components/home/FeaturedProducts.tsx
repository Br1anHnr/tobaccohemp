import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ProductGrid } from "@/components/commerce/ProductGrid";
import { Reveal } from "@/components/ui/Reveal";
import { getStorefrontProducts } from "@/lib/storefront";
export async function FeaturedProducts() {
  const products = await getStorefrontProducts();
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
