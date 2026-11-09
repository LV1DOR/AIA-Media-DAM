import { test, expect, chromium } from "@playwright/test";
import lighthouse from "lighthouse";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { performance as timer } from "node:perf_hooks";
import { createHash } from "node:crypto";
const reportPath = "docs/frontend/evidence/browser-performance.json";
test.beforeAll(async () => {
  const fingerprint = createHash("sha256");
  for (const path of [
    "packages/ui/src/index.tsx",
    "packages/ui/src/components/asset-viewer.tsx",
    "packages/ui/src/components/ui/image-gallery.tsx",
    "packages/ui/src/styles.css",
    "packages/ui/src/redesign.css",
    "services/transfer-api/src/app.ts",
    "services/transfer-api/src/adapters.ts",
  ]) {
    fingerprint.update(path);
    fingerprint.update(await readFile(path));
  }
  const sourceFingerprint = fingerprint.digest("hex");
  await mkdir(".local/frontend-qa/lighthouse", { recursive: true });
  await writeFile(
    reportPath,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        sourceFingerprint,
        scope:
          "Local optimized builds, identical lightweight synthetic SVGs, Chromium headless, 1440x1000, reduced motion, unthrottled; one Lighthouse navigation per build/count; not NAS/WAN or real photography throughput",
        rows: [],
      },
      null,
      2,
    ),
  );
});
for (const count of [100, 1000, 10000])
  test(`compare baseline and redesign with ${count} records`, async ({
    browser,
    request,
  }) => {
    test.setTimeout(180000);
    await request.post("http://127.0.0.1:4522/__qa/config", {
      data: {
        count,
        role: "reviewer",
        libraryAccess: true,
        error: false,
        broken: false,
        delay: 0,
        pending: [],
      },
    });
    for (const [variant, url, card] of [
      ["baseline", "http://127.0.0.1:3150", ".asset-card"],
      ["redesign", "http://127.0.0.1:3210", ".gallery-card"],
    ] as const) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const cdp = await context.newCDPSession(page);
      await page.addInitScript(() => {
        (window as any).__qaVitals = { cls: 0, lcp: 0 };
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any) {
            if (!entry.hadRecentInput)
              (window as any).__qaVitals.cls += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            (window as any).__qaVitals.lcp = entry.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
      });
      const start = timer.now();
      await page.goto(url);
      await expect(page.locator(card)).toHaveCount(48);
      const galleryReadyMs = timer.now() - start;
      await page
        .locator(card + " img")
        .nth(1)
        .waitFor({ state: "visible" });
      await page.waitForTimeout(500);
      const initial = await page.evaluate(() => ({
        vitals: (window as any).__qaVitals,
        resources: (
          performance.getEntriesByType(
            "resource",
          ) as PerformanceResourceTiming[]
        ).map((r) => ({
          url: new URL(r.name).pathname + new URL(r.name).search,
          bytes: r.encodedBodySize,
          transferred: r.transferSize,
        })),
        cards: document.querySelectorAll(".gallery-card,.asset-card").length,
      }));
      await cdp.send("HeapProfiler.collectGarbage");
      const before = await cdp.send("Runtime.getHeapUsage");
      const selectionStart = timer.now();
      await page
        .getByRole("checkbox", {
          name: "Select Race weekend 0002",
          exact: true,
        })
        .check();
      await expect(page.locator(".selection-bar")).toContainText("1 selected");
      const selectionRoundTripMs = timer.now() - selectionStart;
      const cycles = 8;
      for (let i = 0; i < cycles; i++) {
        await page.evaluate(() =>
          window.scrollTo(0, document.body.scrollHeight),
        );
        await expect(
          page.locator(`[data-gallery-window="${i + 1}"] ${card}`),
        ).toHaveCount(48);
        expect(await page.locator(card).count()).toBeLessThanOrEqual(192);
      }
      await cdp.send("HeapProfiler.collectGarbage");
      const after = await cdp.send("Runtime.getHeapUsage");
      expect(errors).toEqual([]);
      await context.close();
      const lhBrowser = await chromium.launch({
        headless: true,
        args: ["--remote-debugging-port=9223"],
      });
      let lh;
      try {
        const result = await lighthouse(url, {
          port: 9223,
          logLevel: "error",
          onlyCategories: ["performance"],
          formFactor: "desktop",
          screenEmulation: {
            mobile: false,
            width: 1440,
            height: 1000,
            deviceScaleFactor: 1,
            disabled: false,
          },
          throttlingMethod: "provided",
        });
        if (!result) throw new Error("No Lighthouse report");
        const lhr = result.lhr;
        await writeFile(
          `.local/frontend-qa/lighthouse/${variant}-${count}.json`,
          JSON.stringify(lhr),
        );
        lh = {
          version: lhr.lighthouseVersion,
          performanceScore: lhr.categories.performance.score,
          lcpMs: lhr.audits["largest-contentful-paint"].numericValue,
          cls: lhr.audits["cumulative-layout-shift"].numericValue,
          totalBlockingTimeMs: lhr.audits["total-blocking-time"].numericValue,
          warnings: lhr.runWarnings,
        };
      } finally {
        await lhBrowser.close();
      }
      const previews = initial.resources.filter((r) =>
        r.url.includes("/preview"),
      );
      const row = {
        variant,
        records: count,
        galleryReadyMs: +galleryReadyMs.toFixed(1),
        selectionRoundTripMs: +selectionRoundTripMs.toFixed(1),
        renderedCards: initial.cards,
        resourceRequests: initial.resources.length,
        previewRequests: previews.length,
        previewEncodedBytes: previews.reduce((sum, r) => sum + r.bytes, 0),
        previewTransferredBytes: previews.reduce(
          (sum, r) => sum + r.transferred,
          0,
        ),
        observer: initial.vitals,
        memory: {
          pageAndScrollCycles: cycles,
          usedHeapBeforeBytes: before.usedSize,
          usedHeapAfterBytes: after.usedSize,
          deltaBytes: after.usedSize - before.usedSize,
        },
        lighthouse: lh,
        consoleErrors: errors,
      };
      const report = JSON.parse(await readFile(reportPath, "utf8"));
      report.rows.push(row);
      await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
      console.log(JSON.stringify(row));
    }
  });
