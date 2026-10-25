import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
process.loadEnvFile(".env.local");
// Keep the application's sending-only key out of administrative CLI requests.
const operatorEnvironment = { ...process.env };
delete operatorEnvironment.RESEND_API_KEY;
const run = (command, input) =>
  spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", command], {
    input,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    env: operatorEnvironment,
  });
try {
  if (process.argv.includes("--start")) {
    const db = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_CHECKOUT_SECRET_KEY,
      { auth: { persistSession: false } },
    );
    const { data, error } = await db.rpc("configure_esim_fulfillment_worker");
    if (error || data !== true) throw new Error();
    console.log(
      "Fulfillment scheduler enabled. Only confirmed live payments or individually authorized QA units are eligible.",
    );
  } else {
    const domains = run("npx.cmd --yes resend-cli domains list --quiet");
    if (domains.status !== 0) throw new Error();
    const domain = JSON.parse(domains.stdout).data?.find(
      (d) => d.name === "mytripsim.com" && d.status === "verified",
    );
    if (!domain) throw new Error();
    let key = process.env.RESEND_API_KEY;
    if (!key) {
      const result = run(
        `npx.cmd --yes resend-cli api-keys create --name MyTripSim-eSIM-delivery --permission sending_access --domain-id ${domain.id} --quiet`,
      );
      if (result.status !== 0) throw new Error();
      key = JSON.parse(result.stdout).token;
      if (!key?.startsWith("re_")) throw new Error();
    }
    const secret =
      process.env.FULFILLMENT_LINK_SECRET || randomBytes(32).toString("hex");
    const values = {
      RESEND_API_KEY: key,
      FULFILLMENT_LINK_SECRET: secret,
      FULFILLMENT_ENABLED: "true",
    };
    let content = readFileSync(".env.local", "utf8");
    for (const [name, value] of Object.entries(values)) {
      const line = `${name}=${JSON.stringify(value)}`;
      content = new RegExp(`^${name}=.*$`, "m").test(content)
        ? content.replace(new RegExp(`^${name}=.*$`, "m"), line)
        : `${content.trimEnd()}\n${line}\n`;
    }
    writeFileSync(".env.local.tmp", content, { mode: 0o600 });
    renameSync(".env.local.tmp", ".env.local");
    for (const [name, value] of Object.entries(values)) {
      const result = run(
        `npx.cmd --yes vercel env add ${name} --environment production --sensitive --force --yes --project mts --scope guzzfirec-1094s-projects`,
        value,
      );
      if (result.status !== 0) throw new Error();
      console.log(`${name}: configured privately.`);
    }
    console.log(
      "Verified sending domain; scoped sending-only key and private delivery links configured. No email sent. Deploy before starting the scheduler.",
    );
  }
} catch {
  console.error("Fulfillment configuration failed. No credentials printed.");
  process.exitCode = 1;
}
