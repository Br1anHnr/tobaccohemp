# PRD — Tobacco Hemp

**Versão:** 1.7 — Homologação funcional E2E integrada (checkout + auth + admin + estoque/pedidos em ambiente local isolado)  
**Data:** 21/11/2026  
**Status:** homologado localmente em PostgreSQL e storage isolados; Neon real, R2 real, e-mail externo, checkout comercial e pagamentos permanecem pendentes  
**Base:** plano técnico de 09/11/2026, PRD v1.0–v1.6 e homologação funcional E2E da branch `homologacao/funcional-e2e` (21/11/2026).

## 1. Visão e premissas confirmadas pelo negócio

Construir uma plataforma digital independente para a **Tobacco Hemp**, com vitrine, experiência mobile, contas de clientes, gestão de catálogo e estoque, painel administrativo, atendimento por WhatsApp e uma arquitetura preparada para pedidos e meios de pagamento compatíveis com os produtos e canais autorizados.

**Decisões e fatos informados pelo responsável pelo projeto (não são hipóteses):**

- A Tobacco Hemp **não comercializa cigarros eletrônicos**. Não cadastrar produtos dessa categoria por pressuposição ou usar essa categoria como justificativa para alterar o escopo.
- O WhatsApp **já é um canal de atendimento e informações gerais**. Não tratar sua implantação básica como trabalho pendente.
- A integração preferida de mensageria é a **Evolution API**, ferramenta com a qual a equipe já possui experiência.
- O cliente **já utiliza uma maquininha PagBank**; investigar primeiro a conta existente e suas possibilidades de contratação/API, sem presumir que a maquininha habilite automaticamente checkout online ou sincronização de vendas.
- **Asaas permanece alternativa real** para avaliação. A escolha do gateway não está fechada.
- O cliente deverá poder escolher **checkout no site** ou, quando permitido, **continuar pelo WhatsApp e receber um link de pagamento/Pix**. WhatsApp não será o único caminho nem deve obrigar o comprador a trocar de canal.
- No painel, o administrador precisa **cadastrar, listar, editar e remover/desativar produtos**, incluindo **nome, preço e imagens**. Alterações aprovadas devem refletir no catálogo público, sem precisar editar código.
- Preservar a marca, o frontend atual e a separação entre Tobacco Hemp, Golden Image e RealMercado.

**Critério de produto:** facilitar a operação para o cliente final e para o lojista; manter integrações substituíveis, sem acoplamento ao gateway ou ao provedor de WhatsApp.

## 2. Como ler o andamento

- `[x]` **Entregue e testado localmente** conforme relatório disponível. Não equivale a deploy ou homologação em produção.
- `[-]` **Em execução ou concluído em branch independente**, ainda sem integração final.
- `[~]` **Parcial:** há infraestrutura ou telas, mas não todo o fluxo requerido.
- `[ ]` **Pendente:** ainda não implementado/verificado.
- `[?]` **Decisão externa pendente:** produto concebido, mas depende de contrato, elegibilidade por categoria/canal, regras de operação ou confirmação do provedor.

