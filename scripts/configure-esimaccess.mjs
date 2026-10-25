// Run interactively: credentials are never printed or passed as command arguments.
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { readFileSync, writeFileSync, renameSync } from "node:fs";

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error(
    "Run npm.cmd run provider:configure in your own terminal. Do not pipe credentials.",
  );
  process.exit(1);
}
async function secret(label) {
  process.stdout.write(label);
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
  return await new Promise((resolve, reject) => {
    prompt.once("SIGINT", () => {
      prompt.close();
      process.stdout.write("\n");
      reject(new Error("Cancelled"));
    });
    prompt.question("", (answer) => {
      prompt.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}
try {
  console.log(
    "eSIM Access: introduce las credenciales de Developer. La entrada está oculta.",
  );
  const accessCode = await secret("AccessCode: ");
  const secretKey = await secret("SecretKey: ");
  if (
    [accessCode, secretKey].some(
      (value) =>
        value.length < 8 || value.length > 4096 || /[\r\n\0]/.test(value),
    )
  )
    throw new Error("Invalid credential format");
  let content = "";
  try {
    content = readFileSync(".env.local", "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  for (const [name, value] of [
    ["ESIM_ACCESS_CODE", accessCode],
    ["ESIM_ACCESS_SECRET_KEY", secretKey],
  ]) {
    const line = `${name}=${JSON.stringify(value)}`;
    const existing = new RegExp(`^${name}=.*$`, "m");
    content = existing.test(content)
      ? content.replace(existing, () => line)
      : `${content.trimEnd()}\n${line}\n`;
  }
  writeFileSync(".env.local.tmp", content, { mode: 0o600 });
  renameSync(".env.local.tmp", ".env.local");
  console.log(
    "Credenciales guardadas en .env.local, fuera de Git. No se ha comprado ninguna eSIM.",
  );
} catch {
  console.error(
    "Configuración cancelada o no válida. No se imprimieron credenciales.",
  );
  process.exitCode = 1;
}
