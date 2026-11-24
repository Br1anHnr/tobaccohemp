import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve, dirname, join, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { createServer } from "node:net";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { Client } from "pg";

// Never read .env or inherit a database connection. No Docker or remote service.
const server = createServer();
await new Promise(done => server.listen(0, "127.0.0.1", done));
const port = server.address().port;
await new Promise(done => server.close(done));
const root = resolve(".preview-validation");
mkdirSync(root, { recursive: true });
const directory = mkdtempSync(join(root, "asaas-pg-"));
// Verify the exact absolute recursive-cleanup target remains inside our workspace.
if (!directory.startsWith(root + sep)) throw new Error("Invalid disposable database directory");
const dataDir = join(directory,"data");
const passwordFile = join(directory,"synthetic-password");
writeFileSync(passwordFile,"synthetic-local-only\n");
const platform = process.platform === "win32" ? "windows" : process.platform;
const binaries = await import(`@embedded-postgres/${platform}-${process.arch}`);
const {hydrateSymlinks} = await import(pathToFileURL(resolve(dirname(binaries.postgres),"..","..","scripts","hydrate-symlinks.js")).href);
await hydrateSymlinks();
const run = promisify(execFile);
const execute = (file,args) => run(file,args,{windowsHide:true,timeout:30_000});
let started = false;
let code = 1;
try {
  await execute(binaries.initdb,["-D",dataDir,"--auth=scram-sha-256","--username=sandbox_test",`--pwfile=${passwordFile}`,"--locale=C"]);
  await execute(binaries.pg_ctl,["-D",dataDir,"-l",join(directory,"postgres.log"),"-o",`-h 127.0.0.1 -p ${port}`,"-w","-t","15","start"]);
  started = true;
  const connection = new Client({host:"127.0.0.1",port,user:"sandbox_test",password:"synthetic-local-only",database:"postgres"});
  await connection.connect();
  try {
    await connection.query("CREATE DATABASE asaas_disposable");
    await connection.query("CREATE DATABASE asaas_isolated_disposable");
  } finally {await connection.end();}
  const child = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "--config", "playwright.sandbox.config.ts"], {
    stdio: "inherit", env: { ...process.env, NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "", APP_ORIGIN: "", ADMIN_ENABLED: "", DATABASE_URL: `postgresql://sandbox_test:synthetic-local-only@127.0.0.1:${port}/asaas_disposable`, ASAAS_DISPOSABLE_TEST: "1",
      ASAAS_TEST_ISOLATED_DATABASE_URL: `postgresql://sandbox_test:synthetic-local-only@127.0.0.1:${port}/asaas_isolated_disposable`,
      ASAAS_SANDBOX_ENABLED: "1", ASAAS_SANDBOX_DATASET: "synthetic", ASAAS_SANDBOX_API_KEY: "synthetic-api-key-never-valid", ASAAS_SANDBOX_WEBHOOK_TOKEN: "synthetic-webhook-token-at-least-32-characters", ASAAS_SANDBOX_CUSTOMER_ID: "cus_synthetic", ASAAS_SANDBOX_PRODUCT_IDS: "sandbox-accessory" },
  });
  code = await new Promise(done => child.once("exit", value => done(value ?? 1)));
} finally {
  // Graceful pg_ctl shutdown avoids orphaned Windows PostgreSQL I/O workers.
  if (started) {
    await execute(binaries.pg_ctl,["-D",dataDir,"-m","fast","-w","-t","15","stop"]);
    rmSync(directory,{recursive:true,force:true});
  }
}
process.exitCode = code;
