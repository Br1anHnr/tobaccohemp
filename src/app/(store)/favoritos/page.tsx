import { Container } from "@/components/layout/Container";
import { PageIntro } from "@/components/layout/PageIntro";
import { Favorites } from "@/components/commerce/Favorites";
export const metadata = { title: "Favoritos" };
export default function Page() {
  return (
    <Container className="page-container">
      <PageIntro
        title="COM A SUA CARA"
        eyebrow="Seus favoritos"
        breadcrumbs={[{ label: "Favoritos" }]}
      />
      <Favorites />
    </Container>
  );
}
