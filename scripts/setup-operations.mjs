// Operator-only setup. Never print webhook secrets, CLI output or environment values.
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const endpoint = "https://www.mytripsim.com/api/webhooks/resend";
const events = [
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.complained",
  "email.failed",
  "email.suppressed",
];
const idPattern = /^[a-f0-9-]{36}$/i;
function save(name, value) {
  let content = readFileSync(".env.local", "utf8");
  const line = `${name}=${JSON.stringify(value)}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  content = pattern.test(content)
    ? content.replace(pattern, () => line)
    : `${content.trimEnd()}\n${line}\n`;
  writeFileSync(".env.local.tmp", content, { mode: 0o600 });
  renameSync(".env.local.tmp", ".env.local");
  process.env[name] = value;
}
function command(text, input, resend = false) {
  const env = { ...process.env };
  // The application's sending-only key cannot administer webhooks; use the operator's stored CLI login.
  if (resend) delete env.RESEND_API_KEY;
  const result = spawnSync(
    process.env.ComSpec || "cmd.exe",
    ["/d", "/s", "/c", text],
    {
      env,
      input,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 2 * 1024 * 1024,
    },
  );
  if (result.status !== 0) throw Error("Operator command failed");
  return result.stdout;
}
function resend(text) {
  return JSON.parse(
    command(
      `npx.cmd --yes resend-cli webhooks ${text} --quiet`,
      undefined,
      true,
    ),
  );
}
let stage = "mode validation";
try {
  const mode = process.argv[2];
  if (mode === "--prepare") {
    stage = "webhook inventory";
    const list = resend("list --limit 100");
    if (list.has_more) throw Error("Review full webhook inventory first");
    const matches = list.data.filter((x) => x.endpoint === endpoint);
    if (matches.length > 1) throw Error("Duplicate endpoint requires review");
    if (!matches.length) {
      stage = "webhook creation";
      const created = resend(
        `create --endpoint ${endpoint} --events ${events.join(" ")}`,
      );
      if (
        !idPattern.test(created.id) ||
        !/^whsec_[A-Za-z0-9+/=_-]+$/.test(created.signing_secret ?? "")
      )
        throw Error("Invalid webhook response");
      // Persist immediately: creation is the only guaranteed opportunity to retrieve this secret.
      save("RESEND_WEBHOOK_ID", created.id);
      save("RESEND_WEBHOOK_SECRET", created.signing_secret);
      stage = "webhook suspension until release";
      resend(`update ${created.id} --status disabled`);
    } else {
      const existing = matches[0];
      if (
        process.env.RESEND_WEBHOOK_ID !== existing.id ||
        !process.env.RESEND_WEBHOOK_SECRET?.startsWith("whsec_")
      )
        throw Error(
          "Existing webhook secret requires operator recovery; not replacing endpoint",
        );
    }
    save("OPERATIONS_ENABLED", "true");
    console.log(
      "Operations webhook prepared privately. Deploy before activation.",
    );
  } else if (mode === "--deploy-env") {
    stage = "environment validation";
    if (!process.env.RESEND_WEBHOOK_SECRET?.startsWith("whsec_"))
      throw Error("Prepare webhook first");
    for (const [name, value] of Object.entries({
      RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET,
      OPERATIONS_ENABLED: "true",
    })) {
      stage = `deploy ${name}`;
      command(
        `npx.cmd --yes vercel env add ${name} --environment production --sensitive --force --yes --project mts --scope guzzfirec-1094s-projects`,
        value,
      );
      console.log(`${name}: configured privately.`);
    }
  } else if (mode === "--activate") {
    stage = "release health";
    const response = await fetch(endpoint, {
      method: "POST",
      body: "{}",
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    if (response.status !== 400)
      throw Error("Signed webhook route is not ready");
    const id = process.env.RESEND_WEBHOOK_ID;
    if (!idPattern.test(id ?? "")) throw Error("Webhook id unavailable");
    stage = "database configuration";
    const db = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_CHECKOUT_SECRET_KEY,
      { auth: { persistSession: false } },
    );
    const { error, data } = await db.rpc("configure_operations_worker", {
      p_recipient: "gustavo@mytripsim.com",
      p_threshold: 200000,
    });
    if (error || data !== true) throw Error("Operations scheduler unavailable");
    stage = "webhook activation";
    resend(`update ${id} --status enabled --events ${events.join(" ")}`);
    console.log(
      "Operational monitoring enabled: approved recipient, USD 20 threshold, five-minute schedule. No test email sent.",
    );
  } else throw Error("Use --prepare, --deploy-env or --activate");
} catch {
  console.error(
    `Operations setup stopped at ${stage}. No credentials printed.`,
  );
  process.exitCode = 1;
}
