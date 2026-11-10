# Regras do projeto

- Preservar a identidade visual da Tobacco Hemp.
- Sempre usar o logo oficial em `public/brand/tobacco-hemp-logo.png`.
- Usar `public/references/home-reference.png` como principal referência visual.
- Não redesenhar o logo.
- Não adicionar folhas de cannabis como decoração.
- Manter o visual escuro, premium e minimalista.
- Reutilizar componentes e manter a arquitetura organizada.

## Implementação e verificações

- Catálogo desta etapa: apenas acessórios de uso geral, conforme escopo ajustado pelo usuário.
- Não inventar contatos, estoque real, políticas definitivas nem promessas comerciais. Manter demonstrações identificadas.
- Manter produtos e categorias em `src/data`, configurações em `src/lib/constants.ts` e tokens em `src/styles/tokens.css`.
- Preservar navegação por teclado, foco dos modais e preferência por movimento reduzido.
- Após mudanças: executar lint, typecheck, build e testes Playwright; revisar desktop e celular.
- Não ativar pagamentos, newsletter, autenticação ou envio de pedidos reais sem integração e configuração explícitas.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
