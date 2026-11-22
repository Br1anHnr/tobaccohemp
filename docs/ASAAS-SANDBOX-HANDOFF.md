# Asaas Sandbox — entrega isolada

Base publicada: `18ae2b5`. Branch local: `sandbox/asaas-preview`. Não incorpora o P0 `41d6a5e`; não houve push, deploy, migration remota, acesso a credenciais compartilhadas, alteração de main, Preview existente, Docker, Neon/R2 existentes ou dados reais.

Implementação e testes: commit `d2331bc` (`feat(payments): add isolated Asaas Sandbox checkout and reconciliation`). Este relatório é entregue em commit documental separado.

## Contrato HTTP

| Método e rota | Contrato |
| --- | --- |
| `GET /api/checkout/asaas/config` | Apenas disponibilidade pública; não expõe credenciais ou IDs de cliente. |
| `POST /api/checkout/asaas` | Sessão de comprador + origem; JSON `{items:[{productId,quantity,variant?}],paymentMethod:"pix"\|"card",idempotencyKey}`. Preços e total vêm do catálogo no PostgreSQL. Retorna `{data:{order,attemptState,environment:"sandbox",pix?,warning?}}`. |
| `GET /api/checkout/asaas/{orderId}` | Sessão proprietária; `Origin` exato ou Fetch Metadata `same-origin`. Consulta e reconcilia o pedido; outro comprador recebe 404. |
| `POST /api/webhooks/asaas` | Segredo distinto no header `asaas-access-token`; sem cookies ou redirecionamento. Confirmação/duplicata/desconhecido respondem diretamente 200. Sem autenticação: 401; JSON/recurso inválido: 422; falha transitória: 5xx reenviável. |
| `GET /api/admin/asaas` | Sessão administrativa, papel operador ou admin; pedidos, estoque e histórico apenas Sandbox, sem receita real. |
| `POST /api/admin/asaas/reconcile` | Admin + origem; JSON `{orderId}`. Reconsulta o provedor sem criar cobrança. |

UI: `/checkout` continua demo por padrão. No ambiente habilitado há opt-in explícito Asaas Sandbox, Pix com imagem e Copia e Cola, cartão exclusivamente hospedado, consulta do pedido e histórico. Identificadores de tentativa/pedido permanecem em sessionStorage para recuperar uma resposta perdida, sem cartão ou dados pessoais. `/admin/asaas` é separado do painel demonstrativo e permite reconciliar cada pedido.

## Configuração pelo coordenador

Variáveis somente servidor, específicas da branch e do Neon isolado:

```dotenv
ASAAS_SANDBOX_ENABLED=1
ASAAS_SANDBOX_DATASET=synthetic
ASAAS_SANDBOX_API_KEY=<chave exclusiva Sandbox>
ASAAS_SANDBOX_WEBHOOK_TOKEN=<outro segredo aleatório com ao menos 32 caracteres>
ASAAS_SANDBOX_CUSTOMER_ID=<cus_ do cliente sintético com notificações desativadas>
ASAAS_SANDBOX_PRODUCT_IDS=case-01
DATABASE_URL=<Neon próprio, vazio, com role dedicada>
PREVIEW_BACKEND_ENABLED=1
APP_ORIGIN=https://<origem exata do novo Preview>
ADMIN_EMAIL=<conta administrativa de teste>
ADMIN_PASSWORD=<senha própria do teste>
```

O gate exige `VERCEL=1`, `VERCEL_ENV=preview` e `VERCEL_GIT_COMMIT_REF=sandbox/asaas-preview`. A antiga branch de homologação conserva sua autorização anterior de backend, mas não pode habilitar o Asaas. Produção é recusada mesmo com as flags Sandbox. Desenvolvimento/teste local exige as mesmas flags Sandbox. Não existem base URL configurável, host de checkout configurável ou flag de pagamento em produção.

A base é fixa em `https://api-sandbox.asaas.com/v3`. O link é construído apenas como `https://sandbox.asaas.com/checkoutSession/show?id=<id validado>`. O host oficial Sandbox e o caminho responderam HTTP 200 em verificação sem credenciais em 22/11/2026; não foi utilizado o host de produção exemplificado no guia genérico. Fetch usa `redirect:error`, timeout e erro sanitizado.

## Schema e seed

O runner existente `src/shared/server/migrate.ts:ensureSchema()` aplica as sete migrations publicadas e a nova `005_asaas_sandbox`, cria `asaas_sandbox_attempts` e `asaas_sandbox_events`, chama `seedCatalog()` e faz o bootstrap administrativo quando configurado. As migrations são transacionais e versionadas em `schema_migrations`. O worker não executou esse runner contra Neon remoto.

