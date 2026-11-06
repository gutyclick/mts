import { spawn } from "node:child_process";
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    process.env.CATALOG_PREVIEW_PORT ?? "3004",
  ],
  {
    stdio: "inherit",
    windowsHide: true,
    env: { ...process.env, CATALOG_REDESIGN_PREVIEW: "true" },
  },
);
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => child.kill(signal));