| ID | Funcionalidade | Estado | Evidência e próximo passo |
|---|---|---|---|
| TH-01 | Home, catálogo, categorias, produto, carrinho e favoritos demonstrativos | [x] | MVP e testes de navegação existentes; pedidos não são reais |
| TH-02 | Identidade visual Tobacco Hemp e experiência mobile | [x] | Base existente; refinamentos adicionais no TH-03 |
| TH-03 | Melhorias de busca, filtros, navegação mobile, imagens e acessibilidade | [x] | `feature/storefront-polish` (`571aa48`) integrado em `feature/integracao-v2`; validado por lint, typecheck, build e 50/50 E2E (desktop+mobile) |
| TH-04 | Banco PostgreSQL, migrations e seed do catálogo | [x] | 7 migrations (`001_init` a `004_orders_consistency`) aplicadas e validadas em PostgreSQL 17 isolado; aplicação das migrations mais recentes no Neon remoto/compartilhado permanece **pendente** |
| TH-05 | Dashboard administrativo com produtos, estoque, clientes e métricas | [x] | Clientes unificados em `customer_accounts` (KPI e lista coerentes com SQL); séries de volume demonstrativo refletem pedidos demo persistidos com estado vazio explícito quando sem pedidos e rótulo de vendas reais desabilitadas |
| TH-06 | Adicionar produtos pelo painel | [x] | `POST /api/admin/products` + `ProductForm` (nome, SKU, preço); validado em integração (24/24) e UI/API/SQL |
| TH-07 | Editar nome, preço, descrições, categorias e imagens pelo painel | [x] | Edição completa via UI/API/SQL, incluindo edição de preço de produto sem categoria (`category_slug IS NULL` preservado) e CRUD completo de categorias com remoção imediata na UI (`{ data: null }`) |
| TH-08 | Remover/desativar produto, com histórico preservado | [x] | `DELETE /api/admin/products/[id]` faz soft delete (`archived_at`); UI com Arquivar/Desarquivar; vitrine filtra `archived_at IS NULL`; validado em PostgreSQL isolado (validação no Neon remoto permanece pendente) |
| TH-09 | Upload e gerenciamento de imagens de produtos | [~] | Storage local `public/uploads` validado ponta a ponta (upload, leitura byte a byte, substituição, remoção, sobrevivência a restart); rejeição defensiva HTTP 422 antes de gravar por assinatura de magic bytes (JPEG/PNG/WebP) + MIME declarado + limite 5 MB (sem decodificação integral de pixels); homologação em **Cloudflare R2 real permanece pendente** |
| TH-10 | Catálogo público refletir CRUD do PostgreSQL | [x] | `src/lib/storefront.ts` lê produtos/categorias do banco com fallback estático; alterações no admin refletem na vitrine em PostgreSQL isolado; validação contra Neon remoto permanece pendente |
| TH-11 | Login administrativo seguro, contas individuais, RBAC e sessões persistentes | [~] | Contas individuais com bcrypt (`admin_accounts`), papéis `admin`/`operator` (401 sem sessão, 403 em mutações/contas para operador), sessões persistentes/revogáveis (`admin_sessions`, sobreviventes a restart), throttle e gate `ADMIN_ENABLED=1` validados localmente; endurecimento e deploy de Preview/produção permanecem pendentes |
| TH-12 | Cadastro, login, recuperação local, perfil e reaproveitamento no checkout | [x] | Sessão `httpOnly` persiste após refresh e restart, hidrata a loja e pré-preenche `/checkout` sem novo cadastro (cherry-pick `87e44b1`), preservando fluxo visitante e isolamento da área demo; recuperação local (token dev) aprovada em UI/API/SQL; **entrega de e-mail externo permanece pendente** |
| TH-13 | WhatsApp como canal de atendimento geral | [x] | Canal já usado pelo negócio, **sem afirmar integração técnica ao site** |
| TH-14 | Botão/link para abrir WhatsApp no site | [~] | Componente existe em `contato/page.tsx`, mas `STORE.whatsapp` está vazio (link não funcional) |
| TH-15 | Integração Evolution API e centralização de contatos/conversas | [ ] | Planejar canal, eventos, persistência mínima e segurança |
| TH-16 | Follow-up automatizado configurável pelo administrador | [?] | Desenhar motor de regras; ativar apenas mensagens/casos de uso autorizados, com opt-in |
| TH-17 | Modelo de pedidos, status e reserva/baixa de estoque | [~] | Núcleo administrativo transacional (`orders`, `order_items`, `order_status_history`) validado em PostgreSQL isolado com reserva, idempotência, commit em `paid`, estorno em `canceled`, bloqueio de oversell/estoque negativo (422) e ator autenticado; checkout da vitrine continua demonstrativo (`sessionStorage`) e **vendas/checkout comercial permanecem pendentes** |
| TH-18 | Checkout no site com Pix/cartão e confirmação | [?] | Checkout demonstrativo desacoplado validado em desktop e mobile (autenticado + convidado); **checkout comercial e pagamentos reais (PagBank/Asaas) permanecem pendentes** de sandbox, elegibilidade e contrato |
| TH-19 | Opção adicional de continuar via WhatsApp e receber link de Pix | [?] | Opção "Continuar no WhatsApp" com link Pix simulado implementada no checkout demonstrativo; link real condicionado à elegibilidade e políticas dos provedores |
| TH-20 | Painel de pedidos, pagamentos, estornos e relatórios | [~] | Painel `/admin/pedidos` (criação demo, lista, histórico auditável, transições, persistência pós-restart) e séries demonstrativas no dashboard validados localmente; **pagamentos reais, estornos financeiros e relatórios comerciais permanecem pendentes** |
| TH-21 | Integração final e homologação funcional E2E | [x] | Branch `homologacao/funcional-e2e` (base `17da46c` + cherry-pick limpo `87e44b1` → `b8d5d97`): `lint`, `typecheck`, `build`, 68/68 E2E (desktop+mobile), 24/24 integração (PostgreSQL 17 + storage locais reais, sem mocks) e 10/10 fluxos UI/API/SQL + persistência de sessões/dados após restart do servidor aprovados |

**Observação de evidência:** validação integral executada em isolamento local na worktree `homologacao-funcional` (PostgreSQL 17 Docker em `127.0.0.1:55455`, storage local `public/uploads`, servidor loopback `127.0.0.1:3030`), sem mocks nas alegações de integração e sem uso de Neon compartilhado, R2 real ou envio externo de e-mail. Contrato de `src/shared/server/customer-http.ts` verificado sem falha comprovada (`/api/auth/password/reset` retorna HTTP 200 `{"data":null}`); validação de imagens confirmada como checagem defensiva de magic bytes + MIME declarado + limite 5 MB antes de gravar (sem decodificação integral de pixels).

## 3. Personas e jornadas

**Cliente:** visitar a vitrine, localizar produtos e informações, navegar no celular, criar conta, consultar seus dados, solicitar atendimento e — quando elegível — realizar pedido escolhendo forma de conclusão sem obrigatoriedade de WhatsApp.

**Administrador:** fazer login seguro; cadastrar/editar/desativar produtos e imagens; definir estoque, disponibilidade e preço; consultar clientes e operações; acompanhar pedidos e mensagens; iniciar ou aprovar comunicações permitidas; visualizar auditoria.

**Operador (posterior):** acessar funções delegadas, sem acesso indiscriminado a credenciais, configurações financeiras ou dados de terceiros.

## 4. Painel de produtos — prioridade P0

Esta é uma **necessidade explícita do negócio**, não apenas um detalhe técnico.

### Requisitos de CRUD

