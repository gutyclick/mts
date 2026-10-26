import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { testSecret } from "./lib/stripe-catalog.mjs";

const live = process.argv.includes("--live");
if (process.argv.slice(2).some((arg) => arg !== "--live"))
  throw new Error("Unknown option");
if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error("Ejecuta npm.cmd run stripe:configure en tu propia terminal.");
  process.exit(1);
}
try {
  console.log(
    live
      ? "Stripe PRODUCCIÓN: introduce la clave secreta y luego la publicable. Ambas entradas están ocultas."
      : "Stripe: introduce una clave secreta de PRUEBAS (sk_test_ o rk_test_). La entrada está oculta.",
  );
  const output = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  async function ask(label) {
    process.stdout.write(label);
    const prompt = createInterface({
      input: process.stdin,
      output,
      terminal: true,
    });
    return await new Promise((resolve, reject) => {
      prompt.once("SIGINT", () => {
        prompt.close();
        reject(new Error("Cancelled"));
      });
      prompt.question("", (answer) => {
        prompt.close();
        resolve(answer.trim());
      });
    });
  }
  const key = await ask(
    live ? "Clave secreta de producción: " : "Clave de pruebas: ",
  );
  if (live) {
    if (!/^(sk|rk)_live_[a-zA-Z0-9]{16,}$/.test(key))
      throw new Error("Invalid live key");
  } else testSecret(key);
  const publicKey = live ? await ask("Clave publicable de producción: ") : null;
  if (live && !/^pk_live_[a-zA-Z0-9]{16,}$/.test(publicKey))
    throw new Error("Invalid publishable key");
  let content = existsSync(".env.local")
    ? readFileSync(".env.local", "utf8")
    : "";
  for (const [name, value] of live
    ? [
        ["STRIPE_LIVE_SECRET_KEY", key],
        ["STRIPE_LIVE_PUBLISHABLE_KEY", publicKey],
      ]
    : [["STRIPE_TEST_SECRET_KEY", key]]) {
    const line = name + "=" + JSON.stringify(value);
    const existing = new RegExp("^" + name + "=.*$", "m");
    content = existing.test(content)
      ? content.replace(existing, () => line)
      : content.trimEnd() + "\n" + line + "\n";
  }
  writeFileSync(".env.local.tmp", content, { mode: 0o600 });
  renameSync(".env.local.tmp", ".env.local");
  console.log(
    "\nClave guardada en .env.local, fuera de Git. No se han creado productos ni cobros.",
  );
} catch {
  console.error(
    "\nConfiguración cancelada o clave no válida. No se imprimieron credenciales.",
  );
  process.exitCode = 1;
}
