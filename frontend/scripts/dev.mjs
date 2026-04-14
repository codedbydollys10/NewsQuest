import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const port = process.env.PORT || "4000";
const host = "localhost";
const viteBin = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));

console.log(`Login page: http://${host}:${port}/login`);

const child = spawn(process.execPath, [viteBin], {
  stdio: "inherit",
  env: process.env,
});

child.on("close", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
