import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { testSecret } from "./lib/stripe-catalog.mjs";

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error("Ejecuta npm.cmd run stripe:configure en tu propia terminal.");
  process.exit(1);
}
try {
  console.log(
    "Stripe: introduce una clave secreta de PRUEBAS (sk_test_ o rk_test_). La entrada está oculta.",
  );
  process.stdout.write("Clave de pruebas: ");
  const output = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  const prompt = createInterface({
    input: process.stdin,
    output,
    terminal: true,
  });
  const key = await new Promise((resolve, reject) => {
    prompt.once("SIGINT", () => {
      prompt.close();
      reject(new Error("Cancelled"));
    });
    prompt.question("", (answer) => {
      prompt.close();
      resolve(answer.trim());
    });
  });
  testSecret(key);
  let content = existsSync(".env.local")
    ? readFileSync(".env.local", "utf8")
    : "";
  const line = `STRIPE_TEST_SECRET_KEY=${JSON.stringify(key)}`;
  const existing = /^STRIPE_TEST_SECRET_KEY=.*$/m;
  content = existing.test(content)
    ? content.replace(existing, () => line)
    : `${content.trimEnd()}\n${line}\n`;
  writeFileSync(".env.local.tmp", content, { mode: 0o600 });
  renameSync(".env.local.tmp", ".env.local");
  console.log(
    "\nClave guardada en .env.local, fuera de Git. No se han creado productos ni cobros.",
  );
} catch {
  console.error(
    "\nConfiguración cancelada o clave de pruebas no válida. No se imprimieron credenciales.",
  );
  process.exitCode = 1;
}
