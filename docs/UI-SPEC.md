# Tobacco Hemp — UI Specification

## Referência principal

Usar `public/references/home-reference.png` como principal referência visual.

## Princípios iniciais

- Visual escuro, premium e minimalista.
- Componentes reutilizáveis.
- Arquitetura organizada.
- Consistência visual entre páginas e componentes.

## Composição e responsividade

Header fixo ao rolar, logo oficial, navegação, busca e badge do carrinho. Hero fotográfico com texto à esquerda, categorias em cinco colunas e destaques em quatro colunas. No celular: menu em drawer, hero vertical, categorias em carrossel nativo com scroll-snap e produtos em duas colunas. Em telas menores que 360 px, produtos usam uma coluna. Checkout e detalhes passam de duas colunas para uma. Sem carrossel automático.

## Componentes e acessibilidade

Modal Radix com título e descrição, focus trap, Escape, fechamento externo e devolução do foco ao acionador. Age gate é não dispensável. Busca normaliza acentos, oferece estado vazio, teclado com setas/Enter e atalho `/`. Campos possuem labels; erros do checkout têm resumo focável e mensagens associadas. Há skip link, foco visível, HTML semântico e controles com nomes acessíveis.

Motion controla entrada do hero, revelação ao rolar e abertura dos drawers. Hover e feedback são curtos. `prefers-reduced-motion` é respeitado. Imagens usam Next Image, dimensões estáveis, loading lazy fora do hero, arquivos locais WebP e hero prioritário. Fontes servidas pelo build com next/font.

Carrinho persiste somente IDs, variantes e quantidades; favoritos persistem IDs. A hidratação é controlada para não divergir do servidor. Dados corrompidos são descartados, variantes inválidas não entram, quantidades são limitadas ao estoque agregado por produto. Não há garantia comercial de estoque: dados locais são demonstrativos.

## Uso crítico das skills

Aplicadas `ui-ux-pro-max` e `ui-styling` como apoio para acessibilidade, componentes reutilizáveis, consistência, responsividade e divisão server/client. Rejeitados a paleta verde genérica sugerida automaticamente, um dashboard como composição, excesso de arredondamento, gradientes em grandes áreas e efeitos que destoassem da referência. A marca e a referência oficial têm prioridade sobre recomendações genéricas.

Shadcn não foi instalado por completo: Radix Dialog resolve os modais acessíveis; componentes pequenos próprios preservam a identidade e evitam uma camada desnecessária. Zustand cuida do estado local. Dados estáticos tipados evitam backend e integrações não solicitadas nesta etapa.

## Antes de publicar

Confirmar produtos, imagens, preço, estoque, contatos e políticas; conectar catálogo e pedidos ao backend; integrar pagamento e frete; rever segurança, privacidade e acessibilidade manual. A newsletter informa que é demo. A conta não simula autenticação. Nenhum dado real de cliente é solicitado para operação comercial nesta versão.
