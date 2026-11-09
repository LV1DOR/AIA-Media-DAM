import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const fixture = "http://127.0.0.1:4522";
const runtime = new WeakMap<object, string[]>();
test.beforeEach(async ({ request, context }) => {
  await request.post(fixture + "/__qa/config", {
    data: {
      count: 1000,
      role: "admin",
      libraryAccess: true,
      error: false,
      broken: false,
      delay: 0,
      signedIn: true,
      publicDelay: 0,
      publicSeconds: null,
      chunkDelay: 0,
    },
  });
  const errors: string[] = [];
  runtime.set(context, errors);
  context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
  for (const p of context.pages())
    p.on("pageerror", (e) => errors.push(e.message));
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    return u.hostname === "127.0.0.1" && ["3210", "3211"].includes(u.port)
      ? route.continue()
      : route.abort();
  });
});
test.afterEach(async ({ context, request }) => {
  await request.post(fixture + "/__qa/config", {
    data: { resetUploads: true, count: 1000 },
  });
  expect(runtime.get(context)).toEqual([]);
});
test("sidebar hover, centered rail icons and stable settings across tabs", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.locator('.media-workspace > [data-slot="sidebar"]'),
  ).toHaveAttribute("data-state", "collapsed");
  await expect(
    page.getByRole("button", { name: "Toggle Sidebar", exact: true }),
  ).toBeHidden();
  const rail = page.locator(".aia-sidebar"),
    box = (await rail.boundingBox())!;
  const mark = (await page.locator(".sidebar-logo-compact").boundingBox())!;
  expect(mark.width).toBeGreaterThanOrEqual(32);
  expect(
    Math.abs(mark.x + mark.width / 2 - box.x - box.width / 2),
  ).toBeLessThan(2);
  for (const name of ["Library", "Collections", "Transfers", "Settings"]) {
    const b = (await page
      .getByRole("button", { name, exact: true })
      .boundingBox())!;
    expect(Math.abs(b.x + b.width / 2 - box.x - box.width / 2)).toBeLessThan(2);
  }
  await rail.hover();
  await expect(
    page.locator('.media-workspace > [data-slot="sidebar"]'),
  ).toHaveAttribute("data-state", "expanded");
  await page.mouse.move(900, 100);
  await expect(
    page.locator('.media-workspace > [data-slot="sidebar"]'),
  ).toHaveAttribute("data-state", "collapsed");
  await page.screenshot({
    path: "docs/component-polish/evidence/sidebar-collapsed.png",
  });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const modal = page.getByRole("dialog", {
      name: "Settings & account",
      exact: true,
    }),
    initial = (await modal.boundingBox())!;
  for (const name of [
    "Staff",
    "Activity",
    "Service status",
    "Background photos",
    "Account",
  ]) {
    await modal.getByRole("button", { name, exact: true }).click();
    const next = (await modal.boundingBox())!;
    expect(Math.abs(next.y - initial.y)).toBeLessThan(1);
    expect(Math.abs(next.height - initial.height)).toBeLessThan(1);
  }
  await page.screenshot({
    path: "docs/component-polish/evidence/settings-stable.png",
  });
});
test("morphing chips drive actual library filtering and can be removed", async ({
  page,
}) => {
  await page.goto("/");
  const search = page.getByRole("combobox", {
    name: "Search your library",
    exact: true,
  });
  await search.fill("Paddock");
  await search.press("Enter");
  await expect(
    page.getByRole("button", { name: "Remove filter Paddock", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".results-line")).not.toContainText("1,000 assets");
  await search.fill("collection");
  await search.press("Enter");
  await expect(
    page.getByRole("button", { name: "Remove filter collection", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remove filter Paddock", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove filter collection", exact: true })
    .click();
  await expect(page.locator(".results-line")).toContainText("1,000 assets");
  await search.focus();
  await page.screenshot({
    path: "docs/component-polish/evidence/morphing-search.png",
  });
});
test("search combines MotoGP and year, matches keyword casing and exposes the quick tag button", async ({
  page,
}) => {
  await page.goto("/");
  const search = page.getByRole("combobox", {
    name: "Search your library",
    exact: true,
  });
  await search.fill("MotoGP");
  await search.press("Enter");
  await expect(page.locator(".results-line")).toContainText("333 assets");
  await search.fill("2026");
  await search.press("Enter");
  await expect(page.locator(".results-line")).toContainText("year:2026");
  await expect(page.locator(".results-line")).toContainText("333 assets");
  await expect(page.locator(".gallery-card").first()).toBeVisible();
  await page.screenshot({ path: "docs/search-zip/evidence/motogp-2026.png" });
  await page
    .getByRole("button", { name: "Remove filter MotoGP", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove filter 2026", exact: true })
    .click();
  for (const [phrase, total, expectedQuery] of [
    ["motogp 2026", "333 assets", 'motogp "year:2026"'],
    ["Racing Circuit", "1,000 assets", "racing circuit"],
    ["Track day 2026", "333 assets", 'track day "year:2026"'],
  ]) {
    await search.fill(phrase);
    await search.press("Enter");
    await expect(page.locator(".results-line")).toContainText(expectedQuery);
    await expect(page.locator(".results-line")).toContainText(total);
    await expect(page.locator(".gallery-card").first()).toBeVisible();
    await page
      .getByRole("button", { name: "Remove filter " + phrase, exact: true })
      .click();
  }
  for (const term of ["Racing", "racing"]) {
    await search.fill(term);
    await search.press("Enter");
    await expect(page.locator(".results-line")).toContainText("1,000 assets");
    await page
      .getByRole("button", { name: "Remove filter " + term, exact: true })
      .click();
  }
  await page.mouse.move(1400, 80);
  const tag = page.locator(".gallery-tag-trigger").first();
  await expect(tag).toHaveCSS("opacity", "1");
  await expect(tag.locator("..")).toHaveCSS("opacity", "1");
  await tag.click();
  await expect(
    page.getByRole("button", { name: "Save tags", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Switch to dark theme", exact: true })
    .click();
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(20, 20, 20)",
  );
  await page.screenshot({ path: "docs/search-zip/evidence/dark-library.png" });
});
test("attachment selection stays idle, nested preview restores focus and retry skips completed uploads", async ({
  page,
  context,
}) => {
  const calls: Record<string, number> = {};
  await context.route("**/api/library/upload?*", async (route) => {
    const name =
      route
        .request()
        .postDataBuffer()
        ?.toString()
        .match(/filename="([^"]+)"/)?.[1] || "unknown";
    calls[name] = (calls[name] || 0) + 1;
    if (name === "second.png" && calls[name] === 1)
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Synthetic upload failure" }),
      });
    return route.continue();
  });
  await page.goto("/");
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Upload media", exact: true })
    .click();
  const bytes = await readFile("tests/fixtures/profile.png");
  await page.locator("input[type=file]").setInputFiles([
    { name: "first.png", mimeType: "image/png", buffer: bytes },
    { name: "second.png", mimeType: "image/png", buffer: bytes },
  ]);
  await page.waitForTimeout(1100);
  expect(Object.keys(calls)).toHaveLength(0);
  await expect(
    page.locator('.aia-attachment-upload [role="progressbar"]'),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Preview first.png", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Preview of first.png", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Upload to your library", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preview first.png", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Upload to library", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry second.png", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/component-polish/evidence/attachment-retry.png",
  });
  await page
    .getByRole("button", { name: "Retry second.png", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Upload to your library", exact: true }),
  ).toHaveCount(0);
  expect(calls).toEqual({ "first.png": 1, "second.png": 2 });
});
test("Download all uses a local variable font and reacts to pointer proximity", async ({
  page,
  request,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const result = await request.post("http://127.0.0.1:3210/api/transfers", {
    data: { title: "Variable label test", resourceIds: [2, 3], days: 7 },
  });
  const transfer = (await result.json()).transfer;
  await page.goto("http://127.0.0.1:3211/t/" + transfer.id);
  await expect(
    page.getByRole("button", { name: "Download all (2 files)", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.load('14px "AIA Variable"'));
  const letter = page
    .locator(
      '.download-variable-label .variable-proximity span[aria-hidden="true"]',
    )
    .first();
  const before = await letter.evaluate(
    (el) => getComputedStyle(el).fontVariationSettings,
  );
  await letter.hover();
  await expect
    .poll(() =>
      letter.evaluate((el) => getComputedStyle(el).fontVariationSettings),
    )
    .not.toBe(before);
  await page.screenshot({
    path: "docs/component-polish/evidence/download-variable-font.png",
  });
});
