# PRD — Tobacco Hemp

**Versão:** 1.3 — Integração das branches e validação local  
**Data:** 12/11/2026  
**Status:** documento de trabalho; decisões de checkout e integração comercial pendentes de homologação  
**Base:** plano técnico de 09/11/2026, PRD v1.0–v1.2 e integração/validação local das branches (12/11/2026).

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
| TH-04 | Banco PostgreSQL Neon, migrations e seed do catálogo | [x] | `feature/backend-neon`, persistência validada localmente |
| TH-05 | Dashboard administrativo com produtos, estoque, clientes e métricas | [x] | API própria, testes com Neon e 44/44 E2E locais; não habilitado publicamente |
| TH-06 | Adicionar produtos pelo painel | [x] | `POST /api/admin/products` + `ProductForm` (nome, SKU, preço); testado em `tests/integration/admin.spec.ts` |
| TH-07 | Editar nome, preço, descrições, categorias e imagens pelo painel | [~] | `PATCH /api/admin/products/[id]` existe (nome, preço, SKU, ativo), mas **sem UI de edição**; descrição, categoria e imagens inexistem no schema/input |
| TH-08 | Remover/desativar produto, com histórico preservado | [ ] | **Sem rota DELETE, sem soft delete e sem UI de arquivar/desativar**; campo `active` existe mas não é usado na interface |
| TH-09 | Upload e gerenciamento de imagens de produtos | [ ] | Nenhum campo de imagem no schema (`migrate.ts`) nem no `ProductInput`; object storage ainda não escolhido |
| TH-10 | Catálogo público refletir CRUD do Neon | [~] | `Catalog.tsx` ainda lê `src/data/products.ts` (estático); `seed.ts` popula o Neon, mas a vitrine não lê o banco |
| TH-11 | Login administrativo seguro e sessões prontas para Preview/produção | [ ] | Sessão httpOnly/SameSite=Strict testada; `admin-http.ts` ainda bloqueia com `503` fora de dev/test |
| TH-12 | Cadastro, login, recuperação e perfil reais do cliente | [x] | `feature/customer-auth` (`0d09758`) integrado; `AUTH.enabled=true`; fluxo completo validado contra Neon (6/6 integração, desktop+mobile) |
| TH-13 | WhatsApp como canal de atendimento geral | [x] | Canal já usado pelo negócio, **sem afirmar integração técnica ao site** |
| TH-14 | Botão/link para abrir WhatsApp no site | [~] | Componente existe em `contato/page.tsx`, mas `STORE.whatsapp` está vazio (link não funcional) |
| TH-15 | Integração Evolution API e centralização de contatos/conversas | [ ] | Planejar canal, eventos, persistência mínima e segurança |
| TH-16 | Follow-up automatizado configurável pelo administrador | [?] | Desenhar motor de regras; ativar apenas mensagens/casos de uso autorizados, com opt-in |
| TH-17 | Modelo de pedidos, status e reserva/baixa de estoque | [ ] | Necessário antes de qualquer gateway |
| TH-18 | Checkout no site com Pix/cartão e confirmação | [?] | PagBank e Asaas em comparação; sandbox, elegibilidade e contrato pendentes |
| TH-19 | Opção adicional de continuar via WhatsApp e receber link de Pix | [?] | Arquitetura definida; uso condicionado à elegibilidade da transação e políticas dos provedores |
| TH-20 | Painel de pedidos, pagamentos, estornos e relatórios | [ ] | Dados verdadeiros a partir de eventos confirmados; não usar métricas demonstrativas como vendas |
| TH-21 | Integração de branches e testes de regressão completos | [x] | `customer-auth` (`0d09758`), `storefront-polish` (`571aa48`) e `docs/prd-tobacco` (`b6a20f5`) integrados em `feature/integracao-v2`; lint, typecheck, build, 50 E2E e 6 integração aprovados |

**Observação de evidência:** inspeção direta do código da branch atual e dos diffs de `feature/customer-auth` (`0d09758`) e `feature/storefront-polish` (`571aa48`). Lacunas de CRUD de produtos, catálogo dinâmico, checkout e Evolution API foram confirmadas no código, não apenas em relatórios.

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

- [ ] Escolher storage de imagens: capacidade, custo, upload seguro, CDN, backup.
- [ ] Validar cadastro/edição de produtos no painel até a vitrine, incluindo exclusão lógica.
- [ ] Confirmar acesso ao checkout API na conta PagBank associada à maquininha e consultar taxas/elegibilidade.
- [ ] Obter proposta equivalente do Asaas e testar checkout Pix/cartão em sandbox.
- [ ] Determinar quais SKUs reais podem ser exibidos, divulgados e transacionados em cada canal.
- [ ] Definir entrega/retirada, frete, endereço, prazo e política de cancelamento para operações autorizadas.
- [ ] Definir número e modo (Cloud API ou Baileys) da integração Evolution; mapear riscos e custos.
- [ ] Definir mensagens permitidas, opt-in/opt-out, templates e regras de follow-up.
- [ ] Preparar administração segura para disponibilização externa e definir política de backup.

## 10. Referências técnicas e normativas consultadas

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
