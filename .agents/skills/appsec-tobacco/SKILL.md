---
name: AppSec Tobacco Hemp
description: Auditoria de segurança de aplicação (AppSec) da loja Tobacco Hemp — autenticação e autorização, cookies/sessões/CSRF, APIs e proxies, XSS, validação de entradas, IDOR, exposição de credenciais, LGPD, dependências e cadeia de suprimentos, configuração de deploy e restrições de comércio regulado.
---

# AppSec — Tobacco Hemp

Procedimento de auditoria de segurança para a loja Tobacco Hemp. Executada pelo
agente `security-auditor` (somente leitura) e também carregável manualmente via
`@appsec-tobacco`.

## Regras inegociáveis

- Somente leitura: nunca editar, escrever, apagar, renomear ou mover arquivos.
- Não acessar credenciais reais, segredos, arquivos `.env` de produção nem ambiente de produção.
- Não executar comandos destrutivos (ex.: `rm`, `git reset --hard`, `force push`).
- Não alterar páginas da loja, dashboard, contratos da Golden Image nem dados em `src/data`.
- Não implementar funcionalidades comerciais, pagamentos, autenticação ou integrações.
- Não fazer merge, deploy ou push.

## Contexto da aplicação (baseline)

- Next.js 16 (App Router), React 19, TypeScript estrito, Tailwind 4.
- Estado: `zustand` + `localStorage` (carrinho e favoritos) e `sessionStorage` (recibo).
- Checkout demonstrativo: os dados pessoais do formulário **não são persistidos**;
  o recibo guarda apenas número aleatório, contagem, total e data em `sessionStorage`.
- Nesta etapa não há backend, login real, API, pagamento nem envio de e-mail.
- Age gate (18+) é experiência de UX, **não** é verificação jurídica de identidade.
- Metadados usam `robots: noindex` enquanto a loja for demonstração.
- Arquivos sensíveis: `src/lib/constants.ts` (contatos/chaves), `src/data/*` (catálogo).

> A cada integração de branch, revalide este baseline — o que era estático pode
> ganhar APIs, autenticação ou rotas server-side.

## Preparação

1. Identifique o escopo da mudança: `git diff <base>...<branch>` (somente leitura).
2. Liste arquivos alterados: `git diff --stat <base>...<branch>`.
3. Rode as verificações automatizadas (no diretório raiz do repositório):
   - `node scripts/security-audit.mjs` (estático, sem rede)
   - `node scripts/security-audit.mjs --deps` (inclui `npm audit --omit=dev`, com rede)
   - `npm run lint` e `npm run typecheck`
4. Revise o código-fonte das rotas novas/alteradas, priorizando Server Components,
   Route Handlers, Server Actions e `middleware`.

## Tópicos de auditoria

Para cada tópico, responda às perguntas e registre achados com severidade
(Crítica / Alta / Média / Baixa), arquivo:linha, evidência e recomendação.

### 1. Autenticação e autorização
- Há rota autenticada? A sessão é validada no servidor (não apenas no cliente)?
- Autorização é verificada em **todos** os pontos de entrada (Server Components,
  Route Handlers, Server Actions), ou apenas na interface?
- Senhas usam hash forte (bcrypt/argon2)? Nunca MD5/SHA-1 nem reversível.
- Há proteção contra enumeração de usuário e força bruta (rate limit)?
- Recuperação de senha não revela se o e-mail existe?

### 2. Cookies, sessões e CSRF
- Cookies de sessão usam `HttpOnly`, `Secure` e `SameSite=Lax|Strict`?
- Ações mutáveis (POST, Server Actions) exigem token CSRF?
- Sessão expira e é invalidada no logout?
- Dados de sessão não trafegam em URL nem são persistidos em `localStorage`?

### 3. APIs administrativas e proxies
- Rotas `/admin`, `/api` e Server Actions têm checagem de autorização própria?
- `next.config.ts` com rewrites/redirects (proxies) aponta apenas para destinos confiáveis?
- Sem SSRF: URLs/endpoints fornecidos pelo usuário nunca são requisitados pelo servidor.
- Endpoints sensíveis têm rate limiting e logging?

### 4. XSS, validação de entradas e IDOR
- Ausência de `dangerouslySetInnerHTML`, `innerHTML` e `eval`/`new Function`.
- Dados dinâmicos escapados pelo React; sem `href`/`src` injetáveis (`javascript:`).
- Entradas validadas no **servidor** (não só no cliente) e por lista de permissão.
- IDOR: consultas usam o identificador do usuário autenticado, não IDs previsíveis fornecidos pelo cliente.

### 5. Exposição de credenciais
- Nenhum segredo hardcoded em `src/`, configurações ou frontend (chaves, tokens, senhas).
- `.env*` não está versionado (apenas `.env.example`).
- Chaves públicas de SDK (não-secretas) separadas das secretas; secretas só no servidor.
- Logs não imprimem tokens, senhas nem dados pessoais.

### 6. Proteção de dados pessoais e LGPD
- Dados pessoais coletados são os mínimos necessários (minimização).
- Finalidade e base legal claras; política de privacidade referenciada.
- Dados sensíveis não vão para `localStorage`, logs ou analytics sem necessidade.
- Consentimento explícito quando exigido; direito de acesso/exclusão previsto.
- Terceiros (analytics, cookies) mapeados e com consentimento.
- A demonstração **não persiste** dados pessoais; confirmar que isso permanece verdadeiro.

### 7. Dependências e cadeia de suprimentos
- `npm audit --omit=dev` sem vulnerabilidades críticas ou altas.
- Dependências de produção pinadas (sem `latest`/`*`); lockfile versionado.
- Menor número de dependências possível; origem e manutenção ativa verificadas.
- Alertas de desenvolvimento documentados e com plano de correção (ver `README.md`).

### 8. Segurança de configurações e deploy
- `poweredByHeader: false`; quando houver servidor real, cabeçalhos de segurança
  (CSP, HSTS, X-Content-Type-Options, Referrer-Policy) presentes.
- `robots: noindex` mantido enquanto demo (evitar indexação prematura).
- Build de produção não expõe segredos; variáveis de ambiente não vazam ao cliente
  (`NEXT_PUBLIC_*` apenas para dados públicos).
- Sem dependências de desenvolvimento no bundle de produção.

### 9. Restrições de comércio eletrônico de produtos regulados
- Catálogo limitado a acessórios de uso geral (sem tabaco, nicotina ou cannabis).
- Age gate presente, mas **rotulado** como confirmação, não como verificação jurídica.
- Sem alegações de saúde, cura ou benefício terapêutico.
- Termos de uso e restrições por jurisdição identificados antes da publicação real.
- Sem pagamento ou envio reais até integração e configuração explícitas.

## Relatório

Formato recomendado:

1. Resumo executivo (um parágrafo) + classificação geral do risco.
2. Achados ordenados por severidade, cada um com arquivo:linha, evidência, impacto e recomendação.
3. Itens verificados como OK (rastreabilidade).
4. Riscos aceitos ou diferidos, com justificativa.

Nunca reproduza segredos em claro no relatório; use referências.

## Verificações automatizadas

- `node scripts/security-audit.mjs` — scan estático (segredos, XSS, `eval`, mixed content, `.env` versionado, dependências `latest`, headers).
- `node scripts/security-audit.mjs --deps` — adiciona `npm audit --omit=dev`.
- `node scripts/security-audit.mjs --strict` — falha também em avisos.
- Detalhes de execução e integração no CI em `docs/SECURITY.md`.
