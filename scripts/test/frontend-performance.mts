import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import { mkdir, writeFile } from "node:fs/promises";
import {
  orderAssets,
  previewDimensions,
  nextSelection,
} from "../../packages/ui/src/lib/gallery-model.ts";
// Transport/model measurements only. This is not browser rendering or NAS throughput.
const port = 4521,
  base = `http://127.0.0.1:${port}`;
const child = spawn(
  process.execPath,
  ["scripts/test/frontend-fixtures.mjs", "--synthetic-only"],
  {
    env: {
      ...process.env,
      AIA_FIXTURE_PORT: String(port),
      AIA_FIXTURE_COUNT: "10000",
    },
    stdio: ["ignore", "pipe", "inherit"],
  },
);
const rows = [];
try {
  await new Promise<void>((resolve, reject) => {
    child.stdout.once("data", () => resolve());
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`Fixture exited ${code}`)));
  });
  for (const count of [100, 1000, 10000]) {
    await fetch(base + "/__qa/config", {
      method: "POST",
      body: JSON.stringify({ count }),
    });
    const timings: number[] = [],
      model: number[] = [];
    let bytes = 0,
      pageItems = 0;
    for (let run = 0; run < 21; run++) {
      const start = performance.now(),
        response = await fetch(
          base +
            `/api/library?page=${run % Math.ceil(count / 48)}&state=0&kind=all`,
        ),
        text = await response.text();
      const data = JSON.parse(text);
      if (data.total !== count || data.items.length > 48)
        throw new Error("Paging invariant failed");
      if (run === 0) continue;
      timings.push(performance.now() - start);
      bytes = Math.max(bytes, Buffer.byteLength(text));
      pageItems = Math.max(pageItems, data.items.length);
      const before = performance.now();
      const sorted = orderAssets(data.items, "name");
      sorted.map(previewDimensions);
      nextSelection(
        new Set(),
        sorted[0]?.id ?? 1,
        sorted.map((a) => a.id),
        null,
        false,
      );
      model.push(performance.now() - before);
    }
    const stats = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return {
        medianMs: +sorted[Math.floor(sorted.length / 2)].toFixed(3),
        p95Ms: +sorted[Math.ceil(sorted.length * 0.95) - 1].toFixed(3),
      };
    };
    rows.push({
      records: count,
      samples: 20,
      maxPageItems: pageItems,
      maxPageJsonBytes: bytes,
      loopbackTransport: stats(timings),
      pageModel: stats(model),
    });
  }
  const report = {
    at: new Date().toISOString(),
    node: process.version,
    scope:
      "Synthetic Node HTTP transport and 48-item client model only; no browser, source media, NAS or WAN performance claim",
    rows,
  };
  await mkdir("docs/frontend/evidence", { recursive: true });
  await writeFile(
    "docs/frontend/evidence/synthetic-performance.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  child.kill();
}
