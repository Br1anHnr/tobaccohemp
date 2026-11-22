import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorefrontCategories } from "@/lib/storefront";
import { Container } from "@/components/layout/Container";
import { PageIntro } from "@/components/layout/PageIntro";
import { Catalog } from "@/components/commerce/Catalog";
import { ProductGridSkeleton } from "@/components/ui/Skeleton";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const slug = (await params).slug;
  const category = (await getStorefrontCategories()).find((c) => c.slug === slug);
  return {
    title: category?.name ?? "Categoria não encontrada",
    description: category?.description,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const slug = (await params).slug;
  const category = (await getStorefrontCategories()).find((c) => c.slug === slug);
  if (!category) notFound();
  return (
    <Container className="page-container">
      <PageIntro
        title={category.name.toUpperCase()}
        text={category.description}
        breadcrumbs={[
          { label: "Loja", href: "/loja" },
          { label: category.name },
        ]}
      />
      <Suspense fallback={<ProductGridSkeleton label="Carregando categoria…" />}>
        <Catalog categorySlug={category.slug} />
      </Suspense>
    </Container>
  );
}
