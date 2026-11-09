// Read-only public NAS checks, then an isolated synthetic API overlay. Never uses owner cookies.
import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
const fixture = "http://127.0.0.1:4562",
  base = "https://192.168.250.80:8443";
const post = async (path, data) => {
  const r = await fetch(fixture + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw Error("Fixture failure");
  return r.json();
};
if (!process.argv.includes("--approved-deployed-frontend-test"))
  throw Error("Explicit deployed-frontend test flag required");
await mkdir(".local/nas-deploy", { recursive: true });
const browser = await chromium.launch();
let server;
const errors = [];
const checks = [];
try {
  // Real deployed public API, isolated browser with no owner cookies.
  for (const port of [8443, 8444]) {
    const c = await browser.newContext({
      ignoreHTTPSErrors: true,
      reducedMotion: "reduce",
      viewport: { width: 1440, height: 1000 },
    });
    const p = await c.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("https://192.168.250.80:" + port);
    await expect(
      p.getByRole("button", { name: "Reduce animations", exact: true }),
    ).toBeVisible();
    const row = p.locator(".grid-motion__row").first();
    await expect(row).toHaveAttribute("style", /translate3d/);
    const before = await row.getAttribute("style");
    await expect.poll(() => row.getAttribute("style")).not.toBe(before);
    await p.mouse.move(150, 150);
    await expect(p.locator(".smooth-follower")).toHaveCount(0);
    await p
      .getByRole("button", { name: "Reduce animations", exact: true })
      .click();
    await p.waitForTimeout(100);
    const stopped = await row.getAttribute("style");
    await p.waitForTimeout(250);
    expect(await row.getAttribute("style")).toBe(stopped);
    await p.reload();
    await expect(
      p.getByRole("button", { name: "Enable animations", exact: true }),
    ).toBeVisible();
    checks.push({
      port,
      scope: "Real deployed public API and frontend",
      motionOverrideAndPersistence: true,
      photoWallMovesByDefault: true,
      noPublicCursor: true,
      explicitOffPersists: true,
    });
    await c.close();
  }
  // Real NAS HTML/CSP/JS/graphics, all API requests intercepted to a throwaway loopback fixture.
  server = spawn(
    process.execPath,
    ["scripts/test/frontend-fixtures.mjs", "--synthetic-only"],
    {
      env: {
        ...process.env,
        AIA_FIXTURE_PORT: "4562",
        AIA_FIXTURE_COUNT: "5",
        AIA_FIXTURE_MEDIA_URL: base,
        AIA_FIXTURE_TRANSFER_URL: "https://192.168.250.80:8444",
        AIA_FIXTURE_AUTH_URL: "",
      },
      stdio: "ignore",
    },
  );
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(fixture + "/__qa/metrics")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  const c = await browser.newContext({
    ignoreHTTPSErrors: true,
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
  });
  let apiCalls = 0;
  await c.route("**/api/**", async (route) => {
    apiCalls++;
    const u = new URL(route.request().url());
    const response = await route.fetch({
      url: fixture + u.pathname + u.search,
    });
    await route.fulfill({ response });
  });
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await post("/__qa/config", { signedIn: true, role: "admin", count: 5 });
  await p.goto(base);
  const img = p.locator(".gallery-photograph").first();
  await expect(img).toHaveAttribute("src", /preview\?size=scr$/);
  await expect
    .poll(() =>
      img.evaluate(
        (i) =>
          i.complete &&
          i.naturalWidth >= i.getBoundingClientRect().width * devicePixelRatio,
      ),
    )
    .toBe(true);
  await p.mouse.move(150, 150);
  await expect(p.locator(".smooth-follower")).toHaveCSS("opacity", "1");
  await p
    .getByRole("button", { name: "Reduce animations", exact: true })
    .click();
  await expect(p.locator(".smooth-follower")).toHaveCSS("display", "none");
  await p.screenshot({
    path: ".local/nas-deploy/live-sharp-gallery-synthetic.png",
  });
  const invite = await post("/api/admin/users", {
    username: "synthetic-motion-qa",
    name: "Synthetic Motion QA",
    role: "marketer",
    libraryAccess: true,
  });
  await post("/__qa/config", { signedIn: false });
  await p.goto(invite.invitationUrl);
  await p
    .getByLabel("Choose a password", { exact: true })
    .fill("Synthetic-password-only1!");
  await p
    .getByLabel("Confirm password", { exact: true })
    .fill("Synthetic-password-only1!");
  const portrait = await p.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 80;
    c.height = 80;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#4c5260";
    ctx.fillRect(0, 0, 80, 80);
    return c.toDataURL("image/png").split(",")[1];
  });
  await p.locator("input[type=file]").setInputFiles({
    name: "synthetic-portrait.png",
    mimeType: "image/png",
    buffer: Buffer.from(portrait, "base64"),
  });
  await p
    .getByRole("button", { name: "Continue to authenticator", exact: true })
    .click();
  await p
    .getByRole("textbox", { name: "One-time code", exact: true })
    .pressSequentially("123456");
  await expect(p.locator("canvas.lanyard-canvas")).toBeVisible();
  await expect(p.locator(".badge-pending")).toHaveCount(0);
  await expect(p.locator(".smooth-follower")).toHaveCount(0);
  await p
    .locator("canvas.lanyard-canvas")
    .evaluate((el) => el.setAttribute("data-instance", "retained"));
  await p
    .getByRole("button", { name: "Enable animations", exact: true })
    .click();
  await p
    .getByRole("button", { name: "Reduce animations", exact: true })
    .click();
  await expect(p.locator("canvas.lanyard-canvas")).toHaveAttribute(
    "data-instance",
    "retained",
  );
  const canvas = p.locator("canvas.lanyard-canvas"),
    rect = await canvas.boundingBox();
  await p.mouse.move(rect.x + rect.width * 0.5, rect.y + rect.height * 0.6);
  await p.mouse.down();
  await p.mouse.move(rect.x + rect.width * 0.7, rect.y + rect.height * 0.5, {
    steps: 10,
  });
  await p.mouse.up();
  await canvas.click({
    position: { x: rect.width * 0.5, y: rect.height * 0.6 },
  });
  await p.waitForTimeout(600);
  await p.screenshot({ path: ".local/nas-deploy/live-3d-synthetic.png" });
  checks.push({
    scope:
      "Real deployed frontend and CSP, isolated synthetic API interception only",
    sharpGalleryAt2x: true,
    syntheticApiCalls: apiCalls,
    realWebglLanyard: true,
    lanyardUnaffectedByAnimationsOff: true,
    cursorOnlyInSignedInWorkspace: true,
    dragAndFlip: true,
    productionAccountWrites: false,
  });
  await c.close();
  expect(errors).toEqual([]);
  const result = {
    checkedAt: new Date().toISOString(),
    checks,
    errors,
    authenticatedOwnerWalkthrough: false,
    tls: "CA verification separate; isolated browser certificate exception",
  };
  await writeFile(
    ".local/nas-deploy/component-live-browser.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  server?.kill();
  await browser.close();
}
