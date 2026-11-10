import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { categories, getCategory } from "@/data/categories";
import { Container } from "@/components/layout/Container";
import { PageIntro } from "@/components/layout/PageIntro";
import { Catalog } from "@/components/commerce/Catalog";
import { ProductGridSkeleton } from "@/components/ui/Skeleton";
export function generateStaticParams() {
  return categories.map((c) => ({ slug: c.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const c = getCategory((await params).slug);
  return {
    title: c?.name ?? "Categoria não encontrada",
    description: c?.description,
  };
}
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const category = getCategory((await params).slug);
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
