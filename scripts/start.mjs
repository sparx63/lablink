#!/usr/bin/env node
/**
 * Production start for LabLink.
 * next.config uses `output: "standalone"` — plain `next start` does not serve
 * static CSS/JS correctly and breaks after mid-flight rebuilds. Mirror the
 * Dockerfile layout, then run the standalone server.
 */
import { cpSync, existsSync, mkdirSync } from "fs";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standalone = path.join(root, ".next", "standalone");
const standaloneNext = path.join(standalone, ".next");
const staticSrc = path.join(root, ".next", "static");
const staticDest = path.join(standaloneNext, "static");
const publicSrc = path.join(root, "public");
const publicDest = path.join(standalone, "public");
const serverJs = path.join(standalone, "server.js");

if (!existsSync(serverJs) || !existsSync(staticSrc)) {
  console.error("Missing production build. Run `npm run build` first.");
  process.exit(1);
}

mkdirSync(standaloneNext, { recursive: true });
cpSync(staticSrc, staticDest, { recursive: true });
if (existsSync(publicSrc)) {
  cpSync(publicSrc, publicDest, { recursive: true });
}

const port = process.env.PORT || "3000";
const child = spawn(process.execPath, [serverJs], {
  cwd: standalone,
  env: {
    ...process.env,
    PORT: port,
    HOSTNAME: process.env.HOSTNAME || "0.0.0.0",
    LABLINK_DATA_DIR: process.env.LABLINK_DATA_DIR || path.join(root, ".data"),
  },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
