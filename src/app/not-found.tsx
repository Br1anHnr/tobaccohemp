import { Container } from "@/components/layout/Container";
import { EmptyState } from "@/components/ui/EmptyState";
export default function NotFound() {
  return (
    <Container className="page-container">
      <EmptyState
        title="Este caminho não está na seleção."
        text="A página que você procura não foi encontrada. Explore os acessórios disponíveis na loja."
      />
    </Container>
  );
}