Após configurar o Neon **isolado** e iniciar/publicar a branch pelo coordenador, uma chamada à rota habilitada `GET /api/auth/session` executa esse bootstrap antes de resolver a sessão. A primeira chamada pública ao catálogo com banco configurado também pode inicializar o schema pelo fluxo já existente. Portanto configure e confira o destino do banco **antes** de iniciar a aplicação.

Seed: catálogo demonstrativo em `src/data/products.ts`/`src/data/categories.ts`, sem fabricar dados reais. Produto recomendado: `case-01`, Case Compact Preto, categoria `cases`, preço 4990 centavos, 12 unidades demonstrativas iniciais, variantes `Preto`/`Grafite`. O seed preserva estoque e edições existentes; as 12 unidades só se aplicam à base nova. Restrinja `ASAAS_SANDBOX_PRODUCT_IDS=case-01`. Outros IDs só funcionam se explicitamente configurados e elegíveis pela política de acessórios. `ASAAS_SANDBOX_DATASET=synthetic` é a declaração explícita de que esse banco contém somente testes.

## Confirmação, idempotência e estoque

- Criação reutiliza `domain/orders`, congelamento de preços, elegibilidade e reserva transacional com locks em ordem determinística. O escopo da idempotência inclui a conta; um payload diferente com a mesma chave retorna 409. `externalReference=th-sbx-<UUID do pedido>` é único no banco.
- A tentativa `prepared → creating` é persistida e commitada antes do POST ao Asaas. Timeout, falha ou queda nunca tornam a tentativa automaticamente reenviável. Consultas e reenvio do mesmo pedido não repetem o POST.
- Reconciliação usa `GET /payments?externalReference=...`, também `checkoutSession` quando conhecido, e `GET /payments/{id}`. Mais de uma cobrança ou paginação incompleta bloqueiam a conciliação automática. Associação, método, valor integral em centavos, referência e moeda são validados. A API Asaas trabalha com BRL e não exige um campo currency; se o provedor devolver um campo diferente de BRL, a resposta é rejeitada. Pix também confere o cliente sintético configurado; cartão confere a sessão do checkout.
- Apenas `CONFIRMED`/`RECEIVED` confirmados pelo GET do provedor marcam pago. Nenhuma URL de retorno, `CHECKOUT_PAID` isolado ou dado de valor/status no payload do webhook confirma pagamento. Nenhum payload completo, dado de cartão, resposta sensível ou segredo é persistido.
- Eventos e alterações de pedido/estoque são commitados juntos. Duplicatas usam `event_id` como chave única; falha temporária desfaz a inserção para permitir reentrega. Divergências ficam em `review` e são reconhecidas sem alterar status/estoque. O dashboard e uma nova consulta permitem reavaliar a tentativa.
- Pedido com reserva já deduzida passa a `committed` sem segunda baixa. Cancelamento/expiração de sessão conhecida devolve a reserva uma única vez. Pagamento tardio readquire estoque liberado em transação; se faltar estoque, o pedido fica em revisão, sem estoque negativo ou atualização parcial. Após reposição, reconciliação pode confirmar o pedido.
- Estorno completo confirmado retorna estoque uma vez; eventos antigos não reabrem pedido estornado. Estorno parcial, estorno em processamento e chargeback ficam em revisão, sem devolução automática de itens. Transições manuais do painel demo são bloqueadas para Asaas. O sweep de expiração demo ignora Asaas.
- O painel de pedidos demo filtra os pedidos Sandbox, e o painel Sandbox consulta exclusivamente sua associação. Os valores são testes sem receita real.
- No schema legado, os pedidos Asaas têm `payment_provider='asaas'` e `is_demo=false`, distinguindo-os do simulador local; seu ambiente é identificado pela associação obrigatória em `asaas_sandbox_attempts`. Não interprete `is_demo=false` isoladamente como receita real.

## Eventos exatos

Cadastrar no Asaas apenas os eventos atendidos:

```text
PAYMENT_CREATED
PAYMENT_UPDATED
PAYMENT_CONFIRMED
PAYMENT_RECEIVED
PAYMENT_OVERDUE
PAYMENT_DELETED
PAYMENT_RESTORED
PAYMENT_REFUNDED
PAYMENT_PARTIALLY_REFUNDED
PAYMENT_REFUND_IN_PROGRESS
PAYMENT_REFUND_DENIED
PAYMENT_CHARGEBACK_REQUESTED
PAYMENT_CHARGEBACK_DISPUTE
PAYMENT_AWAITING_CHARGEBACK_REVERSAL
CHECKOUT_CREATED
CHECKOUT_PAID
CHECKOUT_CANCELED
CHECKOUT_EXPIRED
```

