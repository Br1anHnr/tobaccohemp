# Tobacco Hemp — MVP

E-commerce demonstrativo de acessórios de uso geral. Identidade oficial preservada, interface escura, fotografia quente e navegação em português. Não inclui produtos de tabaco, nicotina ou cannabis.

## Executar

Requer Node.js 20.9 ou superior. Validado com Node.js 24.

```sh
npm ci
npm run dev
```

Abra http://127.0.0.1:3000. Para produção local: `npm run build` e `npm run start`.

## Verificar

```sh
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

Os testes usam uma versão já compilada; execute o build antes deles. A suíte cobre desktop e celular, rotas, imagens, busca com teclado, filtros, favoritos, variantes, estoque demonstrativo, persistência, verificação 18+, validação e confirmação de pedido, além de verificações automatizadas de acessibilidade com axe. Capturas da home ficam em `artifacts/`.

Para capturas de revisão das páginas de produto e checkout, com o servidor local ativo: `node scripts/visual-review.mjs`.

## Organização

- `src/app`: rotas App Router, metadados e estados de erro.
- `src/components`: componentes compartilhados, layout, commerce, home, busca e idade.
- `src/data`: catálogo e categorias tipados, dados editáveis sem alterar as telas.
- `src/store`: estado de carrinho, favoritos e pedido demonstrativo.
- `src/lib`: moeda, validação, configuração e animações.
- `src/styles/tokens.css`: cores e medidas centrais.
- `public/brand` e `public/references`: arquivos oficiais preservados.
- `public/products`: imagens locais otimizadas em WebP.
- `docs`: marca, sitemap, decisões de interface e origem das imagens.

## Limites desta versão

Não existe backend, login real, pagamento, cálculo de frete, envio de e-mail, cadastro de newsletter nem processamento real de pedido. Checkout e estoque são demonstrações; dados pessoais não são persistidos. O recibo guarda apenas identificador aleatório, contagem, total e data na sessão do navegador. Carrinho e favoritos usam armazenamento local; com armazenamento bloqueado continuam funcionando em memória, sem garantia após recarregar.

Fotos, preços, coleções e estoque são ilustrativos, não um inventário oficial. Alguns itens reutilizam fotografias e variações não mudam a imagem. Substitua por dados comerciais confirmados antes de publicar. Configure endereço, horários e canais em `src/lib/constants.ts`: contatos ausentes são mostrados como pendentes, sem inventar dados. Páginas de ajuda são avisos de demonstração, não políticas jurídicas definitivas.

O projeto não foi publicado. Metadados usam `noindex` enquanto for demo. Não use validação de idade no navegador como verificação jurídica de identidade.

No ambiente verificado, `npm audit --omit=dev` não apontou vulnerabilidades de produção. O audit completo apontou cinco alertas altos na cadeia de desenvolvimento do ESLint Next (`braces`/`micromatch`/`fast-glob`), sem correção compatível oferecida. Não foi aplicado downgrade forçado; reavalie antes da publicação.
