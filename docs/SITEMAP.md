# Tobacco Hemp — Sitemap

## Navegação implementada

- `/`: hero, categorias, destaques, kits, benefícios e rodapé.
- `/loja`: catálogo completo; filtros na URL `categoria`, `marca`, `preco`, `novidades`, `ordem`.
- `/categorias`: índice das cinco categorias.
- `/categoria/[slug]`: cases, shoulder-bags, bandejas, organizadores, kits.
- `/produto/[slug]`: dez produtos demonstrativos; galeria, variantes, quantidade e relacionados.
- `/favoritos`: seleção persistente no navegador.
- `/carrinho`: revisão, quantidades, remoção e subtotal.
- `/checkout`: dados fictícios, validação acessível e confirmação explícita de demonstração.
- `/pedido-confirmado`: recibo de sessão sem dados pessoais; estado vazio sem pedido.
- `/sobre`: apresentação da marca.
- `/contato`: canais configuráveis, sem inventar endereço ou telefone.
- `/ajuda/trocas`, `/ajuda/pagamentos`, `/ajuda/privacidade`, `/ajuda/termos`: avisos da versão demonstrativa.
- Rotas inválidas: tela 404 e caminho de retorno à loja.

Busca, carrinho rápido, conta demonstrativa e menu mobile usam modais/drawers. A verificação 18+ é persistida localmente e não permite continuar por Escape ou clique externo. Não há rota de login fictício nem formulários de pagamento reais.