Eventos da lista disparam conciliação; os estados financeiros efetivos vêm do GET da cobrança. Cancelamento/expiração de checkout são eventos de jornada autenticados para sessão já associada. Eventos futuros ou de recursos não associados são reconhecidos com 200 e registrados sem tocar pedidos alheios ou demo.

## Limites que exigem homologação externa

1. O worker não recebeu chave Asaas real e **não homologou chamadas financeiras ao Asaas real**, nem webhook público. O transporte dos testes de backend é simulado por injeção de fetch, mantendo o destino fixo; não há switch de mock no produto.
2. Não há GET de checkout publicado na referência oficial consultada. O adaptador não o utiliza. Um checkout cuja criação perdeu a resposta pode recuperar o ID de um evento autenticado que contenha `externalReference`, ou de uma cobrança consultável. Se não houver nenhum deles, permanece `uncertain` e exige conferência manual no painel Asaas, sem novo POST automático.
3. Quando o cartão não herda `externalReference` na cobrança, a referência validada é `checkoutSession` retornada pelo GET, que deve coincidir com a sessão já associada ao pedido. Se o provedor também informar externalReference, ela precisa coincidir. Uma sessão desconhecida sem referência não pode ser associada automaticamente. Confirmar esses campos na homologação real continua necessário.
4. Pix depende de chave Pix Sandbox ativa e das condições da conta. Ausência/falha em `/pixQrCode` mantém o pedido/tentativa recuperáveis, exibe indisponibilidade e permite reconsultar, sem criar outra cobrança.
5. Vercel Deployment Protection precisa permitir que o Asaas alcance **diretamente** o POST `/api/webhooks/asaas`, preservando a exigência de `asaas-access-token`. O coordenador cuida desse acesso, registro do webhook, login e provisionamento Neon/Vercel. Não foi criada autenticação alternativa nem bypass em código.
6. A reconciliação é sob demanda por comprador/admin e por webhook; nenhum cron remoto foi instalado. Revisão de chargeback/estorno parcial não decide automaticamente devolução física de mercadoria.

## Validação local

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:asaas-sandbox
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3235'
node node_modules/@playwright/test/cli.js test
```

`test:asaas-sandbox` inicia PostgreSQL 18 descartável via `embedded-postgres`, bind exclusivo em loopback e porta livre, sem Docker. Sobrescreve DATABASE_URL e todos os segredos Asaas no processo de testes; não carrega .env nem usa Neon real. O banco é encerrado e descartado ao final. Os testes invocam os handlers HTTP in-process e a camada de aplicação contra PostgreSQL real; o transporte Asaas é simulado. A suíte regular cobre navegador desktop/mobile; seus cenários Sandbox usam fixtures HTTP interceptadas no browser.

Evidências visuais locais: `.preview-validation/asaas-pix-{desktop,mobile}.png` e `.preview-validation/asaas-card-{desktop,mobile}.png`. O QR da fixture de UI é uma imagem sintética de 1 pixel ampliada, não um QR Asaas real. Verificação de layout, teclado, acessibilidade e ausência de overflow usa essas fixtures.

Resultados: lint, typecheck e build aprovados; 16 cenários de backend aprovados com PostgreSQL descartável, incluindo upgrade do schema `18ae2b5`, concorrência de criação, associação/autenticação, cobrança ambígua, QR indisponível, webhook duplicado/transitório, divergências, estorno, chargeback e pagamento tardio. A suíte completa de navegador passou 74 testes, incluindo os seis cenários específicos de UI Sandbox (Pix/cartão/dashboard em desktop/mobile). A revisão visual também inclui `.preview-validation/asaas-dashboard-{desktop,mobile}.png`. Os resultados do backend ficam em diretório separado para evitar conflito com os traces da suíte de navegador; o PostgreSQL é encerrado via pg_ctl e não deixa workers em execução.

## Fontes oficiais consultadas

- [Sandbox](https://docs.asaas.com/docs/sandbox)
- [Criar cobrança](https://docs.asaas.com/reference/create-new-payment)
- [QR dinâmico Pix](https://docs.asaas.com/reference/get-qr-code-for-pix-payments)
- [Criar checkout](https://docs.asaas.com/reference/create-new-checkout)
- [Cartão hospedado](https://docs.asaas.com/docs/checkout-for-credit-card)
- [Link de checkout e callbacks](https://docs.asaas.com/docs/checkout-link-and-customer-redirection)
- [Listar cobranças e filtros](https://docs.asaas.com/reference/list-payments)
- [Consultar cobrança individual](https://docs.asaas.com/reference/retrieve-a-single-payment)
- [Eventos de checkout e header de autenticação](https://docs.asaas.com/docs/eventos-para-checkout)
- [Eventos de cobrança](https://docs.asaas.com/docs/webhook-para-cobrancas)
