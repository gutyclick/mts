import { createInterface } from "node:readline/promises";
import { readFileSync, writeFileSync, renameSync } from "node:fs";
if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error("Ejecuta npm.cmd run yappy:fees en tu terminal.");
  process.exit(1);
}
const input = createInterface({ input: process.stdin, output: process.stdout });
try {
  console.log(
    "Tarifa contractual TOTAL de Yappy para la web pública, incluyendo impuestos aplicables a la comisión. No la deduzcas de una sola transacción. Esto no activa pagos.",
  );
  const percent = (
    await input.question("Porcentaje efectivo confirmado (ej. 1 para 1%): ")
  ).trim();
  const fixed = (
    await input.question("Cargo fijo efectivo en USD (ej. 0.00): ")
  ).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(percent) || !/^\d+(\.\d{1,2})?$/.test(fixed))
    throw Error();
  const bps = Math.round(Number(percent) * 100),
    cents = Math.round(Number(fixed) * 100);
  if (bps > 5000 || cents > 10000) throw Error();
  if (
    (
      await input.question(
        "Escribe CONFIRMO si estos valores están respaldados por tu tarifa de Yappy: ",
      )
    ).trim() !== "CONFIRMO"
  )
    throw Error();
  let content = readFileSync(".env.local", "utf8");
  for (const [key, value] of [
    ["YAPPY_RETAIL_FEE_BPS", String(bps)],
    ["YAPPY_RETAIL_FIXED_CENTS", String(cents)],
    ["YAPPY_RETAIL_FEES_CONFIRMED", "true"],
  ]) {
    const line = key + "=" + JSON.stringify(value),
      pattern = new RegExp("^" + key + "=.*$", "m");
    content = pattern.test(content)
      ? content.replace(pattern, () => line)
      : content.trimEnd() + "\n" + line + "\n";
  }
  writeFileSync(".env.local.tmp", content, { mode: 0o600 });
  renameSync(".env.local.tmp", ".env.local");
  console.log("Tarifa guardada fuera de Git. Los cobros no se han activado.");
} catch {
  console.error(
    "Configuración cancelada o valores inválidos; no se activaron cobros.",
  );
  process.exitCode = 1;
} finally {
  input.close();
}