1. **Cadastrar**: nome, slug gerado/editável com validação, SKU, categoria, descrição, preço em centavos, imagens, estoque inicial, disponibilidade e status.
2. **Listar e buscar**: filtros por nome/SKU, categoria, estoque baixo, ativo/inativo; paginação se necessário.
3. **Editar**: nome, descrição, preço, categoria, imagens, estoque/disponibilidade. Registrar quem alterou e quando; evitar duplicidade de SKU e slug.
4. **Imagens**: upload, preview, imagem principal, reordenação e substituição/remoção; validar tipo e tamanho, gerar URLs confiáveis, alt text; armazenar arquivos em **object storage**, não como binários no PostgreSQL. A solução de armazenamento ainda será escolhida.
5. **Remover**: desativação/arquivamento por padrão (*soft delete*), ocultando o produto do catálogo. Exclusão definitiva somente quando segura e não houver referências históricas.
6. **Sincronização**: item novo ou editado deve refletir na vitrine elegível após revalidação de cache; preço/estoque do carrinho devem ser reconferidos pelo servidor em operações habilitadas.
7. **Segurança**: endpoints administrativos exigem autorização; validação no servidor; trilha de alterações de preço, estoque e status.
8. **Classificação por canal**: disponibilidade interna, vitrine pública, divulgação e transação devem ser campos independentes e configuráveis conforme a política validada do catálogo.

**Aceite P0:** administrador cria um produto de teste com imagem, altera nome e preço, substitui a imagem, edita estoque e arquiva o produto; cada alteração persiste no Neon e a vitrine pública se atualiza conforme disponibilidade, sem alterar código nem exigir novo deploy.

## 5. Pedidos e checkout — prioridade P1 de projeto, ativação condicionada

### UX desejada

Para produtos e operações elegíveis, a jornada deverá oferecer **opções paralelas**:

- **Pagar pelo site:** checkout hospedado, com Pix e cartão; o Pix apresenta QR Code e/ou Pix Copia e Cola segundo o provedor.
- **Continuar no WhatsApp:** canal opcional de atendimento; para transações permitidas, o atendente ou automação poderá enviar link de pagamento seguro para Pix. O pagamento ocorre em página do provedor ou aplicativo bancário; não pressupor uma carteira Pix nativa dentro do WhatsApp.
- **Não exigir WhatsApp** como condição para finalizar no site.

### Engenharia de pedidos

- Dados essenciais: pedido, itens, quantidade, preço congelado no pedido, cliente, status, timestamps, provedor, referência da cobrança, expiração e histórico.
- Conferir preço, estoque e disponibilidade no backend; definir política de reserva/expiração.
- Estados mínimos: `draft`, `pending_payment`, `paid`, `expired`, `canceled`, `refunded`.
- Pix e cartão tratados por checkout hospedado; não coletar dados completos de cartão na aplicação.
- Webhook assinado/autenticado quando suportado, idempotência e conciliação; **redirecionamento, comprovante ou mensagem não são confirmação de pagamento**.
- Separar implementação genérica (`PaymentProvider`) de adaptadores PagBank/Asaas; começar com **sandbox e produtos sintéticos não regulados**.
- Nunca gerar cobrança real para produto/canal que ainda não foi habilitado após validação comercial, contratual e jurídica.

### Decisão de gateway — ADR-PAY-001 (em aberto)

| Opção | Vantagens verificadas | O que precisamos confirmar |
|---|---|---|
| **PagBank — primeiro a avaliar** | Cliente já tem maquininha/relacionamento; APIs de checkout e link com Pix, cartão, redirecionamento e notificações | Titularidade e tipo da conta, acesso à API e homologação de checkout, elegibilidade da atividade e categorias, taxas online, prazo de repasse, compartilhamento da conta com operação presencial |
| **Asaas — concorrente / possível escolhido** | Checkout hospedado com Pix/cartão; link e webhooks; operação simples de cobrança | Aceite da atividade e categorias, taxas reais, limitações de conta, sandbox, experiência mobile e suporte |
| Mercado Pago — alternativa de contingência | Checkout e rede consolidados | Termos, taxas e aceitação da atividade; analisar apenas se necessário |

**Critérios para decisão:** (1) aprovação para atividade/SKUs/canal; (2) custo total real e repasse; (3) Pix no celular e cartão; (4) link compartilhável; (5) webhooks e sandbox; (6) facilidade operacional para o cliente; (7) possibilidade de conciliar conta do PagBank existente.

**Decisão atual:** **avaliar PagBank primeiro e Asaas em paralelo**, sem compromisso definitivo. A maquininha **não significa** que o checkout online esteja habilitado nem que exista integração automática de estoque/vendas da máquina com o site.

**Teste de seleção:** protótipo com pedido sintético não regulado em sandbox para cada finalista; testar pagamento, expiração, cancelamento e duplicidade de webhook. Registrar taxas propostas e retorno do comercial sobre as atividades aceitas.

## 6. WhatsApp — Evolution API como preferência de arquitetura

O WhatsApp **já atende clientes**. O novo trabalho é conectar o site e, futuramente, automatizar processos pertinentes.

### W0 — Canal existente (feito)

- WhatsApp ativo para atendimento e informações gerais. Registrar como já existente, sem retrabalho.

### W1 — Site → conversa (curto prazo)

- CTA de atendimento geral contextualizado, sem bloquear a compra pelo site e sem expor números em código quando configuráveis.
- Quando aberto a partir de uma página elegível, contexto técnico mínimo (identificador de página/atendimento), evitando dados desnecessários.
- Confirmar presença/funcionamento atual; implementar somente a lacuna.

