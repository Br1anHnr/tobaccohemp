import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { PageIntro } from "@/components/layout/PageIntro";
import { ButtonLink } from "@/components/ui/Button";
const pages: Record<string, { title: string; text: string }> = {
  trocas: {
    title: "Trocas e devoluções",
    text: "A política comercial será disponibilizada pela loja antes do lançamento. Este MVP não recebe pedidos reais. Para informações sobre compras já realizadas, consulte o atendimento da Tobacco Hemp.",
  },
  pagamentos: {
    title: "Formas de pagamento",
    text: "Este checkout é uma demonstração e não realiza cobranças. As formas de pagamento serão definidas pela loja e apresentadas quando a integração real estiver disponível.",
  },
  privacidade: {
    title: "Privacidade nesta demonstração",
    text: "O carrinho, os favoritos e a confirmação de idade são salvos localmente no navegador. A confirmação do pedido é mantida apenas nesta sessão. Os dados do formulário não são enviados ou armazenados. O cadastro de novidades é demonstrativo. Você pode limpar os dados deste site nas configurações do navegador. A política definitiva será publicada antes do lançamento.",
  },
  termos: {
    title: "Termos da demonstração",
    text: "Esta versão apresenta uma experiência de compra demonstrativa. Produtos, preços, estoques e imagens são ilustrativos. Não há pagamento, envio de pedido à loja ou compromisso de entrega. As condições comerciais reais serão disponibilizadas antes do lançamento.",
  },
};
export function generateStaticParams() {
  return Object.keys(pages).map((slug) => ({ slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return { title: pages[(await params).slug]?.title ?? "Ajuda" };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const page = pages[(await params).slug];
  if (!page) notFound();
  return (
    <Container className="page-container">
      <PageIntro
        title={page.title.toUpperCase()}
        breadcrumbs={[{ label: page.title }]}
      />
      <div className="help-content">
        <p>{page.text}</p>
        <ButtonLink href="/contato" variant="secondary">
          Falar com a loja
        </ButtonLink>
      </div>
    </Container>
  );
}
