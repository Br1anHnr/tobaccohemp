# Dashboard conectado à Golden Image — desenvolvimento local

A interface administrativa existente usa `/api/admin/*` por um proxy server-only.
O proxy aceita somente as operações do contrato, limita o destino a HTTP loopback,
valida Origin nas mutações antes de traduzir a origem para o backend e encaminha
apenas o cookie administrativo. Não há CORS aberto, tokens no localStorage ou senha
do operador no bundle do dashboard. Fora de development/test, o proxy retorna 503.

Terminal no checkout **main da Golden Image**:

```powershell
npm.cmd ci
$env:GOLDEN_IMAGE_ADMIN_PASSWORD = 'synthetic-local-only-password'
npm.cmd run dev -- --hostname 127.0.0.1 --port 3101
```

Terminal neste worktree **feature-admin-dashboard-ui da Tobacco Hemp**:

```powershell
npm.cmd ci
# Opcional: padrão já é http://127.0.0.1:3101; só destinos locais são aceitos.
$env:GOLDEN_IMAGE_API_ORIGIN = 'http://127.0.0.1:3101'
npm.cmd run dev -- --port 3000
```

Abra http://127.0.0.1:3000/admin. Entre com `admin@example.test` e a senha sintética
do primeiro terminal. Sem backend/configuração, mostrar erro; nunca voltar aos mocks.
Se já houver servidor deste dashboard ativo em 3000, reutilize-o em vez de iniciar
outro. Alterar o destino por ambiente requer reiniciar apenas o servidor do dashboard.

Os componentes conservam o shell, marca, tabelas e responsividade. O adaptador
converte centavos para BRL, combina produto/estoque e converte status/data de clientes.
Categorias, telefone, cidade, gastos e pedidos não existem no contrato atual:
campos ausentes mostram “—”/“Não informado”, sem inventar métricas.
Cards usam clientes/produtos/unidades/valor de estoque; gráficos de receitas mostram
indisponibilidade explícita. Botões de estoque persistem via PATCH com confirmação
do servidor; falhas não alteram o valor exibido. Login, expiração/401 e logout usam
cookie HttpOnly/SameSite Strict. Não há checkout, pagamentos ou vendas nesta conexão;
as demonstrações da loja permanecem independentes, sem novas integrações comerciais.

## Verificar

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
$env:GOLDEN_IMAGE_BACKEND_DIR = 'C:/caminho/para/GoldenImage'
npm.cmd run test:integration
# Regressão visual/loja, em porta livre, contra o build local:
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:3220'
$env:CI = '1'
npm.cmd run test:e2e
```

Integração sobe dois servidores temporários em 3210/3211, sem reutilizar processos
existentes, usa senha/fixtures sintéticas e valida desktop/celular: login, rejeição
de origem, cookie, dados reais, estoque após reload, erro sem atualização otimista,
indisponibilidade sem mocks, logout e acessibilidade. As fixtures permanecem somente
no SQLite local ignorado da Golden Image, como nos testes do próprio backend.
O cache de teste do dashboard fica em `.next-integration` para não disputar o
servidor de desenvolvimento existente. A suíte visual usa fixtures HTTP explícitas,
separadas do teste com backend real. Capturas novas: `artifacts/admin-connected-*.png`.

Esta conexão não habilita produção. SQLite e sessões em memória seguem os limites
locais do backend. O contrato wire v1 foi copiado de
`GoldenImage/src/shared/contracts/admin.ts` para `src/types/golden-admin.ts`;
mudanças futuras de contrato precisam ser sincronizadas deliberadamente.

## Resultado desta conexão

- Lint, TypeScript e build aprovados, sem novas dependências ou mudança do lockfile.
- Dois testes de integração com backend real aprovados (desktop/celular), incluindo
  login/logout, cookie, origem, clientes, centavos, estoque após reload, falha de PATCH,
  indisponibilidade sem fallback, acessibilidade e largura da página.
- Regressão completa: 32 de 34 cenários passaram inicialmente; os dois casos de
  persistência do carrinho recarregavam antes de a navegação terminar. Foi adicionada
  somente uma espera pela URL `/carrinho` no teste, mantendo suas asserções. Os dois
  casos passaram na repetição dirigida, sem alterar o código de carrinho/checkout.
- Proxy desabilitado em produção verificado em desktop/celular pelo build local.
- Capturas desktop/celular inspecionadas; logo, shell, tabelas e estrutura preservados.
- Servidor de API iniciado no Orca em 127.0.0.1:3101; o servidor já existente do
  dashboard em 3000 foi preservado. Sessão de smoke invalidada após a verificação.
- Sem commits, merge, push, deploy, novos workers ou mudanças no MVP da branch main.