### W2 — Integração Evolution API (prioridade P2)

- Preferir **Evolution API** como gateway técnico de mensagens por experiência da equipe; implementar um `MessagingProvider` desacoplado.
- Documentar e escolher o modo de conexão **Cloud API oficial ou Baileys/WhatsApp Web**, considerando estabilidade, riscos de bloqueio, termos de uso, conta e custos. A Evolution suporta ambos, mas uso da Evolution não elimina regras da Meta.
- Receber eventos de mensagens/status por webhook; validar autenticação, evitar duplicidade, guardar dados mínimos e disponibilizar no dashboard contatos e histórico de atendimento conforme permissões.
- Preparar configuração de número, instância, credenciais e eventos em variáveis de ambiente protegidas. Nenhuma credencial na aplicação cliente.

### W3 — Follow-up controlado (futuro)

- Jornadas configuráveis para **atendimento e operações permitidas**, com consentimento/opt-in quando necessário, registro de preferência, opt-out, limites de frequência e intervenção humana.
- Exemplos: retorno após solicitação de suporte, resposta a dúvidas gerais e acompanhamento de uma operação permitida.
- Métricas: respostas, resolução, custo por mensagem e falhas. Não habilitar campanhas de produtos restritos nem envio massivo sem base autorizada.
- Templates aprovados quando exigidos e validação das regras da plataforma antes do envio.

### W4 — Link de cobrança e Pix na conversa (opção adicional)

Para um pedido **elegível e autorizado**: gerar cobrança no provedor, obter link de checkout, disponibilizá-lo no canal permitido, abrir Pix no ambiente bancário/provedor e conciliar resultado por webhook. **Esse é um caminho opcional, não o checkout principal nem uma forma de contornar regras do canal.**

**Aceite WhatsApp:** link de atendimento abre a conversa corretamente; eventos duplicados não criam mensagens/pedidos duplicados; não há vazamento de credenciais; conversas e pagamentos permanecem auditáveis quando habilitados.

## 7. Segurança, produto e políticas externas

Este PRD **não pressupõe** que a Tobacco Hemp venda cigarros eletrônicos — o responsável afirma expressamente que não vende. O catálogo precisa ser classificado com as categorias reais do negócio, item por item.

Há restrições **independentes da existência de outros sites no mercado**: a RDC 840/2023 veda a comercialização pela internet de produtos fumígenos derivados do tabaco no Brasil, e a política vigente do WhatsApp Business restringe transações envolvendo tabaco. Asaas e PagBank também dependem de elegibilidade contratual. **Isso não elimina o objetivo de projetar checkout**, mas impede tratá-lo como automaticamente liberado para qualquer SKU ou como um caminho alternativo via WhatsApp. A conferência deve ocorrer antes da ativação real, por categoria e canal. Este documento não substitui orientação jurídica.

Outras exigências: proteção de dados (LGPD), sessões administrativas persistentes/revogáveis e individuais antes do Preview público, RBAC, logs de alteração, segregação de credenciais, backups, proteção de webhooks, verificação de acesso e plano de rollback. O bloqueio administrativo 503 fora de dev/test não deve ser removido sem as proteções adequadas.

## 8. Roadmap recomendado

| Ordem | Entrega | Prioridade | Depende de |
|---|---|---|---|
| 1 | Integrar `customer-auth` + `storefront-polish` com backend Neon e rodar regressão | **P0** | Workers finalizados e commits revisados |
| 2 | CRUD completo de produtos e imagens + catálogo público alimentado pelo Neon | **P0** | Modelo de produto e storage definido |
| 3 | Proteger administração para Preview/produção | **P0** | Sessões persistentes, autenticação forte, revisão de segurança |
| 4 | Comparação comercial e sandbox PagBank vs Asaas; ADR-PAY-001 | **P1** | Conta PagBank existente, aceite contratual, SKUs elegíveis |
| 5 | Modelo de pedidos e adaptador de checkout desacoplado (sandbox) | **P1** | Domínio de estoque e contratos definidos |
| 6 | Verificar botão de WhatsApp existente e definir contrato Evolution API | **P1/P2** | Número/instância definidos; finalidade de atendimento |
| 7 | Integrar Evolution a atendimento geral e registros mínimos | **P2** | Instância, segurança e canal elegíveis |
| 8 | Habilitar Pix/cartão em checkout e link de Pix via WhatsApp **somente nos fluxos permitidos** | **P2 condicionado** | Homologação jurídica/PSP/canal, webhooks e testes |
| 9 | Follow-up opt-in, relatórios de operações e automações | **P3 condicionado** | Política WhatsApp, LGPD, usuários e eventos validados |

## 9. Decisões pendentes (checklist de gestão)

