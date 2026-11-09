// Owner review only: optimized frontends + explicit loopback synthetic API.
// Never connects to ResourceSpace, Gokapi, the NAS registry, or production credentials.
import { spawn, spawnSync } from "node:child_process";
import { cp, mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
const root = process.cwd(),
  children = [];
for (const port of [3310, 3311, 4530, 4531]) {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", resolve);
  });
  await new Promise((resolve) => probe.close(resolve));
}
const env = {
  ...process.env,
  AIA_REVIEW_PREVIEW: "1",
  AIA_API_INTERNAL_URL: "http://127.0.0.1:4530",
};
for (const app of ["media-web", "transfer-web"]) {
  const directory = path.join(root, "apps", app);
  const generated = path.join(directory, "next-env.d.ts"),
    previousGenerated = await readFile(generated).catch(() => null);
  const result = spawnSync(
    process.execPath,
    [path.join(directory, "node_modules/next/dist/bin/next"), "build"],
    { cwd: directory, env, stdio: "inherit", windowsHide: true },
  );
  if (previousGenerated) await writeFile(generated, previousGenerated);
  else await unlink(generated).catch(() => {});
  if (result.status !== 0) throw new Error("Review build failed for " + app);
  const build = path.join(directory, ".next-review"),
    destination = path.join(build, "standalone/apps", app);
  await mkdir(path.join(destination, ".next-review"), { recursive: true });
  await cp(
    path.join(build, "static"),
    path.join(destination, ".next-review/static"),
    { recursive: true },
  );
  await cp(path.join(directory, "public"), path.join(destination, "public"), {
    recursive: true,
  });
}
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  process.stdin.pause();
  for (const child of children) child.kill();
}
process.stdin.on("data", (data) => {
  if (data.toString().trim() === "stop") stop();
});
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("exit", stop);
function start(script, extra) {
  const child = spawn(process.execPath, script, {
    cwd: root,
    env: { ...env, ...extra },
    stdio: "inherit",
    windowsHide: true,
  });
  children.push(child);
  child.on("exit", (code) => {
    if (!stopping) {
      console.error("Review process exited", code);
      stop();
      process.exitCode = code || 1;
    }
  });
  return child;
}
start(["--import", "tsx", "scripts/dev/review-auth.mts"], {});
start(["scripts/test/frontend-fixtures.mjs", "--synthetic-only"], {
  AIA_FIXTURE_AUTH_URL: "http://127.0.0.1:4531",
  AIA_FIXTURE_PORT: "4530",
  AIA_FIXTURE_COUNT: "10000",
  AIA_FIXTURE_ROLE: "admin",
  AIA_FIXTURE_MEDIA_URL: "http://127.0.0.1:3310",
  AIA_FIXTURE_TRANSFER_URL: "http://127.0.0.1:3311",
});
for (const [app, port] of [
  ["media-web", "3310"],
  ["transfer-web", "3311"],
])
  start(
    [
      path.join(
        root,
        "apps",
        app,
        ".next-review/standalone/apps",
        app,
        "server.js",
      ),
    ],
    { PORT: port, HOSTNAME: "127.0.0.1" },
  );
async function ready(url) {
  for (let i = 0; i < 100; i++) {
    if (stopping) throw new Error("Preview stopped");
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Preview readiness timed out");
}
try {
  await Promise.all([
    ready("http://127.0.0.1:4531/api/health"),
    ready("http://127.0.0.1:4530/__qa/metrics"),
    ready("http://127.0.0.1:3310"),
    ready("http://127.0.0.1:3311"),
  ]);
  let first;
  for (const title of [
    "Synthetic AIA Wall",
    "Synthetic circuit media",
    "Synthetic event selection",
    "Synthetic season handoff",
  ]) {
    const response = await fetch("http://127.0.0.1:4530/api/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        note: "Isolated review data. No production or native source files.",
        resourceIds: [1, 2, 3],
        days: 7,
      }),
    });
    if (!response.ok) throw new Error("Fixture seed failed");
    first ||= (await response.json()).transfer;
  }
  console.log("REVIEW PREVIEW - SYNTHETIC DATA ONLY - NO NAS CONNECTION");
  console.log(
    "Synthetic review sign-in: admin / synthetic-review-admin-only. Invited accounts use real authenticator codes.",
  );
  console.log("Media http://127.0.0.1:3310 (choose Transfers in the sidebar)");
  console.log("Independent Transfer http://127.0.0.1:3311");
  console.log("Public receiver " + first.link);
  console.log(
    "Press Ctrl+C to stop this isolated preview. Gallery/transfer fixtures reset on restart; staff accounts persist separately in this user's AIA-Media application data.",
  );
} catch (error) {
  stop();
  throw error;
}
