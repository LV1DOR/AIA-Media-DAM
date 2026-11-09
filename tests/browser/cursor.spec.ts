import { test, expect } from "@playwright/test";
const fixture = "http://127.0.0.1:4522";
test.beforeEach(async ({ request }) => {
  await request.post(fixture + "/__qa/config", {
    data: {
      count: 1000,
      role: "admin",
      libraryAccess: true,
      signedIn: true,
      error: false,
      broken: false,
      delay: 0,
      publicDelay: 0,
      publicSeconds: null,
    },
  });
});
test("smooth follower tracks mouse, expands on dynamic controls and stays above dialogs without intercepting clicks", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const root = page.locator(".smooth-follower"),
    dot = page.locator(".smooth-follower-dot"),
    ring = page.locator(".smooth-follower-ring");
  await expect(root).toHaveCount(1);
  await expect(root).toHaveAttribute("aria-hidden", "true");
  await expect(root).toHaveCSS("opacity", "0");
  await page.mouse.move(700, 180);
  await expect(root).toHaveCSS("opacity", "1");
  await expect
    .poll(async () => {
      const b = await dot.boundingBox();
      return Math.round(b!.x + b!.width / 2);
    })
    .toBe(700);
  await expect(dot).toHaveCSS("width", "8px");
  await expect(ring).toHaveCSS("width", "28px");
  await page.evaluate(() => {
    const button = document.createElement("button");
    button.id = "cursor-dynamic-test";
    button.textContent = "Dynamic cursor test";
    button.style.cssText =
      "position:fixed;left:700px;top:200px;width:180px;height:50px;z-index:9999";
    button.onclick = () => (button.dataset.clicked = "yes");
    document.body.appendChild(button);
  });
  await page.locator("#cursor-dynamic-test").hover();
  await expect(root).toHaveAttribute("data-hovering", "true");
  await expect(ring).toHaveCSS("width", "44px");
  await page.locator("#cursor-dynamic-test").click();
  await expect(page.locator("#cursor-dynamic-test")).toHaveAttribute(
    "data-clicked",
    "yes",
  );
  await page.evaluate(() =>
    document.querySelector("#cursor-dynamic-test")?.remove(),
  );
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Staff", exact: true }).hover();
  await expect(root).toHaveAttribute("data-hovering", "true");
  await expect(root).toHaveCSS("pointer-events", "none");
  const z = await root.evaluate((el) => Number(getComputedStyle(el).zIndex));
  const modalZ = await page
    .locator(".settings-modal")
    .evaluate((el) => Number(getComputedStyle(el).zIndex));
  expect(z).toBeGreaterThan(modalZ);
  await page.screenshot({ path: "docs/cursor/evidence/dialog-cursor.png" });
  await page.keyboard.press("Tab");
  await expect(root).toHaveCSS("opacity", "0");
  await page.mouse.move(800, 400);
  await expect(root).toHaveCSS("opacity", "1");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(root).toHaveCSS("opacity", "0");
  await page.mouse.move(600, 350);
  await expect(root).toHaveCSS("opacity", "1");
  await page.waitForTimeout(1100);
  const settled = await dot.getAttribute("style");
  await page.waitForTimeout(150);
  expect(await dot.getAttribute("style")).toBe(settled);
  expect(errors).toEqual([]);
});

test("cursor covers both login surfaces, signup and the receiver and respects preference changes", async ({
  page,
  request,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await request.post(fixture + "/__qa/config", { data: { signedIn: false } });
  for (const url of [
    "http://127.0.0.1:3210",
    "http://127.0.0.1:3211",
    "http://127.0.0.1:3210/join",
  ]) {
    await page.goto(url);
    await page.mouse.move(700, 250);
    await expect(page.locator(".smooth-follower")).toHaveCount(1);
    await expect(page.locator(".smooth-follower")).toHaveCSS("opacity", "1");
  }
  const response = await request.post(fixture + "/api/transfers", {
    data: { title: "Cursor receiver check", resourceIds: [1, 2], days: 7 },
  });
  const data = (await response.json()).transfer;
  await page.goto("http://127.0.0.1:3211/t/" + data.id);
  await page
    .getByRole("button", { name: "Download all (2 files)", exact: true })
    .hover();
  await expect(page.locator(".smooth-follower-ring")).toHaveCSS(
    "width",
    "44px",
  );
  await page.screenshot({ path: "docs/cursor/evidence/receiver-cursor.png" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".smooth-follower")).toHaveCSS("display", "none");
  await page.mouse.move(200, 200);
  await expect(page.locator(".smooth-follower")).toHaveCSS("opacity", "0");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.mouse.move(300, 200);
  await expect(page.locator(".smooth-follower")).toHaveCSS("opacity", "1");
  await page.dispatchEvent("body", "pointerdown", { pointerType: "touch" });
  await expect(page.locator(".smooth-follower")).toHaveCSS("opacity", "0");
});

test("touch devices keep the native interaction without a follower", async ({
  browser,
}) => {
  const context = await browser.newContext({
    isMobile: true,
    hasTouch: true,
    viewport: { width: 390, height: 844 },
    reducedMotion: "no-preference",
  });
  try {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:3210");
    await page.dispatchEvent("body", "pointermove", {
      pointerType: "touch",
      clientX: 100,
      clientY: 200,
    });
    await expect(page.locator(".smooth-follower")).toHaveCSS("display", "none");
    await expect(page.locator(".smooth-follower")).toHaveCSS("opacity", "0");
  } finally {
    await context.close();
  }
});