- [x] Executar homologação funcional completa em **PostgreSQL 17 local isolado + storage local** na branch `homologacao/funcional-e2e` (base `17da46c` + cherry-pick `87e44b1` → `b8d5d97`): `lint`, `typecheck`, `build`, 68/68 E2E (desktop+mobile), 24/24 testes de integração sem mocks e 10/10 fluxos reais UI/API/SQL + persistência de sessões e registros após restart exclusivo do servidor.
- [x] Implementar contas administrativas individuais com hash bcrypt (`admin_accounts`), RBAC (`admin`/`operator`) e revogação imediata de sessões (`admin_sessions`), além de reserva/commit/estorno transacional de estoque em pedidos administrativos.
- [ ] Aplicar e validar as migrations pendentes (`003_admin_sessions`, `003_orders_core`, `004_admin_accounts`, `004_orders_consistency`) em **Neon remoto/branch autorizado** (não executado nesta homologação isolada; sem uso de Neon compartilhado).
- [ ] Validar e homologar **Cloudflare R2 real** em ambiente definitivo/sandbox dedicado (esta homologação exercitou o fallback local `public/uploads`, sem credenciais R2).
- [ ] Integrar e homologar **envio externo de e-mail transacional** para recuperação de senha de clientes (atualmente restrito a token local de desenvolvimento).
- [ ] Avaliar endurecimento complementar pré-produção: fixar dependências `"latest"` em `package.json` (apontadas por `security:audit`) e avaliar decodificação/re-encoding integral de imagens além da checagem atual por magic bytes.
- [ ] Ativar **checkout comercial real e pagamentos** (confirmar acesso ao checkout API na conta PagBank associada à maquininha, obter proposta equivalente do Asaas, testar Pix/cartão/webhooks em sandbox e fechar ADR-PAY-001).
- [ ] Determinar quais SKUs reais podem ser exibidos, divulgados e transacionados em cada canal.
- [ ] Definir entrega/retirada, frete, endereço, prazo e política de cancelamento para operações autorizadas.
- [ ] Definir número e modo (Cloud API ou Baileys) da integração Evolution; mapear riscos e custos.
- [ ] Definir mensagens permitidas, opt-in/opt-out, templates e regras de follow-up.
- [ ] Preparar administração segura para disponibilização externa e definir política de backup.

## 10. Preparação local de Preview protegido (22/11/2026)

Branch existente `homologacao/funcional-e2e`, worktree `homologacao-funcional`, base homologada `2cd4b49`. Nenhuma branch nova, push, deploy, auto-link da Vercel, configuração remota ou migration no Neon compartilhado foi executada nesta preparação. O snapshot independente do dono em `3030` e seu PostgreSQL `55455`, os previews `3010`/`3025`, `main` e produção não foram alterados.

### Diferenças comprovadas e implementação

`next dev` habilitava clientes e resolução SSR da sessão apenas em development/test. Em `next start` (`NODE_ENV=production`) clientes retornavam 503 e o SSR não resolvia o cookie; o admin usava o opt-in independente `ADMIN_ENABLED`. Agora API e SSR compartilham uma habilitação exclusivamente server-side, que exige simultaneamente `VERCEL=1`, `VERCEL_ENV=preview`, `VERCEL_GIT_COMMIT_REF=homologacao/funcional-e2e`, `PREVIEW_BACKEND_ENABLED=1` e `APP_ORIGIN` como origem HTTPS canônica exata (sem credenciais, caminho ou barra final). Configuração ausente/inválida mantém clientes e admin do Preview fechados, inclusive se `ADMIN_ENABLED=1`. O opt-in novo não libera clientes em produção nem substitui a política administrativa preexistente de produção. Dev/test local permanece funcional.

Mutações do Preview comparam `Origin` com `APP_ORIGIN`, nunca com Host/forwarded-host fornecidos pelo chamador; rejeitam ausência de Origin e `Sec-Fetch-Site: cross-site`. Cookies de clientes e admin são `HttpOnly`, `Secure`, host-only e `SameSite=Lax`/`Strict`, respectivamente. O mesmo gate habilita a resolução server-side da sessão da vitrine. As APIs preservam `Cache-Control: no-store` e `Vary: Cookie`. Catálogo/acessórios, identidade visual, sessão real versus área demo, checkout demonstrativo e bloqueio de pagamentos reais foram preservados. Esta entrega é para homologação com acesso protegido: o throttle de clientes ainda é em memória por instância e recuperação/cadastro não têm controle distribuído de abuso; revisar antes de qualquer liberação pública de autenticação.

Recuperação reutiliza token opaco com hash no PostgreSQL, expiração de 30 minutos, consumo único e revogação das sessões existentes. Foi acrescentada captura pela API HTTP do Mailpit, somente em endereço loopback HTTP configurado em `MAILPIT_URL`, sem SMTP ou envio público. O link usa exclusivamente `APP_ORIGIN`, nunca cabeçalhos da requisição; fora do dev/test local a resposta não inclui `resetToken`. A configuração é validada antes da consulta da conta, para que ausência/configuração pública de sandbox produza o mesmo 503 para e-mail cadastrado ou inexistente. Falha de entrega reverte a criação do token na transação. **Mailpit local não é alcançável por uma função da Vercel:** no Preview remoto, manter `MAILPIT_URL` ausente e recuperação indisponível até implementar/homologar adaptador privado de sandbox explicitamente autorizado. Não há entrega externa comprovada.

Mídia: R2 segue como adaptador persistente existente; todos os cinco nomes devem estar configurados. Sem R2 completo, uploads/remoções no runtime production ou em qualquer ambiente Vercel falham com 503 `STORAGE_NOT_CONFIGURED`, sem gravar em `public/uploads` ou `/tmp`. Disco local continua permitido apenas em dev/test fora da Vercel. `/tmp` não é storage persistente e não deve receber fallback. Upload sem R2 foi comprovadamente rejeitado sem criar linha de imagem no banco. Ciclo com R2 real e simulação S3 local não foram executados nesta preparação; o ciclo local de desenvolvimento não prova R2.

### Configuração a revisar antes de autorizar o Preview

