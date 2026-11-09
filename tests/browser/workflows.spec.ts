import { test, expect } from "@playwright/test";
const fixture = "http://127.0.0.1:4522";
const runtimeErrors = new WeakMap<object, string[]>();
test.beforeEach(async ({ request, context }) => {
  const errors: string[] = [];
  runtimeErrors.set(context, errors);
  context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
  for (const p of context.pages())
    p.on("pageerror", (e) => errors.push(e.message));
  await request.post(fixture + "/__qa/config", {
    data: {
      count: 1000,
      role: "reviewer",
      libraryAccess: true,
      error: false,
      broken: false,
      delay: 0,
      chunkDelay: 0,
      pending: [],
      tagFailId: 0,
      resetTags: true,
      storageUnavailable: false,
      storageUsedBytes: 640 * 1024 ** 3,
      publicDelay: 0,
      signedIn: true,
      mfaRequired: true,
      inviteError: false,
      mfaError: false,
      publicSeconds: null,
    },
  });
  // Fail closed on an accidental external integration in these isolated tests.
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    return u.hostname === "127.0.0.1" && ["3210", "3211"].includes(u.port)
      ? route.continue()
      : route.abort();
  });
});
test.afterEach(async ({ context }) => {
  expect(runtimeErrors.get(context) || []).toEqual([]);
});
async function visibleImagesReady(page: any) {
  await page.waitForFunction(() =>
    Array.from(document.images)
      .filter((img) => {
        const rect = img.getBoundingClientRect();
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.top < innerHeight &&
          rect.bottom > 0
        );
      })
      .every((img) => img.complete && img.naturalWidth > 0),
  );
}
async function library(page: any) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "View Race weekend 0002", exact: true }),
  ).toBeVisible();
}
test("gallery modes, native filters, range selection, paging and details", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await library(page);
  await expect(page.locator(".gallery-card")).toHaveCount(48);
  await page
    .getByRole("checkbox", { name: "Select Race weekend 0002", exact: true })
    .check();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".selection-bar")).toContainText("1 selected");
  await expect(
    page.getByRole("button", {
      name: "View Paddock collection 0049",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(
    page.getByRole("checkbox", {
      name: "Select Race weekend 0002",
      exact: true,
    }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  await page.getByRole("button", { name: "list view", exact: true }).click();
  await expect(page.getByRole("table", { name: "Media assets" })).toBeVisible();
  const checks = page.getByRole("checkbox");
  await checks.nth(1).click();
  await checks.nth(4).click({ modifiers: ["Shift"] });
  await expect(page.locator(".selection-bar")).toContainText("4 selected");
  await page
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  await page.getByRole("button", { name: "grid view", exact: true }).click();
  await expect(page.locator(".react-photo-album--rows")).toBeVisible();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByLabel("Year", { exact: true }).fill("2026");
  await expect(page.locator(".results-line")).toContainText("333 assets");
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Search your library", exact: true })
    .fill("0002");
  await expect(page.locator(".gallery-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "View Race weekend 0002", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("ELMS");
  await expect(
    page.getByRole("region", { name: "Collection membership" }),
  ).toContainText("Race weekend selection");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "View Race weekend 0002", exact: true }),
  ).toBeFocused();
  expect(errors).toEqual([]);
});
test("viewer keyboard navigation, zoom and focus dismissal", async ({
  page,
}) => {
  await library(page);
  await page
    .getByRole("button", { name: "Fullscreen Race weekend 0002", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Lightbox" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Race weekend 0002" }),
  ).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(
    dialog.getByRole("heading", { name: "Circuit perspectives 0003" }),
  ).toBeVisible();
  const fullImage = dialog.getByRole("img", {
    name: "Circuit perspectives 0003",
    exact: true,
  });
  await expect(fullImage).toHaveJSProperty("complete", true);
  expect((await fullImage.boundingBox())!.width).toBeGreaterThan(600);
  await dialog.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Zoom out", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: "docs/unified-ui/evidence/regressions/viewer-desktop.png",
  });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Fullscreen Race weekend 0002",
      exact: true,
    }),
  ).toBeFocused();
});
test("collections create, rename, add, remove and share approved members", async ({
  page,
}) => {
  await library(page);
  await page
    .getByRole("checkbox", { name: "Select Race weekend 0002", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Add to collection", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Collection name", exact: true })
    .fill("Browser QA project");
  await page
    .getByRole("button", { name: "Create collection", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Collections", exact: true }).click();
  let card = page
    .locator(".collection-card")
    .filter({ hasText: "Browser QA project" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Rename", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Collection name", exact: true })
    .fill("Browser QA renamed");
  await page.getByRole("button", { name: "Save name", exact: true }).click();
  card = page
    .locator(".collection-card")
    .filter({ hasText: "Browser QA renamed" });
  await expect(card).toBeVisible();
  await page.screenshot({
    path: "docs/unified-ui/evidence/regressions/collections-desktop.png",
  });
  await card
    .getByRole("button", { name: "Share collection", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Share from your library" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await card.getByRole("button", { name: /Open collection/ }).click();
  await expect(page.locator(".gallery-card")).toHaveCount(1);
  await page
    .getByRole("checkbox", { name: "Select Race weekend 0002", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Remove from collection", exact: true })
    .click();
  await expect(page.locator(".gallery-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(page.locator(".gallery-card")).toHaveCount(48);
  await page
    .getByRole("checkbox", { name: "Select Race weekend 0002", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Add to collection", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Destination", exact: true })
    .selectOption({ label: "Browser QA renamed" });
  await page
    .getByRole("button", { name: "Add selected assets", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("library uploads appear immediately without a review or approval workflow", async ({
  page,
}) => {
  await library(page);
  await expect(
    page.getByRole("button", { name: "Review", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Upload media", exact: true })
    .click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "instant-library.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH2sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page
    .getByRole("button", { name: "Upload to library", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "View instant-library.png", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "View instant-library.png", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("In library");
  await expect(
    page.getByRole("button", { name: "Approve", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Return to pending", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Edit metadata", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Title", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/unified-ui/evidence/regressions/library-upload-metadata-desktop.png",
  });
});

test("marketer and transfer-only navigation follow assigned capabilities", async ({
  page,
  request,
}) => {
  await request.post(fixture + "/__qa/config", { data: { role: "marketer" } });
  await library(page);
  await expect(
    page.getByRole("button", { name: "Review", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "View Race weekend 0002", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit metadata", exact: true }),
  ).toHaveCount(0);
  await request.post(fixture + "/__qa/config", {
    data: { libraryAccess: false },
  });
  await page.reload();
  await expect(
    page.getByText("Library access is not assigned", { exact: true }),
  ).toBeVisible();
  await page.goto("http://127.0.0.1:3211/");
  await expect(
    page.getByRole("heading", { name: "Transfers", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("banner")
    .getByRole("button", { name: "New transfer", exact: true })
    .click();
  await expect(page.locator(".inline-upload")).toBeVisible();
  await page.screenshot({
    path: "docs/unified-ui/evidence/regressions/transfer-upload-desktop.png",
  });
});
test("empty, source-error, skeleton and broken preview states", async ({
  page,
  request,
}) => {
  await request.post(fixture + "/__qa/config", { data: { count: 0 } });
  await page.goto("/");
  await expect(
    page.getByText("A fresh perspective starts here", { exact: true }),
  ).toBeVisible();
  await request.post(fixture + "/__qa/config", {
    data: { count: 100, error: true },
  });
  await page.reload();
  await expect(page.locator(".error[role=alert]")).toContainText(
    "Synthetic source unavailable",
  );
  await request.post(fixture + "/__qa/config", {
    data: { error: false, delay: 1600 },
  });
  await page.reload();
  await expect(page.locator(".gallery-skeleton")).toBeVisible();
  await expect(page.locator(".gallery-card")).toHaveCount(48);
  await request.post(fixture + "/__qa/config", {
    data: { delay: 0, broken: true },
  });
  await page.reload();
  await expect(
    page.getByRole("img", {
      name: "Preview unavailable for Circuit perspectives 0003",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/unified-ui/evidence/regressions/preview-error-desktop.png",
  });
});
for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
]) {
  test(`responsive gallery and sidebar ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await library(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `docs/unified-ui/evidence/regressions/library-${viewport.width}.png`,
    });
    if (viewport.width < 768) {
      await page
        .getByRole("button", { name: "Toggle Sidebar", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Collections", exact: true }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
    }
  });
}

test("library share password, history and revoke remain connected", async ({
  page,
}) => {
  await library(page);
  await page
    .getByRole("button", { name: "View Race weekend 0002", exact: true })
    .click();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await page
    .getByLabel("Transfer password optional")
    .fill("synthetic-recipient-password");
  await page
    .getByRole("button", { name: "Create share link", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Protected");
  const link = await page
    .getByRole("dialog")
    .locator(".copy-field input")
    .inputValue();
  const recipient = await page.context().newPage();
  await recipient.goto(link);
  await expect(
    recipient.getByRole("button", { name: "Unlock transfer", exact: true }),
  ).toBeVisible();
  await recipient
    .getByLabel("Transfer password", { exact: true })
    .fill("wrong");
  await recipient
    .getByRole("button", { name: "Unlock transfer", exact: true })
    .click();
  await expect(recipient.locator(".error")).toContainText("Incorrect");
  await recipient
    .getByLabel("Transfer password", { exact: true })
    .fill("synthetic-recipient-password");
  await recipient
    .getByRole("button", { name: "Unlock transfer", exact: true })
    .click();
  await expect(
    recipient.getByRole("link", { name: "Download", exact: true }),
  ).toBeVisible();
  await recipient.screenshot({
    path: "docs/unified-ui/evidence/regressions/recipient-desktop.png",
  });
  await page
    .getByRole("button", { name: "Revoke transfer", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm revoke", exact: true })
    .click();
  await recipient.reload();
  await expect(
    recipient.getByRole("heading", {
      name: "This sharing link is inactive.",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Transfers", exact: true }).click();
  await expect(page.getByRole("main")).toContainText("Revoked");
  await recipient.close();
});
test("standalone temporary upload pauses and resumes without DAM requests", async ({
  page,
  request,
}) => {
  await request.post(fixture + "/__qa/config", { data: { chunkDelay: 5000 } });
  await page.goto("http://127.0.0.1:3211/");
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page
    .getByRole("banner")
    .getByRole("button", { name: "New transfer", exact: true })
    .click();
  await page.locator("input[type=file]").setInputFiles({
    name: "synthetic-resume.txt",
    mimeType: "text/plain",
    buffer: Buffer.alloc(1024 * 1024, 65),
  });
  await page
    .getByRole("textbox", { name: "Transfer title", exact: true })
    .fill("Synthetic resumed transfer");
  const chunkStarted = page.waitForRequest((r) => r.url().includes("/chunk?"));
  await page
    .getByRole("button", { name: "Create transfer", exact: true })
    .click();
  await chunkStarted;
  await page.getByRole("button", { name: "Pause upload", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Resume upload", exact: true }),
  ).toBeVisible();
  await request.post(fixture + "/__qa/config", { data: { chunkDelay: 0 } });
  await page
    .getByRole("button", { name: "Resume upload", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Temporary Upload");
  await expect(page.getByRole("dialog")).toContainText("active");
  expect(
    requests.some((url) => url.includes("/api/library/upload")),
  ).toBeFalsy();
});

test("theme preference persists and retained share surfaces remain readable", async ({
  page,
}) => {
  await library(page);
  await page
    .getByRole("button", { name: "Switch to dark theme", exact: true })
    .click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Switch to light theme", exact: true }),
  ).toBeVisible();
  await visibleImagesReady(page);
  await page.screenshot({
    path: "docs/unified-ui/evidence/regressions/library-dark.png",
  });
  await page
    .getByRole("button", { name: "View Race weekend 0002", exact: true })
    .click();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Share from your library" }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/unified-ui/evidence/regressions/share-dark.png",
  });
  const background = await page
    .locator(".share-selection")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(background).toBe("rgb(36, 36, 36)");
});

test("selection mode toggles full cards, preserves nested viewer actions and exits clearly", async ({
  page,
}) => {
  await library(page);
  const cards = page.locator(".gallery-card");
  await cards.nth(1).getByRole("checkbox").check();
  await cards.nth(2).locator(".gallery-card-open").click();
  await expect(page.locator(".selection-bar")).toContainText("2 selected");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await cards.nth(2).locator(".gallery-card-open").click();
  await expect(page.locator(".selection-bar")).toContainText("1 selected");
  await cards.nth(1).hover();
  await cards
    .nth(1)
    .getByRole("button", { name: /^Fullscreen / })
    .click();
  await expect(page.getByRole("dialog", { name: "Lightbox" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".selection-bar")).toContainText("1 selected");
  await page.keyboard.press("Escape");
  await expect(page.locator(".selection-bar")).toHaveCount(0);
  await cards.nth(2).locator(".gallery-card-open").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await cards.nth(1).getByRole("checkbox").check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator(".selection-bar")).toHaveCount(0);
});

test("tag popover and bulk add/remove handle native-style partial failures and retries", async ({
  page,
  request,
}) => {
  await library(page);
  const card = page.locator(".gallery-card").filter({
    has: page.getByRole("button", {
      name: "View Race weekend 0002",
      exact: true,
    }),
  });
  await card.hover();
  await card
    .getByRole("button", {
      name: "Edit tags for Race weekend 0002",
      exact: true,
    })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Edit tags for Race weekend 0002",
    exact: true,
  });
  await expect(
    editor.getByRole("button", { name: "Remove tag Circuit", exact: true }),
  ).toBeVisible();
  await editor.getByLabel("Search tags").fill("Paddock");
  await editor.getByRole("option", { name: "Paddock", exact: true }).click();
  await editor.getByRole("button", { name: "Save tags", exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(
    (await (await request.get(fixture + "/api/library/2/tags")).json()).tags,
  ).toEqual(["Circuit", "Racing", "Paddock"]);
  const cards = page.locator(".gallery-card");
  await cards.nth(0).getByRole("checkbox").check();
  await card.locator(".gallery-card-open").click();
  await page.getByRole("button", { name: "Edit tags", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Edit tags - 2 assets" });
  await expect(sheet).toContainText("Saves are per asset");
  await sheet.getByLabel("Search tags").fill("Paddock");
  await sheet.getByRole("option", { name: "Paddock", exact: true }).click();
  await request.post(fixture + "/__qa/config", { data: { tagFailId: 2 } });
  await sheet.getByRole("button", { name: "Apply tags", exact: true }).click();
  await expect(sheet).toContainText("1 failed");
  await request.post(fixture + "/__qa/config", { data: { tagFailId: 0 } });
  await sheet
    .getByRole("button", { name: "Retry failed assets", exact: true })
    .click();
  await expect(sheet).toContainText("0 failed");
  await sheet.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Edit tags", exact: true }).click();
  await sheet.getByLabel("Tag action").selectOption("remove");
  await sheet.getByLabel("Search tags").fill("Racing");
  await sheet.getByRole("option", { name: "Racing", exact: true }).click();
  await sheet.getByRole("button", { name: "Apply tags", exact: true }).click();
  await expect(sheet).toContainText("Saved");
  expect(
    (await (await request.get(fixture + "/api/library/2/tags")).json()).tags,
  ).toEqual(["Circuit", "Paddock"]);
});

for (const width of [1440, 768, 390])
  test(`unified visual review ${width}: library, tags, storage, transfers and receiver`, async ({
    page,
    request,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 1000 });
    await request.post(fixture + "/__qa/config", { data: { role: "admin" } });
    await library(page);
    await visibleImagesReady(page);
    const base = "docs/unified-ui/evidence/";
    await page.screenshot({
      path: base + `library-${width}.png`,
      fullPage: true,
    });
    await page.locator(".gallery-card").nth(1).hover();
    await page
      .getByRole("button", {
        name: "Edit tags for Race weekend 0002",
        exact: true,
      })
      .click();
    await expect(page.getByLabel("Search tags")).toBeVisible();
    await page.screenshot({ path: base + `tag-popover-${width}.png` });
    await page.keyboard.press("Escape");
    await page.locator(".gallery-card").nth(1).getByRole("checkbox").check();
    await page
      .locator(".gallery-card")
      .nth(2)
      .locator(".gallery-card-open")
      .click();
    const contrast = await page.locator(".selection-bar").evaluate((el) => {
      const rgb = (s: string) =>
        s
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number)
          .map((c) => {
            const v = c / 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          });
      const light = (s: string) => {
        const c = rgb(s);
        return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
      };
      const style = getComputedStyle(el);
      const a = light(style.color),
        b = light(style.backgroundColor);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({ path: base + `selection-${width}.png` });
    await page.getByRole("button", { name: "Edit tags", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("Current tags");
    await page.screenshot({ path: base + `bulk-tags-${width}.png` });
    await page.getByRole("button", { name: "Close tag editor" }).click();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    async function navigate(name: string) {
      if (width < 768) {
        await page
          .getByRole("button", { name: "Toggle Sidebar", exact: true })
          .click();
      }
      await page.getByRole("button", { name, exact: true }).click();
    }
    await navigate("Collections");
    await page.mouse.move(width - 3, 3);
    await page.locator(".collection-card").first().hover();
    await page.screenshot({ path: base + `collection-hover-${width}.png` });
    if (width < 768)
      await page
        .getByRole("button", { name: "Toggle Sidebar", exact: true })
        .click();
    if ((page.viewportSize()?.width ?? 1440) >= 768)
      await page.locator(".aia-sidebar").hover();
    await page
      .getByRole("button", { name: "Storage usage", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Filesystem storage usage" }),
    ).toContainText("Synthetic test filesystem");
    const meterBounds = await page
      .getByRole("dialog", { name: "Filesystem storage usage" })
      .boundingBox();
    expect(meterBounds!.x).toBeGreaterThanOrEqual(0);
    expect(meterBounds!.x + meterBounds!.width).toBeLessThanOrEqual(width);
    await page.mouse.move(width - 3, 3);
    await page.waitForTimeout(250); // settle the upstream hover crossfade before visual capture
    await page.screenshot({ path: base + `storage-${width}.png` });
    await page.keyboard.press("Escape");
    if (width < 768) await page.keyboard.press("Escape");
    for (let i = 0; i < 4; i++)
      await request.post(fixture + "/api/transfers", {
        data: {
          title: [
            "Synthetic photopack - Round 6",
            "Synthetic event assets",
            "Synthetic circuit aerials",
            "Synthetic media kit",
          ][i],
          resourceIds: [1, 2, 3],
          days: 7,
        },
      });
    await navigate("Transfers");
    await expect(page.locator(".inline-upload")).toBeVisible();
    expect(page.url()).toContain(":3210");
    await page.screenshot({
      path: base + `transfers-light-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Switch to dark theme", exact: true })
      .click();
    await page.screenshot({
      path: base + `transfers-dark-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    const made = await request.post(fixture + "/api/transfers", {
      data: {
        title: "Synthetic AIA Wall",
        note: "A synthetic review handoff, with isolated fixture files.",
        resourceIds: [1, 2, 3],
      },
    });
    const transfer = (await made.json()).transfer;
    await page.goto("http://127.0.0.1:3211/t/" + transfer.id);
    await expect(
      page.getByRole("button", { name: "Download all (3 files)", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: base + `receiver-${width}.png`,
      fullPage: true,
    });
    expect(await page.locator(".recipient-page>header").count()).toBe(0);
    await expect(page.locator(".recipient-security")).toHaveCount(0);
    await expect(page.locator(".recipient-page main>footer")).toHaveCount(0);
    await expect(page.getByText("AIA TRANSFER", { exact: true })).toHaveCount(
      0,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await request.post(fixture + "/api/transfers/" + transfer.id + "/revoke");
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: "This sharing link is inactive.",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText("AIA TRANSFER", { exact: true })).toHaveCount(
      0,
    );
    await expect(page.locator(".recipient-page main>footer")).toHaveCount(0);
    await page.screenshot({
      path: base + `receiver-revoked-${width}.png`,
      fullPage: true,
    });
    const secured = (
      await (
        await request.post(fixture + "/api/transfers", {
          data: {
            title: "Synthetic protected handoff",
            resourceIds: [1],
            password: "synthetic-only-password",
          },
        })
      ).json()
    ).transfer;
    await page.goto("http://127.0.0.1:3211/t/" + secured.id);
    await expect(
      page.getByRole("button", { name: "Unlock transfer" }),
    ).toBeVisible();
    await page.screenshot({
      path: base + `receiver-password-${width}.png`,
      fullPage: true,
    });
  });

test("receiver invalid, expired, normal and slow-network states stay scoped", async ({
  page,
  request,
}) => {
  await page.goto("http://127.0.0.1:3211/t/" + "x".repeat(43));
  await expect(
    page.getByRole("heading", { name: "This sharing link is inactive." }),
  ).toBeVisible();
  const made = (
    await (
      await request.post(fixture + "/api/transfers", {
        data: {
          title: "Synthetic expired transfer",
          resourceIds: [2],
          days: -1,
        },
      })
    ).json()
  ).transfer;
  await page.goto("http://127.0.0.1:3211/t/" + made.id);
  await expect(
    page.getByRole("heading", { name: "This sharing link is inactive." }),
  ).toBeVisible();
  await request.post(fixture + "/__qa/config", { data: { publicDelay: 1500 } });
  const valid = (
    await (
      await request.post(fixture + "/api/transfers", {
        data: { title: "Synthetic slow transfer", resourceIds: [2] },
      })
    ).json()
  ).transfer;
  await page.goto("http://127.0.0.1:3211/t/" + valid.id);
  await expect(page.getByText("Opening your transfer\u2026")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download", exact: true }),
  ).toBeVisible();
});

test("10k assets: hover stays local, paging remains bounded and keyboard/reduced motion work", async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  await request.post(fixture + "/__qa/config", { data: { count: 10000 } });
  await library(page);
  await expect(page.locator(".gallery-card")).toHaveCount(48);
  const client = await page.context().newCDPSession(page);
  await client.send("HeapProfiler.collectGarbage");
  const before = await client.send("Runtime.getHeapUsage");
  for (let i = 0; i < 10; i++) {
    await page
      .locator(".gallery-card")
      .nth(i % 4)
      .hover();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator(".pagination")).toContainText(`Page ${i + 2} of`);
  }
  await client.send("HeapProfiler.collectGarbage");
  const after = await client.send("Runtime.getHeapUsage");
  await expect(page.locator(".gallery-card")).toHaveCount(48);
  expect(
    await page
      .locator(".gallery-card")
      .first()
      .evaluate((e) => getComputedStyle(e).filter),
  ).toBe("none");
  const card = page.locator(".gallery-card").nth(1);
  await card.getByRole("checkbox").check();
  await card.locator(".gallery-card-open").focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".selection-bar")).toHaveCount(0);
  const fs = await import("node:fs/promises");
  await fs.writeFile(
    "docs/unified-ui/evidence/large-gallery.json",
    JSON.stringify(
      {
        dataset: 10000,
        rendered: 48,
        pageCycles: 10,
        reducedMotion: true,
        heapBefore: before.usedSize,
        heapAfter: after.usedSize,
        scope:
          "Synthetic Chromium JS heap; no real photography or GPU-memory claim",
      },
      null,
      2,
    ),
  );
});

test("receiver download all requests one ZIP; storage refresh and unavailable are honest", async ({
  page,
  request,
}) => {
  await request.post(fixture + "/__qa/config", { data: { role: "admin" } });
  await library(page);
  if ((page.viewportSize()?.width ?? 1440) >= 768)
    await page.locator(".aia-sidebar").hover();
  await page
    .getByRole("button", { name: "Storage usage", exact: true })
    .click();
  const meter = page.getByRole("dialog", { name: "Filesystem storage usage" });
  await expect(meter).toContainText("640.0");
  await request.post(fixture + "/__qa/config", {
    data: { storageUsedBytes: 512 * 1024 ** 3 },
  });
  await meter
    .getByRole("button", { name: "Refresh measurement", exact: true })
    .click();
  await expect(meter).toContainText("512.0");
  await request.post(fixture + "/__qa/config", {
    data: { storageUnavailable: true },
  });
  await meter
    .getByRole("button", { name: "Refresh measurement", exact: true })
    .click();
  await expect(
    meter.getByRole("heading", { name: "Usage unavailable", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  const transfer = (
    await (
      await request.post(fixture + "/api/transfers", {
        data: { title: "Synthetic multiple downloads", resourceIds: [1, 2, 3] },
      })
    ).json()
  ).transfer;
  await page.goto("http://127.0.0.1:3211/t/" + transfer.id);
  const started: string[] = [];
  page.on("download", (download) => started.push(download.url()));
  await page
    .getByRole("button", { name: "Download all (3 files)", exact: true })
    .click();
  await expect.poll(() => started.length).toBe(1);
  expect(
    started.every((url) =>
      url.startsWith(
        "http://127.0.0.1:3211/api/public/" + transfer.id + "/archive",
      ),
    ),
  ).toBeTruthy();
});
