import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error(
    "Ejecuta npm.cmd run yappy:configure -- --live en tu terminal.",
  );
  process.exit(1);
}
const live = process.argv.includes("--live");
const siteIndex = process.argv.indexOf("--site");
const site = siteIndex < 0 ? "business" : process.argv[siteIndex + 1];
try {
  if (!["business", "retail"].includes(site)) throw Error();
  const domain =
    site === "business"
      ? "https://portal.mytripsim.com"
      : "https://www.mytripsim.com";
  const prefix = `YAPPY_${site.toUpperCase()}_${live ? "LIVE" : "TEST"}_`;
  console.log(
    `Yappy Comercial: introduce el ID y la clave secreta del botón configurado para ${domain}. La entrada queda oculta. No se crearán transacciones.`,
  );
  const output = new Writable({
    write(_c, _e, callback) {
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
        reject(Error());
      });
      prompt.question("", (answer) => {
        prompt.close();
        resolve(answer.trim());
      });
    });
  }
  const merchant = await ask("ID del comercio: "),
    secret = await ask("Clave secreta: ");
  const testPhone = live
    ? null
    : await ask(
        "Teléfono registrado para pruebas Yappy (8 dígitos, sin prefijo): ",
      );
  if (testPhone !== null && !/^\d{8}$/.test(testPhone)) throw Error();
  const bytes = Buffer.from(secret, "base64"),
    decoded = bytes.toString("utf8");
  if (
    !/^[A-Za-z0-9_-]{3,200}$/.test(merchant) ||
    !secret ||
    secret.length > 8192 ||
    bytes.toString("base64") !== secret ||
    !Buffer.from(decoded).equals(bytes) ||
    !decoded.split(".")[0] ||
    /[\u0000-\u001f\u007f]/.test(decoded.split(".")[0])
  )
    throw Error();
  let content = existsSync(".env.local")
    ? readFileSync(".env.local", "utf8")
    : "";
  const values = [
    [prefix + "MERCHANT_ID", merchant],
    [prefix + "SECRET", secret],
    [`YAPPY_${site.toUpperCase()}_DOMAIN`, domain],
  ];
  if (testPhone) values.push([prefix + "ALIAS_YAPPY", testPhone]);
  for (const [name, value] of values) {
    const line = name + "=" + JSON.stringify(value),
      pattern = new RegExp("^" + name + "=.*$", "m");
    content = pattern.test(content)
      ? content.replace(pattern, () => line)
      : content.trimEnd() + "\n" + line + "\n";
  }
  writeFileSync(".env.local.tmp", content, { mode: 0o600 });
  renameSync(".env.local.tmp", ".env.local");
  console.log(
    "\nConfiguración guardada fuera de Git. No se han activado cobros ni creado transacciones.",
  );
} catch {
  console.error(
    "\nConfiguración cancelada o datos inválidos; no se imprimieron credenciales.",
  );
  process.exitCode = 1;
}