Preferir **projeto Vercel separado** para homologação, sem domínios de produção e com banco/bucket próprios. Se reutilizar o projeto existente, limitar proteção e variáveis ao Preview da branch `homologacao/funcional-e2e`, verificando que configurações de produção permanecem intactas. No painel do projeto, revisar Deployment Protection e selecionar Vercel Authentication/escopo Standard ou opção equivalente disponível no plano que proteja os deployments de Preview; confirmar acesso negado sem autenticação em URL de deployment e alias da branch, incluindo `/api/admin/*` e `/api/auth/*`. Não adicionar exceções públicas ou divulgar bypass secrets. O opt-in da aplicação não substitui essa proteção de plataforma.

| Nome | Escopo/ação necessária (sem valores secretos) |
|---|---|
| `VERCEL`, `VERCEL_ENV`, `VERCEL_GIT_COMMIT_REF` | Variáveis de sistema da Vercel; confirmar sua exposição no runtime e a branch exata. |
| `PREVIEW_BACKEND_ENABLED` | `1` somente no Preview desta branch, após proteção e isolamento confirmados. Não usar prefixo `NEXT_PUBLIC_`. |
| `APP_ORIGIN` | Origem HTTPS estável e protegida escolhida para esta branch. Usar essa URL no navegador; outras origens/aliases não ganham autorização de mutação automaticamente. |
| `DATABASE_URL` | Banco/branch Neon dedicado autorizado; não reutilizar destino compartilhado. O runner atual aplica migrations e seed na primeira leitura/API e pode executá-los durante build se configurado: revisar/permissão antes do primeiro build/deploy. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Conta bootstrap exclusiva de homologação; senha forte protegida. Criação idempotente não troca senha de conta existente; revisar usuários individuais/RBAC. |
| `ADMIN_ENABLED` | Manter ausente/`0` para este Preview; o gate novo específico é suficiente. Não alterar configuração de produção. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | Bucket/credenciais dedicados de homologação com permissões mínimas; URL HTTPS de leitura. Configurar também no build para `next/image`; ausência deve permanecer visível como 503 nos uploads. |
| `MAILPIT_URL` | Somente validação local loopback; deixar ausente na Vercel até existir sandbox privado autorizado e adaptador correspondente. |
| `PREVIEW_VALIDATION` | Somente validação local; `1` usa `.next-preview`, isolando artefatos. Não configurar na Vercel. |

Variáveis de Preview podem herdar valores gerais do projeto: revisar e sobrescrever **todos os destinos sensíveis** para esta branch, sem mudar Production. Segredos nunca entram em `NEXT_PUBLIC_*`, `next.config.env`, git, logs ou resposta HTTP. A URL protegida precisa ser definida antes do teste de cookies/origem/recuperação; se mudar, atualizar a origem explicitamente em novo deploy autorizado.

O coordenador informou preflight separado: um único destino Neon existente respondeu a `BEGIN READ ONLY` + `SHOW transaction_read_only`; o bucket R2 existente respondeu HEAD 200; nenhum sandbox explícito nem configuração de e-mail foram encontrados. GitHub confirmou `main` como branch padrão e registros de Preview por `vercel[bot]`, **sem confirmar proteção do projeto**. Esses resultados não são autorização para writes/migrations e não provam isolamento, ciclo de upload R2 nem funcionamento do Preview. Este worker não leu nem utilizou essas credenciais.

### Evidências locais e reprodução

Ambiente sintético próprio: contêiner PostgreSQL 17 `th-preview-pg-920aae`, porta loopback `55465`, banco `preview_validation`; Mailpit v1.27.10 `th-preview-mail-920aae`, somente HTTP loopback `18025`, sem porta SMTP publicada/relay; Next start `3330` atrás de proxy HTTPS local `3331` com certificado de teste. Nenhum serviço preexistente foi reiniciado. Os nomes/senha sintéticos em `scripts/validate-preview.mjs` são apenas fixtures locais.

Implementação commitada em `f1d6094`. Verificações finais aprovadas: **lint, typecheck, build, 68/68 E2E desktop/mobile, 24/24 integração desktop/mobile** contra PostgreSQL próprio e storage local de dev; **9 grupos de cenários** de hardening com build + Next start em production, TLS local, APIs e navegador Chromium desktop/mobile, incluindo captura Mailpit, recuperação sem token externo, consumo único/revogação/relogin e persistência após restart exclusivo do processo `3330`. O teste de mídia nesse runtime confirmou 503 sem R2 e zero linhas novas de imagem, sem substituir R2 por S3 falso. Screenshots da conta autenticada foram inspecionados nos dois tamanhos e não apresentaram overflow horizontal. Resultados locais em `.preview-validation/results.json`, `.preview-validation/e2e-results/.last-run.json` e `.preview-validation/integration-results/.last-run.json`.

A execução inicial simultânea das suites colidiu no diretório padrão de traces (ENOENT) e um fluxo administrativo excedeu a espera de 5 segundos durante compilação dev; as suites foram repetidas com saídas isoladas e a integração completa passou na repetição sem afrouxar assertions/timeouts. O servidor dev ainda emitiu avisos de imagem removida 404/`src` vazio no ciclo de substituição/exclusão; isso não foi tratado como comprovação de mídia remota nem corrigido fora do escopo. Os contêineres criados para esta validação foram parados ao término, preservando os serviços anteriores.

