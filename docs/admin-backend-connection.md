# Dashboard conectado ao Neon — desenvolvimento local

A interface administrativa em `/admin` usa as próprias rotas `/api/admin/*` do
Next.js, que persistem em PostgreSQL (Neon) via `pg`. Não há proxy externo,
backend separado nem mocks: o catálogo é semeado a partir de `src/data` e todas
as mutações confirmam no banco. Fora de `development`/`test`, o backend responde
**503** de propósito — esta proteção permanece nesta etapa.

## Pré-requisitos

- Node.js 20.9+ (validado com Node.js 24).
- Uma instância Neon com um banco e uma string de conexão (o pooler serverless é
  recomendado para produção).

## Executar

```powershell
npm.cmd ci
$env:DATABASE_URL = 'postgresql://USER:PASSWORD@HOST/DB?sslmode=require'
$env:ADMIN_PASSWORD = 'synthetic-local-only-password'
npm.cmd run dev
```

Abra http://127.0.0.1:3000/admin. Entre com `admin@example.test` e a senha de
`ADMIN_PASSWORD`. O schema é criado e o catálogo é semeado na primeira requisição
(`src/shared/server/migrate.ts` e `seed.ts`), de forma idempotente.

## Verificar

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
# Integração com o Neon real (cria e limpa um produto E2E por execução):
$env:DATABASE_URL = 'postgresql://USER:PASSWORD@HOST/DB?sslmode=require'
npm.cmd run test:integration
# Regressão visual/loja em porta livre, contra o build local:
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:3220'
$env:CI = '1'
npm.cmd run test:e2e
```

A suíte de integração sobe um único servidor temporário em 3210 (cache em
`.next-integration`), sem reutilizar processos existentes, e valida desktop e
celular: login, rejeição de origem, cookie, cadastro de produto pela interface,
estoque após reload, indicadores, ausência de fallback para mocks, logout e
acessibilidade. Cada execução cria um produto com SKU `E2E-*` e o remove ao
final (via `pg`); os dois produtos `E2E-*` remanescentes da missão anterior
foram removidos manualmente do banco.

## O que falta para um Preview da Vercel (não feito nesta missão)

O bloqueio **503** foi mantido de propósito. Para disponibilizar o dashboard com
autenticação segura em um Preview, ainda é necessário:

1. **Remover o bloqueio 503** de forma controlada (por variável de ambiente de
   deploy, nunca incondicional) e habilitar o backend em produção.
2. **Sessões serverless**: substituir o `Map` em memória
   (`src/modules/auth/infrastructure/admin-auth.ts`) por um token assinado em
   cookie httpOnly ou um armazenamento distribuído (ex.: Upstash/Redis ou
   sessões no banco). O estado atual não sobrevive a cold starts nem escala
   entre instâncias.
3. **Contas e segredos**: trocar a senha única em `ADMIN_PASSWORD` comparada por
   hash por usuários reais com senha hash (bcrypt/argon2), e mover segredos para
   as Environment Variables da Vercel.
4. **Migrações**: executar `migrate.ts`/`seed.ts` em uma etapa de build/CI em vez
   de lazy na primeira requisição de cada cold start.
5. **Driver/conexão**: usar o pooler do Neon (já configurado) ou
   `@neondatabase/serverless` para conexões em ambiente serverless.
6. **Defesa em profundidade**: rate limiting distribuído e, opcionalmente, token
   CSRF (o Origin + `SameSite=Strict` já é uma base válida).

## Resultado desta conexão

- Login, cadastro de produto, edição de estoque e indicadores testados pela
  interface contra o Neon, sem mocks; persistência confirmada após reiniciar o
  servidor.
- Lint, TypeScript e build aprovados.
- Contrato em `src/shared/contracts/admin.ts` é a fonte única dos tipos de rede.
