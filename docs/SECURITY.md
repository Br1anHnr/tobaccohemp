# Segurança — Tobacco Hemp

Infraestrutura de auditoria e verificação de segurança, mantida separada das
funcionalidades em desenvolvimento. Nada aqui altera a loja, o dashboard ou os
contratos da Golden Image.

## Componentes

| Arquivo | Papel |
| --- | --- |
| `.agents/skills/appsec-tobacco/SKILL.md` | Procedimentos de auditoria (AppSec) por tópico. |
| `.opencode/agents/security-auditor.md` | Agente `Security Auditor` (OpenCode 2), somente leitura. |
| `scripts/security-audit.mjs` | Verificações automatizadas, sem serviços pagos. |
| `docs/SECURITY.md` | Este documento. |

## Agente `Security Auditor`

Subagente do OpenCode 2 com permissões efetivas de somente leitura:

- Bloqueia `edit`, `execute`, `subagent`, `shell` (exceto lista restrita) e
  acesso a diretórios externos ao repositório.
- Bloqueia leitura de `.env` e `.env.*` (permite `.env.example`).
- Permite `read`, `glob`, `grep`, `webfetch`, `websearch` e `skill`.
- Permite apenas comandos de inspeção: `git status/diff/log/show/grep/ls-files`,
  `npm audit/outdated/ls`, `npm run lint`, `npm run typecheck` e
  `node scripts/security-audit.mjs`.

Para usá-lo, peça ao agente principal: *"Use o subagente `security-auditor` para
auditar a branch de integração."*

## Verificações automatizadas

Sem dependências extras e sem serviços pagos:

```sh
node scripts/security-audit.mjs          # scan estático (offline)
node scripts/security-audit.mjs --deps   # + npm audit --omit=dev (rede)
node scripts/security-audit.mjs --strict # falha também em avisos
node scripts/security-audit.mjs --json   # saída estruturada
```

Ou, via npm:

```sh
npm run security:audit
npm run security:audit -- --deps --strict
```

O script verifica: segredos hardcoded, `dangerouslySetInnerHTML`/`innerHTML`,
`eval`/`new Function`, URLs `javascript:`, conteúdo misto `http://`, arquivos
`.env` versionados, dependências com `latest`/`*`, `poweredByHeader: false` e,
com `--deps`, vulnerabilidades conhecidas via `npm audit --omit=dev`.

Códigos de saída: `0` limpo, `1` erros (ou avisos com `--strict`), `2` falha da
própria verificação.

## Integração no CI

Adicione ao pipeline (provedor-agnóstico), após instalar as dependências:

```sh
npm ci
npm run lint
npm run typecheck
node scripts/security-audit.mjs --strict
node scripts/security-audit.mjs --deps
```

A etapa `--deps` requer rede; mantenha-a em um job separado se o ambiente do CI
for restrito. Nenhuma das etapas escreve no código nem publica artefatos.

## Auditoria após integração das branches

1. Confirme a branch de integração e o ponto de comparação:

   ```sh
   git fetch --all
   git diff <base>...<integracao> --stat
   ```

2. Rode as verificações automatizadas acima.
3. Acione o agente `security-auditor` para a revisão manual por tópico (autenticação,
   cookies/CSRF, APIs, XSS/validação/IDOR, credenciais, LGPD, dependências,
   configurações/deploy e comércio regulado).
4. Consolide o relatório (severidade, arquivo:linha, evidência, recomendação) e
   decida, com o time, o que bloquear ou diferir antes do merge.

## Limites

A auditoria cobre o código presente no repositório. Pagamentos, autenticação,
envio de pedidos e integrações externas ainda não existem nesta etapa e devem ser
auditados quando forem introduzidos. A verificação de idade é de UX, não jurídica;
não substitui avaliação legal para comércio de produtos regulados.

## Achados conhecidos (baseline)

Resultados observados em novembro de 2026, registrados para rastreabilidade. São
advertências, não correções — ajustes de dependência podem afetar os contratos da
Golden Image e devem ser decididos no fluxo de integração.

- **`next` — vulnerabilidade crítica (produção). CORRIGIDA.** O `npm audit --omit=dev`
  apontava `next@16.3.8` com avisos afetando `>=16.0.0 <=16.4.0` (RCE na API de
  otimização de imagens ao usar SVG, RCE em `use cache` retornando typed arrays e
  DoS no App Router via Server Actions). O projeto foi atualizado para
  **`next@16.4.6`** (e `eslint-config-next@16.4.6`); `npm audit --omit=dev` agora
  reporta **zero vulnerabilidades**. A afirmação de "zero vulnerabilidades" do
  `README.md` (outubro/2026) voltou a ser verdadeira para produção.
- **Compatibilidade: hydration mismatch de `next/image` no 16.4.6.** O upgrade
  expôs um aviso de hydration nos cards de produto: o servidor renderiza
  `loading="eager"` e o cliente `loading="lazy"` nas imagens via `next/image`
  (ex.: `ProductCard`). O teste "routes, images and responsive layout" passa de
  forma estável no 16.3.8 e passa a falhar intermitentemente no 16.4.6 por causa
  desse aviso no console. Impacto: aviso de console e possível carregamento eager
  de imagens abaixo da dobra; não quebra funcionalidade nem segurança. Correção
  recomendada (no fluxo de integração): declarar `loading`/`priority` explícito
  nas imagens de `ProductCard` ou usar `suppressHydrationWarning`.
- **Teste de carrinho pré-existente.** O teste "cart quantities, variants, stock
  ceiling, persistence and removal" falha (esperava quantidade 2 após recarga,
  recebeu 1) de forma **idêntica no 16.3.8 e no 16.4.6** — portanto, é um defeito
  pré-existente no fluxo de persistência do carrinho, não causado pelo upgrade.
- **Dependências com `latest` no `package.json`.** `lucide-react` e `zustand`
  (produção) e diversas de desenvolvimento usam `latest`. Para publicação, fixe
  versões e revogue o `latest` em produção.

