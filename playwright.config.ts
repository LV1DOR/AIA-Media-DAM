import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  testMatch: process.env.AIA_BROWSER_PERFORMANCE
    ? "performance.spec.ts"
    : ["workflows.spec.ts", "react-bits.spec.ts", "component-polish.spec.ts"],
  workers: 1,
  fullyParallel: false,
  timeout: 30000,
  expect: { timeout: 8000 },
  outputDir: ".local/frontend-qa/test-results",
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: process.env.AIA_BROWSER_PERFORMANCE
          ? "docs/frontend/evidence/browser-performance-tests.json"
          : "docs/react-bits/evidence/browser-results.json",
      },
    ],
  ],
  use: {
    baseURL: "http://127.0.0.1:3210",
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    ...(process.env.AIA_BROWSER_PERFORMANCE
      ? [
          {
            command:
              "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3150",
            cwd: ".local/frontend-qa/baseline-build/apps/media-web",
            url: "http://127.0.0.1:3150",
            env: { PORT: "3150", HOSTNAME: "127.0.0.1" },
            reuseExistingServer: false,
          },
        ]
      : []),
    {
      command: "node scripts/test/frontend-fixtures.mjs --synthetic-only",
      url: "http://127.0.0.1:4522/__qa/metrics",
      env: {
        AIA_FIXTURE_PORT: "4522",
        AIA_FIXTURE_COUNT: "10000",
        AIA_FIXTURE_MEDIA_URL: "http://127.0.0.1:3210",
        AIA_FIXTURE_TRANSFER_URL: "http://127.0.0.1:3211",
      },
      reuseExistingServer: false,
    },
    {
      command: "node apps/media-web/.next/standalone/apps/media-web/server.js",
      url: "http://127.0.0.1:3210",
      env: { PORT: "3210", HOSTNAME: "127.0.0.1" },
      reuseExistingServer: false,
    },
    {
      command:
        "node apps/transfer-web/.next/standalone/apps/transfer-web/server.js",
      url: "http://127.0.0.1:3211",
      env: { PORT: "3211", HOSTNAME: "127.0.0.1" },
      reuseExistingServer: false,
    },
  ],
});
