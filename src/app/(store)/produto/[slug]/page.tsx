import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getStorefrontProducts } from "@/lib/storefront";
import { Container } from "@/components/layout/Container";
import { ProductDetails } from "@/components/commerce/ProductDetails";
import { ProductGrid } from "@/components/commerce/ProductGrid";
import { SectionHeading } from "@/components/ui/SectionHeading";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const slug = (await params).slug;
  const products = await getStorefrontProducts();
  const product = products.find((p) => p.slug === slug);
  return {
    title: product?.name ?? "Produto não encontrado",
    description: product?.description,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const slug = (await params).slug;
  const products = await getStorefrontProducts();
  const product = products.find((p) => p.slug === slug);
  if (!product) notFound();
  const related = products
    .filter((p) => p.id !== product.id)
    .sort(
      (a, b) =>
        Number(b.categorySlug === product.categorySlug) -
        Number(a.categorySlug === product.categorySlug),
    )
    .slice(0, 4);
  return (
    <Container className="page-container">
      <nav className="product-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Início</Link>
        <span>/</span>
        <Link href="/loja">Loja</Link>
        <span>/</span>
        <Link href={`/categoria/${product.categorySlug}`}>
          {product.category}
        </Link>
        <span>/</span>
        <span aria-current="page">{product.name}</span>
      </nav>
      <ProductDetails product={product} />
      <section className="related-section">
        <SectionHeading
          eyebrow="Vai bem com você"
          title="COMPLETE SUA SELEÇÃO"
        />
        <ProductGrid products={related} />
      </section>
    </Container>
  );
}
