import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
try {
  const value = JSON.parse(
    readFileSync("private-data/business-portal/contact.json", "utf8"),
  );
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email) ||
    !/^\+[1-9][0-9]{7,14}$/.test(value.whatsapp)
  )
    throw Error();
  const entries = {
    B2B_SUPPORT_EMAIL: value.email,
    B2B_SUPPORT_WHATSAPP: value.whatsapp,
  };
  const path = ".env.local";
  let existing = readFileSync(path, "utf8");
  for (const [key, data] of Object.entries(entries)) {
    existing = existing.replace(new RegExp(`^${key}=.*\\r?\\n?`, "gm"), "");
    existing += `\n${key}=${data}\n`;
  }
  writeFileSync(path, existing);
  if (process.argv.includes("--deploy")) {
    const cli = process.env.VERCEL_CLI_PATH;
    if (!cli) throw Error();
    for (const [key, data] of Object.entries(entries)) {
      const result = spawnSync(
        process.execPath,
        [
          cli,
          "env",
          "add",
          key,
          "--environment",
          "production",
          "--sensitive",
          "--force",
          "--yes",
          "--project",
          "mts",
          "--scope",
          "guzzfirec-1094s-projects",
        ],
        { input: data + "\n", encoding: "utf8", windowsHide: true },
      );
      if (result.status !== 0) throw Error();
    }
  }
  console.log(
    "Private business support configured server-side. No contact values printed.",
  );
} catch {
  console.error("Business contact setup stopped; no private values printed.");
  process.exitCode = 1;
}
