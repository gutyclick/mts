// Operator-only setup: values never enter command-line arguments or output.
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
process.loadEnvFile(".env.local");
const mode = process.argv[2];
function save(name, value) {
  let content = readFileSync(".env.local", "utf8");
  const pattern = new RegExp(`^${name}=.*$`, "m"),
    line = `${name}=${JSON.stringify(value)}`;
  content = pattern.test(content)
    ? content.replace(pattern, () => line)
    : `${content.trimEnd()}\n${line}\n`;
  writeFileSync(".env.local.tmp", content, { mode: 0o600 });
  renameSync(".env.local.tmp", ".env.local");
  process.env[name] = value;
}
let stage = "mode validation";
try {
  if (mode === "--prepare") {
    if (!process.env.ANALYTICS_HASH_SECRET)
      save("ANALYTICS_HASH_SECRET", randomBytes(32).toString("hex"));
    if (!/^[a-f0-9]{64}$/.test(process.env.ANALYTICS_HASH_SECRET))
      throw Error();
    save("ANALYTICS_ENABLED", "true");
    console.log(
      "Private analytics configuration prepared locally. No collection before consent.",
    );
  } else if (mode === "--deploy-env") {
    if (!/^[a-f0-9]{64}$/.test(process.env.ANALYTICS_HASH_SECRET ?? ""))
      throw Error();
    for (const [name, value] of Object.entries({
      ANALYTICS_HASH_SECRET: process.env.ANALYTICS_HASH_SECRET,
      ANALYTICS_ENABLED: "true",
    })) {
      stage = `configure ${name}`;
      const r = spawnSync(
        process.env.ComSpec || "cmd.exe",
        [
          "/d",
          "/s",
          "/c",
          `npx.cmd --yes vercel env add ${name} --environment production --sensitive --force --yes --project mts --scope guzzfirec-1094s-projects`,
        ],
        {
          input: value,
          encoding: "utf8",
          windowsHide: true,
          maxBuffer: 1048576,
        },
      );
      if (r.status !== 0) throw Error();
      console.log(`${name}: configured privately.`);
    }
  } else if (mode === "--retention") {
    stage = "retention scheduler";
    const db = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_CHECKOUT_SECRET_KEY,
        { auth: { persistSession: false } },
      ),
      r = await db.rpc("configure_analytics_retention");
    if (r.error || r.data !== true) throw Error();
    console.log("Daily private analytics retention scheduled.");
  } else throw Error();
} catch {
  console.error(`Analytics setup stopped at ${stage}. No credentials printed.`);
  process.exitCode = 1;
}
