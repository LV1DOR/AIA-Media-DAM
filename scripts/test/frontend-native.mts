// Run in an isolated NAS image with native credentials provided by the approved private env file.
// Uses an in-memory registry, no listener, an empty test registry, and only a newly created test collection.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createApp } from "../../services/transfer-api/src/app.ts";
import { ResourceSpace } from "../../services/transfer-api/src/adapters.ts";
if (
  process.platform !== "linux" ||
  !process.argv.includes("--approved-native-frontend-test")
)
  throw new Error("Isolated approved native test required");
const identity: { user: string; key: string } = process.argv.includes(
  "--identity-stdin",
)
  ? JSON.parse(readFileSync(0, "utf8"))
  : { user: process.env.AIA_RS_USER!, key: process.env.AIA_RS_KEY! };
if (!identity.user || !identity.key)
  throw new Error("Private native identity is required");
const source = new ResourceSpace(process.env.AIA_RS_URL!),
  password = randomBytes(32).toString("base64url"),
  origin = "http://localhost:3101";
const instance = await createApp(
  {
    dataDir: ":memory:",
    masterKey: randomBytes(32).toString("base64"),
    mediaOrigin: "http://localhost:3100",
    transferOrigin: origin,
    secureCookies: false,
    rsUrl: process.env.AIA_RS_URL!,
    gokapiUrl: process.env.AIA_GOKAPI_URL!,
    gokapiKey: process.env.AIA_GOKAPI_KEY!,
    bootstrapPassword: password,
    rsIdentity: identity,
    requireAdminMfa: false,
  },
  { rs: source },
);
let created: number | undefined,
  session = "";
const send = (method: "GET" | "POST", url: string, payload?: unknown) =>
  instance.app.inject({
    method,
    url,
    payload: payload as any,
    headers: { origin, cookie: session },
  });
const report: Record<string, unknown> = {
  at: new Date().toISOString(),
  scope:
    "New BFF in-memory registry and real native ResourceSpace; no deployed registry or original-media writes",
};
try {
  const login = await send("POST", "/api/auth/login", {
    username: "admin",
    password,
  });
  assert.equal(login.statusCode, 200);
  session = login.cookies.map((c) => c.name + "=" + c.value).join("; ");
  const library = await send("GET", "/api/library");
  assert.equal(library.statusCode, 200);
  const asset = library.json().items[0];
  assert.ok(asset?.id);
  report.previewDimensionsProjected = !!(
    asset.previewWidth && asset.previewHeight
  );
  for (const size of ["thm", "scr"]) {
    const preview = await send(
      "GET",
      `/api/library/${asset.id}/preview?size=${size}`,
    );
    assert.equal(preview.statusCode, 200);
    assert.ok(preview.rawPayload.length > 0);
    report[size + "PreviewBytes"] = preview.rawPayload.length;
  }
  assert.equal(
    (await send("GET", `/api/library/${asset.id}/preview?size=original`))
      .statusCode,
    400,
  );
  const previewInventory = [];
  for (const item of library.json().items) {
    const sizes = await source.call<{ size_code: string; extension: string }[]>(
      identity,
      "get_resource_all_image_sizes",
      { resource: String(item.id) },
    );
    const rendition = ["scr", "pre", "thm", "col"]
      .map((code) => sizes.find((size) => size.size_code === code))
      .find(Boolean);
    assert.ok(rendition);
    const preview = await send("GET", `/api/library/${item.id}/preview`);
    assert.equal(preview.statusCode, 200);
    const nativeUrl = await source.call<string>(identity, "get_resource_path", {
      ref: String(item.id),
      size: rendition.size_code,
      generate: "0",
      extension: rendition.extension,
      write_metadata: "0",
    });
    const expected = Buffer.from(await (await fetch(nativeUrl)).arrayBuffer());
    assert.deepEqual(preview.rawPayload, expected);
    previewInventory.push({
      id: item.id,
      rendition: rendition.size_code,
      bytes: preview.rawPayload.length,
    });
  }
  report.previewInventory = previewInventory;
  const name = "[AIA UI QA] " + randomBytes(8).toString("hex");
  const create = await send("POST", "/api/collections", {
    name,
    resourceIds: [asset.id],
  });
  assert.equal(create.statusCode, 200);
  created = Number(create.json().id);
  assert.ok(Number.isSafeInteger(created) && created > 0);
  assert.deepEqual(create.json().failed, []);
  assert.equal(
    (
      await send("POST", `/api/collections/${created}`, {
        name: name + " renamed",
      })
    ).statusCode,
    200,
  );
  const renamed = (await send("GET", "/api/collections"))
    .json()
    .collections.find((c: any) => Number(c.ref) === created);
  assert.equal(renamed?.name, name + " renamed");
  const detailMembership = (
    await send("GET", "/api/library/" + asset.id)
  ).json();
  assert.equal(detailMembership.collectionsAvailable, true);
  assert.ok(
    detailMembership.collections.some(
      (c: any) => c.ref === created && c.name === name + " renamed",
    ),
  );
  report.visibleCollectionMembershipProjected = true;
  const remove = await send("POST", `/api/collections/${created}/members`, {
    action: "remove",
    resourceIds: [asset.id],
  });
  assert.deepEqual(remove.json(), { updated: [asset.id], failed: [] });
  assert.equal(
    (await send("GET", `/api/library?search=!collection${created}`)).json()
      .total,
    0,
  );
  const add = await send("POST", `/api/collections/${created}/members`, {
    action: "add",
    resourceIds: [asset.id],
  });
  assert.deepEqual(add.json(), { updated: [asset.id], failed: [] });
  assert.ok(
    (await send("GET", `/api/library?search=!collection${created}`))
      .json()
      .items.some((a: any) => a.id === asset.id),
  );
  assert.equal(
    (
      await send("POST", `/api/collections/${created}`, {
        name: "[AIA Transfer] reserved",
      })
    ).statusCode,
    400,
  );
  report.nativeCreateRenameAddRemove = true;
  report.originalDetailStillAccessible =
    (await send("GET", "/api/library/" + asset.id)).statusCode === 200;
  assert.equal(report.originalDetailStillAccessible, true);
  report.passed = true;
} finally {
  if (created) {
    await source.call(identity, "delete_collection", { ref: String(created) });
    const remaining = await source.call<{ ref: number }[]>(
      identity,
      "get_user_collections",
    );
    assert.ok(
      !remaining.some((c) => Number(c.ref) === created),
      "New test collection cleanup failed",
    );
    report.testCollectionRemoved = true;
  }
  await instance.app.close();
}
console.log(JSON.stringify(report));
