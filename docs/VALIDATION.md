# Verificação do MVP

Verificado localmente em outubro de 2026, Node.js 24.19.0, Chromium Playwright.

- Build de produção: aprovado; 30 unidades de páginas geradas pelo Next, incluindo rotas internas.
- TypeScript estrito: aprovado.
- ESLint: aprovado, sem warnings.
- Playwright: 22 testes aprovados, onze cenários em desktop e celular.
- Axe: nenhum problema encontrado nas regras WCAG 2 A/AA e 2.1 AA executadas sobre age gate, home, busca e checkout. Isso não substitui auditoria manual completa.
- Fluxos: busca por acentos/teclado, filtros/ordenação/categorias, favoritos persistentes, variantes, quantidade mínima e máxima, remoção, validação, recibo após reload e carrinho limpo.
- Modais: foco contido, retorno ao acionador, Escape e clique externo; age gate permanece bloqueante até a decisão.
- Cabeçalho: logo oficial inteiramente dentro do recorte CSS, inclusive após rolagem, e menu desktop ampliado de 10 para 12 px; verificado em 390, 1024 e 1440 px.
- Layout: verificações de overflow em 320, 375, 390, 768, 1024, 1440 e 1920 px; imagens locais decodificadas e nenhuma exceção inesperada nas rotas testadas.
- Resiliência: armazenamento corrompido e bloqueado, preferência por movimento reduzido, rotas inválidas e páginas vazias.
- Revisão visual: home desktop/mobile, produto desktop e checkout mobile, com capturas em `artifacts/`.
- `npm audit --omit=dev`: zero vulnerabilidades. Alertas da cadeia ESLint de desenvolvimento estão documentados no README.

Não verificados: pagamento e pedidos reais (inexistentes), dispositivos físicos, Safari/WebKit, backend, publicação externa e políticas jurídicas definitivas.
