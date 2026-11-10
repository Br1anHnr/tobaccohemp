#!/usr/bin/env node
/**
 * Tobacco Hemp — Verificação automatizada de segurança (somente leitura).
 *
 * Executa checagens estáticas sobre os arquivos versionados do repositório e,
 * opcionalmente, `npm audit` (somente leitura) quando `--deps` é informado.
 *
 * Uso:
 *   node scripts/security-audit.mjs [--deps] [--strict] [--json]
 *
 * Sem efeitos colaterais no código. Arquivos `.env*` são tratados apenas pela
 * checagem de versionamento (via `git ls-files`), nunca pelo conteúdo — o que
 * evita ler credenciais reais.
 *
 * Códigos de saída:
 *   0 — nenhum erro (avisos são informativos, exceto com --strict)
 *   1 — erros encontrados (ou avisos com --strict)
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";
const args = process.argv.slice(2);
const WANT_DEPS = args.includes("--deps");
const STRICT = args.includes("--strict");
const JSON_OUT = args.includes("--json");

const findings = [];
const info = [];

function add(severity, rule, file, line, detail) {
  findings.push({ severity, rule, file, line: line ?? null, detail });
}

function note(message) {
  info.push(message);
}

// 1) Arquivos versionados (via git, sem tocar o working tree).
let tracked = [];
try {
  const res = spawnSync("git", ["ls-files", "-z"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  tracked = (res.stdout ?? "").split("\0").filter(Boolean);
  if (!tracked.length) {
    note("git não retornou arquivos versionados; a varredura ficou incompleta.");
  }
} catch {
  note("git indisponível; a varredura de arquivos versionados ficou incompleta.");
}

const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|css)$/i;
// A varredura de conteúdo foca no código-fonte da aplicação (src/). Isso evita
// falsos positivos em documentação (.md) e no próprio script, que citam os
// padrões pesquisados (ex.: "dangerouslySetInnerHTML" ou "http://").
const isAppSource = (p) => p.startsWith("src/") && TEXT_EXT.test(p);

// 2) Versionamento de arquivos de ambiente.
for (const p of tracked) {
  if (/^\.env/.test(basename(p)) && basename(p) !== ".env.example") {
    add(
      "error",
      "env-tracked",
      p,
      null,
      "Arquivo .env versionado. Mantenha apenas .env.example no repositório.",
    );
  }
}

// 3) Varredura de conteúdo do código-fonte (src/).
const SECRET_RE =
  /(api[_-]?key|apikey|secret|password|passwd|access[_-]?token|auth[_-]?token|private[_-]?key)\b\s*[:=]\s*["'][^"'\n]{8,}["']/i;
const PLACEHOLDER_RE =
  /(example|your[_-]?|changeme|xxx+|<[^>]+>|\.\.\.|placeholder|dummy|fake)/i;

for (const p of tracked.filter(isAppSource)) {
  let text;
  try {
    text = readFileSync(join(ROOT, p), "utf8");
  } catch {
    continue;
  }
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    const n = i + 1;
    if (SECRET_RE.test(line)) {
      const match = line.match(SECRET_RE)?.[0] ?? "";
      if (!PLACEHOLDER_RE.test(match)) {
        add("error", "hardcoded-secret", p, n, "Possível credencial embutida no código.");
      }
    }
    if (/\bdangerouslySetInnerHTML\b/.test(line)) {
      add("error", "xss-dangerously", p, n, "Uso de dangerouslySetInnerHTML (risco de XSS).");
    }
    if (/\binnerHTML\s*=/.test(line)) {
      add("warning", "xss-innerhtml", p, n, "Atribuição a innerHTML; prefira textContent ou React.");
    }
    if (/\beval\s*\(/.test(line) || /\bnew\s+Function\s*\(/.test(line)) {
      add("error", "dynamic-eval", p, n, "Execução dinâmica de código (eval/new Function).");
    }
    if (/(href|src)\s*[:=]\s*["']javascript:/i.test(line)) {
      add("error", "xss-js-url", p, n, "URL javascript: em href/src.");
    }
    if (/http:\/\/(?!127\.0\.0\.1|localhost)/i.test(line)) {
      add("warning", "mixed-content", p, n, "Referência http:// (não local); use https.");
    }
  });
}

// 4) Cabeçalhos / configuração do Next.
const nextConfigPath = join(ROOT, "next.config.ts");
if (existsSync(nextConfigPath)) {
  const cfg = readFileSync(nextConfigPath, "utf8");
  if (!/poweredByHeader\s*:\s*false/.test(cfg)) {
    add(
      "warning",
      "security-headers",
      "next.config.ts",
      null,
      "poweredByHeader não está desabilitado como false.",
    );
  }
}

// 5) Pinning de dependências.
const pkgPath = join(ROOT, "package.json");
if (existsSync(pkgPath)) {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  for (const group of ["dependencies", "devDependencies", "optionalDependencies"]) {
    for (const [name, spec] of Object.entries(pkg[group] ?? {})) {
      if (typeof spec === "string" && (/^latest$/i.test(spec) || spec === "*")) {
        add(
          "warning",
          "unpinned-dependency",
          "package.json",
          null,
          `Dependência "${name}" usa "${spec}"; fixe uma versão em produção.`,
        );
      }
    }
  }
}

// 6) Dependências conhecidas (opcional, com rede).
function summarizeAudit(text) {
  try {
    const report = JSON.parse(text);
    const meta = report.metadata?.vulnerabilities ?? {};
    const total = meta.total ?? 0;
    const critical = meta.critical ?? 0;
    const high = meta.high ?? 0;
    if (total > 0) {
      add(
        "error",
        "npm-audit",
        "npm audit --omit=dev",
        null,
        `${total} pacote(s) vulnerável(is) em produção — ${critical} crítica(s), ${high} alta(s). Execute npm audit --omit=dev para detalhes.`,
      );
    } else {
      note("npm audit --omit=dev: zero vulnerabilidades de produção.");
    }
  } catch {
    add(
      "warning",
      "npm-audit",
      "npm audit --omit=dev",
      null,
      "Não foi possível interpretar o resultado do npm audit.",
    );
  }
}

if (WANT_DEPS) {
  const res = spawnSync(NPM, ["audit", "--omit=dev", "--json"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === "win32",
  });
  const stdout = typeof res.stdout === "string" ? res.stdout : "";
  if (stdout.trim()) {
    summarizeAudit(stdout);
  } else {
    note(
      res.error
        ? "npm audit --omit=dev indisponível (npm não encontrado ou sem rede)."
        : "npm audit --omit=dev não retornou saída.",
    );
  }
}

// Relatório.
const errors = findings.filter((f) => f.severity === "error");
const warnings = findings.filter((f) => f.severity === "warning");

if (JSON_OUT) {
  console.log(JSON.stringify({ errors, warnings, info }, null, 2));
} else {
  const lines = [];
  lines.push("== Segurança Tobacco Hemp ==");
  lines.push(`Arquivos analisados: ${tracked.length}`);
  lines.push(`Erros: ${errors.length} | Avisos: ${warnings.length}`);
  if (info.length) {
    lines.push("");
    for (const m of info) lines.push(`[info] ${m}`);
  }
  if (findings.length) {
    lines.push("");
    for (const f of findings) {
      const loc = f.line ? `${f.file}:${f.line}` : f.file;
      lines.push(`[${f.severity.toUpperCase()}] ${f.rule} — ${loc}: ${f.detail}`);
    }
  }
  console.log(lines.join("\n"));
}

const failed = errors.length > 0 || (STRICT && warnings.length > 0);
process.exit(failed ? 1 : 0);
