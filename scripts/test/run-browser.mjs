import { spawnSync } from "node:child_process";
const run = (args, env) => {
  const result = spawnSync("corepack", ["pnpm", ...args], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env,
  });
  if (result.status !== 0)
    throw new Error(`pnpm ${args.join(" ")} failed (${result.status})`);
};
const normal = { ...process.env };
delete normal.AIA_API_INTERNAL_URL;
let failed;
try {
  run(["build"], {
    ...process.env,
    AIA_API_INTERNAL_URL: "http://127.0.0.1:4522",
  });
  run(["exec", "playwright", "test"], process.env);
} catch (error) {
  failed = error;
} finally {
  try {
    run(["build"], normal);
  } catch (error) {
    failed ||= error;
  }
}
if (failed) throw failed;
