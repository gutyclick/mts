// Operator-only: send credentials through stdin to Vercel's encrypted secret store.
import { loadEnvFile } from "node:process";
import { appendFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { esimAccessConfig } from "../src/lib/integrations/esimaccess-api.ts";

loadEnvFile(".env.local");
try {
  const config = esimAccessConfig(process.env);
  if (!config) throw new Error("Missing provider configuration");
  let syncSecret = process.env.ESIM_ACCESS_SYNC_SECRET;
  if (!syncSecret) {
    syncSecret = randomBytes(32).toString("hex");
    appendFileSync(
      ".env.local",
      `\nESIM_ACCESS_SYNC_SECRET=${JSON.stringify(syncSecret)}\n`,
    );
  }
  if (syncSecret.length < 32 || /\s/.test(syncSecret))
    throw new Error("Invalid worker configuration");
  for (const [name, value] of [
    ["ESIM_ACCESS_CODE", config.accessCode],
    ["ESIM_ACCESS_SECRET_KEY", config.secretKey],
    ["ESIM_ACCESS_SYNC_SECRET", syncSecret],
  ]) {
    const result = spawnSync(
      process.env.ComSpec || "cmd.exe",
      [
        "/d",
        "/s",
        "/c",
        `npx.cmd --yes vercel env add ${name} --environment production --sensitive --force --yes --project mts --scope guzzfirec-1094s-projects`,
      ],
      { input: value, encoding: "utf8", maxBuffer: 1024 * 1024 },
    );
    if (result.status !== 0)
      throw new Error("Vercel secret configuration failed");
    console.log(`${name}: configurada como secreto de producción.`);
  }
  console.log(
    "Credenciales transmitidas sin imprimir valores. No se han añadido a previews ni al navegador.",
  );
} catch {
  console.error(
    "No se pudo completar la configuración privada de Vercel. Comprueba el acceso a mts; no pegues claves en el chat.",
  );
  process.exitCode = 1;
}