Para reproduzir: iniciar esses dois contêineres dedicados com as portas livres (ou `docker start th-preview-pg-920aae th-preview-mail-920aae` se preservados), gerar `cert.pem`/`key.pem` locais em `.preview-validation` (localhost), executar `PREVIEW_VALIDATION=1 npm run build` e `node scripts/validate-preview.mjs`. O script usa ambiente de processo limitado e configuração sintética explícita, incluindo destinos R2 vazios para impedir uso incidental; não importa `.env.local`. O projeto também não possui `.env.local` nesta worktree. Executar suites Playwright com diretórios de saída diferentes ou sequencialmente, evitando colisão dos traces. Para integração, definir explicitamente `DATABASE_URL` local e `ADMIN_PASSWORD` sintética, sem R2, e usar `npm run test:integration` (dev em `3210`); E2E usa `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3332` e o build isolado. Artefatos e TLS ficam ignorados em `.preview-validation`.

**Pendências para executar o Preview após autorização:** confirmar projeto/alvo e proteção na Vercel; provisionar/autorizar Neon e R2 isolados; revisar variáveis exclusivas da branch e migrations/seed; definir origem estável protegida e contas de teste; autorizar push/deploy; executar smoke externo autenticado e sem autenticação, cookies/CSRF, upload/leitura/remoção real de mídia, persistência e rollback. Recuperação externa permanece indisponível até entrega de sandbox privada autorizada. Não executar `vercel` sem projeto/alvo revisado: nenhum auto-link, `vercel pull`, alteração remota ou deploy foi necessário localmente. Checkout comercial, pagamentos, newsletter e pedidos reais continuam desativados.

