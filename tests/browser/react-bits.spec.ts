import { test, expect } from "@playwright/test";
const fixture = "http://127.0.0.1:4522";
const errors = new WeakMap<object, string[]>();
test.beforeEach(async ({ request, context }) => {
  await request.post(fixture + "/__qa/config", {
    data: {
      role: "admin",
      count: 1000,
      libraryAccess: true,
      error: false,
      broken: false,
      delay: 0,
      publicDelay: 0,
      signedIn: true,
      mfaRequired: true,
      inviteError: false,
      mfaError: false,
      publicSeconds: null,
    },
  });
  const messages: string[] = [];
  errors.set(context, messages);
  context.on("page", (p) => p.on("pageerror", (e) => messages.push(e.message)));
  for (const p of context.pages())
    p.on("pageerror", (e) => messages.push(e.message));
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    return u.hostname === "127.0.0.1" && ["3210", "3211"].includes(u.port)
      ? route.continue()
      : route.abort();
  });
});
test.afterEach(async ({ context }) => expect(errors.get(context)).toEqual([]));
async function invite(page: any, request: any, name = "João Albuquerque") {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Staff", exact: true }).click();
  await page.getByRole("button", { name: "Add staff", exact: true }).click();
  await expect(page.getByLabel("Initial password")).toHaveCount(0);
  await page.getByLabel("Full name", { exact: true }).fill(name);
  await page.getByLabel("Username", { exact: true }).fill("new-staff");
  await page
    .getByRole("button", { name: "Create invitation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Invitation created", exact: true }),
  ).toBeVisible();
  return page.getByLabel("Invitation link", { exact: true }).inputValue();
}
async function startSetup(
  page: any,
  request: any,
  name = "João Albuquerque",
  withPhoto = true,
) {
  const link = await invite(page, request, name);
  await request.post(fixture + "/__qa/config", { data: { signedIn: false } });
  const mediaRequests: string[] = [];
  page.on("request", (r: any) => {
    if (/\/api\/(library|collections)/.test(r.url()))
      mediaRequests.push(r.url());
  });
  await page.goto(link);
  await expect(
    page.getByRole("heading", { name: "Welcome, " + name, exact: true }),
  ).toBeVisible();
  expect(page.url()).not.toContain("#");
  await page
    .getByLabel("Choose a password", { exact: true })
    .fill("Synthetic-password-only1!");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("Synthetic-password-only1!");
  if (withPhoto) {
    const data = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 40;
      c.height = 40;
      const x = c.getContext("2d")!;
      x.fillStyle = "#f02020";
      x.fillRect(0, 0, 40, 40);
      return c.toDataURL("image/png").split(",")[1];
    });
    await page.locator("input[type=file]").setInputFiles({
      name: "synthetic-red-portrait.png",
      mimeType: "image/png",
      buffer: Buffer.from(data, "base64"),
    });
  }
  await page
    .getByRole("button", { name: "Continue to authenticator", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Set up your authenticator",
      exact: true,
    }),
  ).toBeVisible();
  expect(mediaRequests).toEqual([]);
  await expect(
    page.getByRole("heading", {
      name: "Account created successfully",
      exact: true,
    }),
  ).toHaveCount(0);
}
test("receiver glass, timestamp countdown, refresh, download, mobile and zero state", async ({
  page,
  request,
}) => {
  const response = await request.post("http://127.0.0.1:3210/api/transfers", {
    data: { title: "React Bits receiver", resourceIds: [2, 3], days: 12 },
  });
  const transfer = (await response.json()).transfer;
  await page.goto("http://127.0.0.1:3211/t/" + transfer.id);
  await expect(page.locator(".receiver-glass .recipient-files")).toBeVisible();
  await expect(page.locator(".expiry-unit")).toHaveCount(4);
  await expect(page.locator(".expiry-status time")).toHaveAttribute(
    "datetime",
    transfer.expiresAt,
  );
  const check = async () => {
    const days = await page
      .locator(".expiry-unit")
      .first()
      .getAttribute("data-value");
    expect(Number(days)).toBeGreaterThanOrEqual(11);
  };
  await check();
  await page.reload();
  await check();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "Download", exact: true })
    .first()
    .click();
  expect((await downloaded).suggestedFilename()).toBeTruthy();
  await page.screenshot({
    path: "docs/react-bits/evidence/receiver-desktop.png",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: "docs/react-bits/evidence/receiver-mobile.png",
  });
  await page.clock.install();
  await page.clock.fastForward(13 * 86400_000);
  await expect(
    page.getByRole("heading", { name: "Transfer expired", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download", exact: true }),
  ).toHaveCount(0);
});
test("administrator invitation remains plain and handles creation failure", async ({
  page,
  request,
}) => {
  await request.post(fixture + "/__qa/config", { data: { inviteError: true } });
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Staff", exact: true }).click();
  await page.getByRole("button", { name: "Add staff", exact: true }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Invited Person");
  await page.getByLabel("Username", { exact: true }).fill("invited-person");
  await page
    .getByRole("button", { name: "Create invitation", exact: true })
    .click();
  await expect(page.locator(".error[role=alert]")).toContainText(
    "Synthetic invitation failure",
  );
  await expect(
    page.getByRole("heading", { name: "Invitation created", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator(
      ".creation-scene .grid-motion, .creation-scene .creation-background",
    ),
  ).toHaveCount(0);
  await page.screenshot({
    path: "docs/react-bits/evidence/admin-invitation.png",
  });
  await request.post(fixture + "/__qa/config", {
    data: { inviteError: false },
  });
  await page
    .getByRole("button", { name: "Create invitation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Invitation created", exact: true }),
  ).toBeVisible();
});
test("recipient completes password and MFA, real chosen photo composes badge, static fallback and navigation", async ({
  page,
  request,
}) => {
  await startSetup(page, request, "João Luís de Albuquerque", true);
  await page
    .getByRole("textbox", { name: "One-time code", exact: true })
    .pressSequentially("000000");
  await expect(page.locator(".error[role=alert]")).toContainText("incorrect");
  await expect(page.locator(".code-slots__row")).toHaveAttribute(
    "data-status",
    "idle",
  );
  await page
    .getByRole("textbox", { name: "One-time code", exact: true })
    .evaluate((input) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData("text/plain", "123456");
      input.dispatchEvent(
        new ClipboardEvent("paste", { bubbles: true, clipboardData }),
      );
    });
  await expect(
    page.getByRole("heading", {
      name: "Account created successfully",
      exact: true,
    }),
  ).toBeVisible();
  const badge = page.getByRole("img", {
    name: "Welcome badge for João Luís de Albuquerque",
    exact: true,
  });
  await expect(badge).toBeVisible();
  await expect
    .poll(() =>
      badge.evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth === 600,
      ),
    )
    .toBe(true);
  const pixel = await badge.evaluate(async (img: HTMLImageElement) => {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 900;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    return [...ctx.getImageData(300, 500, 1, 1).data];
  });
  expect(pixel.slice(0, 3)).toEqual([240, 32, 32]);
  await page.screenshot({
    path: "docs/react-bits/evidence/welcome-badge-static.png",
  });
  await page
    .getByRole("button", { name: "Continue to your workspace", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeVisible();
});
test("WebGL lanyard loads generated faces and supports pointer interaction", async ({
  page,
  request,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await startSetup(page, request, "Ana Martins");
  await page
    .getByRole("textbox", { name: "One-time code", exact: true })
    .pressSequentially("123456");
  await expect(
    page.getByRole("heading", {
      name: "Account created successfully",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("canvas.lanyard-canvas")).toBeVisible();
  await page.waitForTimeout(1600);
  const canvas = page.locator("canvas.lanyard-canvas"),
    rect = (await canvas.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(
    rect.x + rect.width * 0.7,
    rect.y + rect.height * 0.55,
    { steps: 10 },
  );
  await page.mouse.up();
  await canvas.click({ position: { x: rect.width / 2, y: rect.height * 0.6 } });
  await page.screenshot({
    path: "docs/react-bits/evidence/welcome-badge-webgl.png",
  });
});

test("enabling animations restores the real 3D badge under OS reduced motion", async ({
  page,
  request,
}) => {
  await startSetup(page, request, "Motion preference QA");
  await page
    .getByRole("textbox", { name: "One-time code", exact: true })
    .pressSequentially("123456");
  await expect(page.locator(".static-badge")).toBeVisible();
  await page
    .getByRole("button", { name: "Enable animations", exact: true })
    .click();
  await expect(page.locator("canvas.lanyard-canvas")).toBeVisible();
  await expect(page.locator(".badge-pending")).toHaveCount(0);
  await expect(
    page.getByText("Drag to swing. Click the badge to flip.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reduce animations", exact: true })
    .click();
  await expect(page.locator("canvas.lanyard-canvas")).toHaveCount(0);
  await expect(page.locator(".static-badge")).toBeVisible();
});
test("no WebGL, unavailable gallery, mobile and inactive invitation fall back cleanly", async ({
  page,
  request,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: any,
      ...rest: any[]
    ) {
      if (String(type).includes("webgl")) return null;
      return (original as any).call(this, type, ...rest);
    } as any;
  });
  await request.post(fixture + "/__qa/config", { data: { error: true } });
  await startSetup(
    page,
    request,
    "A Very Long Actual Name With Multiple Family Names",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("textbox", { name: "One-time code", exact: true })
    .pressSequentially("123456");
  await expect(page.locator(".static-badge")).toBeVisible();
  await expect(page.locator("canvas.lanyard-canvas")).toHaveCount(0);
  await expect(
    page.getByText("3D graphics are unavailable in this browser.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry 3D badge", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/react-bits/evidence/welcome-mobile-fallback.png",
  });
  await page.goto("/join#" + "z".repeat(43));
  await expect(
    page.getByRole("heading", {
      name: "This invitation is inactive",
      exact: true,
    }),
  ).toBeVisible();
});
test("password verification precedes MFA, rejected paste clears and server-confirmed success signs in", async ({
  page,
  request,
}) => {
  await request.post(fixture + "/__qa/config", { data: { signedIn: false } });
  await page.goto("/");
  await expect(
    page.getByText("WELCOME TO AIA MEDIA", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "One-time code", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Username", { exact: true }).fill("synthetic");
  await page.getByLabel("Password", { exact: true }).fill("bad");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".error[role=alert]")).toContainText("incorrect");
  await expect(
    page.getByRole("textbox", { name: "One-time code", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Synthetic-password-only1!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Two-factor authentication",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "One-time code", exact: true })
    .pressSequentially("000000");
  await expect(page.locator(".error[role=alert]")).toContainText("incorrect");
  await expect(page.locator(".code-slots__row")).toHaveAttribute(
    "data-status",
    "idle",
  );
  await page.screenshot({ path: "docs/react-bits/evidence/mfa-step.png" });
  await page
    .getByRole("textbox", { name: "One-time code", exact: true })
    .pressSequentially("123");
  await expect(page.locator(".code-slots__digit")).toHaveText(["1", "2", "3"]);
  await expect
    .poll(() =>
      page
        .locator(".code-slots__digit")
        .first()
        .evaluate((el) => Number(getComputedStyle(el).opacity)),
    )
    .toBeGreaterThan(0.99);
  expect(
    await page
      .locator(".code-slots__digit")
      .first()
      .evaluate((el) => getComputedStyle(el).color),
  ).toBe("rgb(255, 255, 255)");
  const codeBox = await page.locator(".code-slots").boundingBox(),
    card = await page.locator(".login-panel").boundingBox();
  expect(
    Math.abs(codeBox!.x + codeBox!.width / 2 - card!.x - card!.width / 2),
  ).toBeLessThan(2);
  await page.screenshot({
    path: "docs/react-bits/evidence/mfa-visible-digits.png",
  });
  await page
    .getByRole("textbox", { name: "One-time code", exact: true })
    .pressSequentially("456");
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeVisible();
});
