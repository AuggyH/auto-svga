import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptRoot, "../../../../..");
const child = spawn("npm", ["run", "desktop:dev"], {
  cwd: repoRoot,
  env: {
    ...process.env,
    AUTO_SVGA_P2_NORMAL_PROOF: "1",
    AUTO_SVGA_ACTUAL_LAUNCH_COMMAND: "npm run desktop:dev"
  },
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