Referências oficiais consultadas: [Deployment Protection](https://vercel.com/docs/deployment-protection), [variáveis por ambiente/branch](https://vercel.com/docs/environment-variables), [variáveis de sistema](https://vercel.com/docs/environment-variables/system-environment-variables), [API Mailpit](https://mailpit.axllent.org/docs/api-v1/) e guia Next instalado `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`.

## 11. Referências técnicas e normativas consultadas

- Plano técnico original — Golden Image e Tobacco Hemp (09/11/2026; documento fornecido pelo responsável).
- [Asaas — Checkout hospedado, Pix, cartão e webhooks](https://docs.asaas.com/docs/checkout-asaas)
- [Asaas — atividades não aceitas](https://central.ajuda.asaas.com/hc/pt-br/articles/54012368446491-Quais-atividades-econ%C3%B4micas-n%C3%A3o-s%C3%A3o-aceitas-no-Asaas)
- [PagBank — Checkout e Link de Pagamento](https://developer.pagbank.com.br/docs/checkout)
- [PagBank — Checkout e contratação](https://pagbank.com.br/para-seu-negocio/online/checkout)
- [Evolution Foundation — Evolution API e canais suportados](https://github.com/evolution-foundation/evolution-api)
- [WhatsApp Business — Política de Negócios](https://whatsappbusiness.com/pt-br/policy/)
- [Anvisa — RDC 840/2023, comercialização online](https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&cod_menu=9431&cod_modulo=310&link=S&numeroAto=00000840&orgao=RDC%2FDC%2FANVISA%2FMS&seqAto=000&tipo=RDC&valorAno=2023)

---

**Controle de alteração v1.1:** incorporadas premissas reais do negócio (sem cigarros eletrônicos, WhatsApp já ativo, Evolution preferida e cliente com maquininha PagBank); checkout no site + opção de link Pix via WhatsApp; comparação PagBank/Asaas; CRUD administrativo completo com imagem e efeito na vitrine; revisão de status e prioridades. **Nenhuma integração de pagamento ou WhatsApp foi ativada por este documento.**

**Controle de alteração v1.2:** coluna de evidência da tabela de status atualizada com base em inspeção direta do código e dos testes (TH-06 a TH-14); sem alteração de decisões de negócio. Confirmadas as lacunas: CRUD restrito a nome/SKU/preço/ativo (sem descrição, categoria, imagens, exclusão lógica ou UI de edição), catálogo público ainda estático, checkout PagBank/Asaas não iniciado e Evolution API não implementada.

**Controle de alteração v1.3:** branches `feature/customer-auth` (`0d09758`), `feature/storefront-polish` (`571aa48`) e `docs/prd-tobacco` (`b6a20f5`) integradas em `feature/integracao-v2` via cherry-pick, sem conflitos. Validação local executada: lint, typecheck e build aprovados; 50 testes E2E (desktop+mobile) e 6 testes de integração contra o Neon (login/cadastro/sessão/perfil de cliente, dashboard administrativo, catálogo e carrinho; migrations `001_init` e `002_customer_auth` idempotentes) aprovados. Status TH-03, TH-12 e TH-21 atualizados para `[x]`. Nenhuma operação destrutiva executada no Neon; nenhum push, deploy ou merge em `main` realizado.

**Controle de alteração v1.4:** branch `feature/catalogo-dinamico` implementa o módulo completo de gestão de catálogo. CRUD de produtos (nome, SKU, preço, descrição, categoria, coleção, slug, estoque, disponibilidade, destaque e novidade), exclusão lógica (soft delete) e múltiplas imagens com upload local, além da gestão de categorias com tratamento de categorias vazias. O catálogo público passa a ler o Neon (`src/lib/storefront.ts`) com fallback estático, preservando busca, filtros, carrinho e favoritos. Validação local: lint, typecheck e build aprovados; 52/52 testes E2E (desktop+mobile) aprovados. Status TH-07, TH-08 e TH-10 atualizados para `[x]`; TH-09 em `[~]`. Pendências: executar o teste de integração real contra o Neon e definir storage persistente de imagens (`public/uploads` é apenas local). Nenhum push, deploy ou merge realizado.

**Controle de alteração v1.5:** branches `feature/catalogo-dinamico` (`2e23594`), `feature/admin-production-2` (`898c61c`) e `feature/pedidos-core-3` (`2997489`) integradas em `feature/integracao-v3-4` via merge `--no-ff`, com conflitos resolvidos em `src/shared/server/migrate.ts`, `.env.example`, `AdminShell.tsx`, `Badge.tsx`, `CheckoutForm.tsx` e `admin-service.ts` — sem reimplementar módulos. Migrations `003_catalog`, `003_admin_sessions` e `003_orders_core` reconciliadas: o runner controla versões pela string de `id` (não por prefixo numérico) e aplica na ordem do array; os ids são distintos e estáveis, preservando registros já aplicados. Nenhuma migration foi executada no Neon compartilhado (sem validação isolada). Validação local: lint, typecheck e build aprovados; 66/66 testes E2E (desktop+mobile) aprovados — catálogo dinâmico, imagens (fallback estático), autenticação administrativa e de clientes (mocks) e pedidos/checkout demonstrativo. Status TH-09, TH-11, TH-17 e TH-20 atualizados para `[~]`; TH-18 e TH-19 mantidos `[?]`; TH-21 em `[x]`. Pendências: testes de integração contra Neon/R2 isolados (não executados), usuários administrativos reais/RBAC, reserva de estoque e homologação de gateway. Nenhum push, deploy ou merge em `main` realizado.

**Controle de alteração v1.6:** validação da integração v3 com banco e storage reais. O `schema_migrations` do Neon compartilhado contém apenas `001_init`, `002_customer_auth` e `003_catalog`; `003_admin_sessions` e `003_orders_core` ainda não foram aplicadas lá. Para não aplicar migrations novas no Neon compartilhado sem autorização, a validação usou **Postgres isolado (Docker)** + **Cloudflare R2 real** (credenciais reutilizadas dos `.env.local` já configurados). Resultado: as 5 migrations aplicam limpas no banco isolado; 8/8 testes de integração (`admin`, `customer-auth`, `catalog`) aprovados em isolamento (desktop+mobile), cobrindo catálogo dinâmico, ciclo completo de imagem no R2 (upload/leitura/substituição/remoção/arquivamento), autenticação de clientes e sessões administrativas persistentes; fixtures e objetos R2 limpos ao final. Achados: (1) o throttle de login administrativo (`admin_login_attempts`, 5 tentativas/60s) conta também logins bem-sucedidos e persiste entre os projetos da suíte, derrubando a execução em sequência com `429` — a suíte precisa de isolamento/limpeza do throttle; (2) o fallback estático do catálogo engolia erros de banco em silêncio — corrigido em `src/lib/storefront.ts` com `console.error`, mantendo o fallback para degradação graciosa. Bloqueio restante: aplicar `003_admin_sessions` e `003_orders_core` no Neon compartilhado (pendente de autorização) ou provisionar Neon/branch isolado. Nenhum push, deploy ou merge em `main` realizado.

**Controle de alteração v1.7:** homologação funcional E2E integrada na branch `homologacao/funcional-e2e` (worktree isolada `homologacao-funcional`), partindo de `17da46c` (descendente de `84b2944` com correções de admin/clientes/séries/DELETE/validação de imagem/produto sem categoria) e incorporando `87e44b1` via cherry-pick limpo (`b8d5d97`, com resolução mínima do conflito em `src/components/commerce/CheckoutForm.tsx` preservando `products` em `evaluateCartEligibility` e `createDemoOrder`). Verificações aprovadas em isolamento local (PostgreSQL 17 Docker próprio em `127.0.0.1:55455`, storage local `public/uploads`, servidor loopback `127.0.0.1:3030`, sem mocks nas alegações de integração): `lint`, `typecheck`, `build`, **68/68** testes E2E (desktop+mobile), **24/24** testes de integração (desktop+mobile) e reprodução real UI/API/SQL de todos os fluxos críticos (cadastro/login, sessão após refresh, checkout demo com perfil autenticado + convidado + isolamento da área demo, recuperação local de senha, clientes e indicadores coerentes com SQL sem e com pedido demo, CRUD completo de categorias com DELETE imediato sem reload, edição de preço de produto sem categoria preservando `category_slug=NULL`, upload de imagem válida e rejeição defensiva HTTP 422 por magic bytes antes de gravar, estoque/pedidos com reserva/idempotência/oversell/estorno/auditoria, RBAC `admin`/`operator` com revogação imediata e persistência integral de sessões e registros após reinício exclusivo do servidor na porta `3030`). Confirmado sem alterações que `src/shared/server/customer-http.ts` cumpre o contrato esperado (`/api/auth/password/reset` retorna HTTP 200 `{"data":null}`), e registrado honestamente que a validação de imagens cobre assinatura de cabeçalho (magic bytes JPEG/PNG/WebP + MIME declarado + limite 5 MB) sem decodificação integral de pixels. Permanecem explicitamente **pendentes**: validação/migrations em Neon real, Cloudflare R2 real, entrega externa de e-mail, checkout comercial e integrações de pagamento (PagBank/Asaas). Nenhum push, merge em outra branch, deploy ou operação comercial real foi realizado.
