import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
process.loadEnvFile(".env.local");
try {
  if (process.argv.includes("--start")) {
    const db = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_CHECKOUT_SECRET_KEY,
        { auth: { persistSession: false } },
      ),
      { data, error } = await db.rpc("configure_support_worker");
    if (error || data !== true) throw new Error();
    console.log("Support notification scheduler enabled.");
  } else {
    const ai =
      process.env.SUPPORT_AI_ENABLED === "true" &&
      /^sk-[A-Za-z0-9_-]{20,4096}$/.test(process.env.OPENAI_API_KEY ?? "");
    const values = {
      SUPPORT_AI_ENABLED: String(ai),
      SUPPORT_INBOX_EMAIL: "hello@mytripsim.com",
      OPENAI_SUPPORT_MODEL: "gpt-5-nano-2025-08-07",
      SUPPORT_DAILY_CHAT_LIMIT: "300",
      ...(ai ? { OPENAI_API_KEY: process.env.OPENAI_API_KEY } : {}),
    };
    for (const [name, value] of Object.entries(values)) {
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
          maxBuffer: 1024 * 1024,
          windowsHide: true,
        },
      );
      if (r.status !== 0) throw new Error();
      console.log(`${name}: configured privately.`);
    }
    console.log(
      ai
        ? "AI configured. Deploy before starting notifications."
        : "Tickets configured; AI remains disabled until the project key is entered.",
    );
  }
} catch {
  console.error("Support setup failed. No credentials printed.");
  process.exitCode = 1;
}
