import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { readFileSync, writeFileSync, renameSync } from "node:fs";
if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error("Ejecuta npm.cmd run support:configure en tu propia terminal.");
  process.exit(1);
}
try {
  console.log(
    "OpenAI para SIM: introduce una clave de proyecto. La entrada está oculta.",
  );
  process.stdout.write("Clave API: ");
  const prompt = createInterface({
    input: process.stdin,
    output: new Writable({
      write(_c, _e, cb) {
        cb();
      },
    }),
    terminal: true,
  });
  const key = await new Promise((resolve, reject) => {
    prompt.once("SIGINT", () => {
      prompt.close();
      reject(new Error("Cancelled"));
    });
    prompt.question("", (value) => {
      prompt.close();
      resolve(value.trim());
    });
  });
  if (typeof key !== "string" || !/^sk-[A-Za-z0-9_-]{20,4096}$/.test(key))
    throw new Error("Invalid key");
  const values = {
    OPENAI_API_KEY: key,
    OPENAI_SUPPORT_MODEL: "gpt-5.4-mini-2026-03-17",
    SUPPORT_INBOX_EMAIL: "hello@mytripsim.com",
    SUPPORT_AI_ENABLED: "true",
  };
  let content = readFileSync(".env.local", "utf8");
  for (const [name, value] of Object.entries(values)) {
    const line = `${name}=${JSON.stringify(value)}`,
      pattern = new RegExp(`^${name}=.*$`, "m");
    content = pattern.test(content)
      ? content.replace(pattern, () => line)
      : `${content.trimEnd()}\n${line}\n`;
  }
  writeFileSync(".env.local.tmp", content, { mode: 0o600 });
  renameSync(".env.local.tmp", ".env.local");
  console.log(
    "\nConfiguración guardada fuera de Git. No se imprimieron claves ni se enviaron mensajes. Avisa al terminar para verificar y desplegar.",
  );
} catch {
  console.error(
    "\nConfiguración cancelada o clave inválida. No se imprimieron credenciales.",
  );
  process.exitCode = 1;
}
