import { spawnSync } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const result = spawnSync("npm", ["run", "desktop:p5:live-smoke"], {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env
});

if (result.error) throw result.error;
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
