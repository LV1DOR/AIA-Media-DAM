import { readFile, mkdtemp, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { reviewIdentity } from "../scripts/dev/review-identity.mts";
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import * as OTPAuth from "otpauth";
import { createApp, type Config } from "../services/transfer-api/src/app.js";
import { Store } from "../services/transfer-api/src/store.js";
import { originalZip } from "../services/transfer-api/src/zip.js";
import {
  SecretBox,
  hashPassword,
  checkPassword,
  token,
  digest,
  disposition,
} from "../services/transfer-api/src/security.js";
import {
  sourceUrl,
  ResourceSpace,
  Gokapi,
  UpstreamError,
} from "../services/transfer-api/src/adapters.js";
const password = "Synthetic-test-password-only1!";
const origin = "http://localhost:3101";

test("review identities keep accounts, photos, invitations, sessions and MFA across API restarts", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "aia-identity-test-"));
  let current: Awaited<ReturnType<typeof createApp>> | undefined;
  try {
    const identity = await reviewIdentity(directory);
    const config: Config = {
      ...identity,
      mediaOrigin: "http://localhost:3100",
      transferOrigin: origin,
      secureCookies: false,
      rsUrl: "http://127.0.0.1:1",
      gokapiUrl: "http://127.0.0.1:1",
      gokapiKey: "synthetic-only",
      bootstrapPassword: password,
      requireAdminMfa: false,
    };
    current = await createApp(config);
    const originalAdminHash = current.store.get<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE username='admin'",
    )!.password_hash;
    const send = (url: string, body: unknown, cookie = "") =>
      current!.app.inject({
        method: "POST",
        url,
        payload: body,
        headers: { origin, cookie },
      });
    const logged = await send("/api/auth/login", {
      username: "admin",
      password,
    });
    const admin = logged.cookies.map((c) => c.name + "=" + c.value).join("; ");
    const created = await send(
      "/api/admin/users",
      {
        username: "lasting-staff",
        name: "Persistent Staff",
        role: "marketer",
        libraryAccess: false,
      },
      admin,
    );
    assert.equal(created.statusCode, 200, created.body);
    const raw = created.json().invitationUrl.split("#")[1];
    await uploadInvitationPhoto(current, raw);
    const started = await send("/api/auth/invitation/start", {
      token: raw,
      password: "Abcd123!",
    });
    assert.equal(started.statusCode, 200, started.body);
    const totp = new OTPAuth.TOTP({ secret: started.json().secret });
    // Enrollment itself must also survive a service restart.
    await current.app.close();
    current = await createApp(config);
    const finished = await send(
      "/api/auth/invitation/complete",
      {
        code: totp.generate(),
      },
      started.cookies.map((c) => c.name + "=" + c.value).join("; "),
    );
    assert.equal(finished.statusCode, 200, finished.body);
    const staffCookie = finished.cookies
      .map((c) => c.name + "=" + c.value)
      .join("; ");
    const pending = await send(
      "/api/admin/users",
      {
        username: "pending-staff",
        name: "Pending Staff",
        role: "marketer",
        libraryAccess: false,
      },
      admin,
    );
    const pendingToken = pending.json().invitationUrl.split("#")[1];
    await current.app.close();
    current = undefined;
    const reopened = await reviewIdentity(directory);
    assert.equal(reopened.masterKey, identity.masterKey);
    current = await createApp({
      ...config,
      ...reopened,
      bootstrapPassword: "Replacement-bootstrap-must-not-reset1!",
    });
    assert.equal(
      current.store.get<{ password_hash: string }>(
        "SELECT password_hash FROM users WHERE username='admin'",
      )!.password_hash,
      originalAdminHash,
    );
    const me = await current.app.inject({
      url: "/api/auth/me",
      headers: { cookie: staffCookie },
    });
    assert.equal(me.statusCode, 200);
    assert.equal(me.json().user.username, "lasting-staff");
    assert.equal(me.json().user.mfaEnabled, true);
    assert.equal(
      (
        await current.app.inject({
          url: "/api/auth/profile-photo",
          headers: { cookie: staffCookie },
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (await send("/api/auth/invitation/read", { token: pendingToken }))
        .statusCode,
      200,
    );
    const code = totp.generate({ timestamp: Date.now() + 30000 });
    assert.equal(
      (
        await send("/api/auth/login", {
          username: "lasting-staff",
          password: "Abcd123!",
          code,
        })
      ).statusCode,
      200,
    );
    await current.app.close();
    current = undefined;
    await assert.rejects(
      () =>
        createApp({ ...config, masterKey: randomBytes(32).toString("base64") }),
      /encryption key does not match/,
    );
    current = await createApp(config);
    assert.equal(
      (
        await send("/api/auth/login", {
          username: "lasting-staff",
          password: "Abcd123!",
          code,
        })
      ).statusCode,
      401,
      "MFA codes cannot be replayed after restart",
    );
    assert.equal(current.store.all("SELECT id FROM users").length, 3);
    await current.app.close();
    current = undefined;
    await unlink(path.join(directory, "master-key"));
    await assert.rejects(() => reviewIdentity(directory), /key is missing/);
    const unchanged = new Store(directory);
    assert.equal(unchanged.all("SELECT id FROM users").length, 3);
    unchanged.close();
  } finally {
    await current?.app.close();
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
});
test("native multipart upload accepts its documented empty 204 success response", async () => {
  const server = createServer((_req, res) => {
    res.writeHead(204);
    res.end();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    const source = new ResourceSpace(
      "http://127.0.0.1:" + (server.address() as { port: number }).port,
    );
    assert.deepEqual(
      await source.call(
        { user: "fixture", key: "fixture" },
        "upload_multipart",
        {},
        { blob: new Blob(["fixture"]), name: "fixture.jpg" },
      ),
      { status: "success" },
    );
    await assert.rejects(() =>
      source.call({ user: "fixture", key: "fixture" }, "get_resource_data"),
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});
test("native upload publishes only after processing and uses numeric false upload flags", async () => {
  const calls: URLSearchParams[] = [];
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const b of req) chunks.push(Buffer.from(b));
    const bytes = Buffer.concat(chunks);
    const form = req.headers["content-type"]?.startsWith("multipart/")
      ? await new Response(bytes, {
          headers: { "Content-Type": req.headers["content-type"]! },
        }).formData()
      : new URLSearchParams(bytes.toString());
    const query = new URLSearchParams(String(form.get("query")));
    calls.push(query);
    if (query.get("function") === "upload_multipart") {
      res.writeHead(204);
      res.end();
    } else {
      res.setHeader("Content-Type", "application/json");
      res.end(query.get("function") === "create_resource" ? "42" : "true");
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    const source = new ResourceSpace(
      "http://127.0.0.1:" + (server.address() as { port: number }).port,
    );
    assert.equal(
      await source.upload(
        { user: "fixture", key: "fixture" },
        "fixture.jpg",
        new Blob(["fixture"]),
        1,
      ),
      42,
    );
    const publication = calls.find(
      (c) => c.get("function") === "put_resource_data",
    )!;
    assert.deepEqual(JSON.parse(publication.get("data")!), { archive: 0 });
    assert.equal(calls.at(-1)!.get("function"), "put_resource_data");
    assert.equal(calls[0].get("archive"), "-1"); // private while processing, never queued for human review
    const upload = calls.find((c) => c.get("function") === "upload_multipart")!;
    for (const key of ["no_exif", "revert", "autorotate"])
      assert.equal(upload.get(key), "0");
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});
class FakeGokapi {
  objects = new Map<string, Uint8Array>();
  chunks = new Map<string, Uint8Array[]>();
  deleted: string[] = [];
  failDelete = false;
  failCompleteResponse = false;
  names = new Map<string, string>();
  base = "";
  async chunk(uuid: string, _size: number, _offset: number, bytes: Uint8Array) {
    const chunks = this.chunks.get(uuid) || [];
    chunks.push(bytes);
    this.chunks.set(uuid, chunks);
  }
  async complete(uuid: string, size: number, name: string) {
    const id = token();
    this.objects.set(id, Buffer.concat(this.chunks.get(uuid) || []));
    this.names.set(name, id);
    if (this.failCompleteResponse)
      throw new Error("Synthetic connection lost after native completion");
    return { Id: id, SizeBytes: size };
  }
  async find(name: string, size: number) {
    const id = this.names.get(name);
    return id && this.objects.get(id)?.length === size
      ? { Id: id, SizeBytes: size }
      : undefined;
  }
  async info(id: string) {
    return { UrlHotlink: this.base + "/file/" + id };
  }
  async remove(id: string) {
    if (this.failDelete) throw new Error("Synthetic source outage");
    this.objects.delete(id);
    this.deleted.push(id);
  }
}
async function fixture(mfa = false, rs?: ResourceSpace) {
  const upstream = new FakeGokapi();
  const http = createServer((req, res) => {
    const bytes = upstream.objects.get(req.url?.split("/").pop() || "");
    if (!bytes) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", bytes.length);
    res.end(bytes);
  });
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
  upstream.base =
    "http://127.0.0.1:" + (http.address() as { port: number }).port;
  const config: Config = {
    dataDir: ":memory:",
    masterKey: randomBytes(32).toString("base64"),
    mediaOrigin: "http://localhost:3100",
    transferOrigin: origin,
    secureCookies: false,
    rsUrl: "http://127.0.0.1:1",
    gokapiUrl: upstream.base,
    gokapiKey: "synthetic-key",
    bootstrapPassword: password,
    requireAdminMfa: mfa,
  };
  const instance = await createApp(config, {
    store: new Store(":memory:"),
    gokapi: upstream as unknown as Gokapi,
    rs,
  });
  const login = await instance.app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers: { origin },
    payload: { username: "admin", password },
  });
  assert.equal(login.statusCode, 200);
  const cookie = login.cookies.map((c) => c.name + "=" + c.value).join("; ");
  const send = (
    method: "GET" | "POST",
    url: string,
    payload?: any,
    session = cookie,
  ) =>
    instance.app.inject({
      method,
      url,
      headers: {
        origin,
        cookie: session,
        ...(Buffer.isBuffer(payload)
          ? { "content-type": "application/octet-stream" }
          : {}),
      },
      payload,
    });
  const close = async () => {
    await instance.app.close();
    await new Promise<void>((r) => http.close(() => r()));
  };
  return { ...instance, config, upstream, cookie, send, close };
}
async function uploadInvitationPhoto(
  f: Pick<Awaited<ReturnType<typeof fixture>>, "app">,
  raw: string,
) {
  const bytes = await readFile(
    new URL("./fixtures/profile.png", import.meta.url),
  );
  const boundary = "synthetic-photo-boundary";
  const payload = Buffer.concat([
    Buffer.from(
      "--" +
        boundary +
        '\r\nContent-Disposition: form-data; name="photo"; filename="profile.png"\r\nContent-Type: image/png\r\n\r\n',
    ),
    bytes,
    Buffer.from("\r\n--" + boundary + "--\r\n"),
  ]);
  const result = await f.app.inject({
    method: "POST",
    url: "/api/auth/invitation/photo",
    headers: {
      origin,
      "x-aia-invitation": raw,
      "content-type": "multipart/form-data; boundary=" + boundary,
    },
    payload,
  });
  assert.equal(result.statusCode, 200);
}
async function transfer(
  f: Awaited<ReturnType<typeof fixture>>,
  options: Record<string, unknown> = {},
) {
  const create = await f.send("POST", "/api/transfers", {
    title: "Synthetic grouped handoff",
    files: [
      { name: "ação.txt", size: 5 },
      { name: "ação.txt", size: 5 },
    ],
    days: 1,
    password: "recipient-test-password",
    ...options,
  });
  assert.equal(create.statusCode, 200, create.body);
  const t = create.json().transfer;
  assert.equal(t.totalBytes, 10);
  for (const file of t.files) {
    const result = await f.send(
      "POST",
      `/api/transfers/${t.id}/chunk?fileId=${file.id}&offset=0`,
      Buffer.from("hello"),
    );
    assert.equal(result.statusCode, 200, result.body);
    assert.equal(
      (
        await f.send("POST", `/api/transfers/${t.id}/complete-file`, {
          fileId: file.id,
        })
      ).statusCode,
      200,
    );
  }
  const active = await f.send("POST", `/api/transfers/${t.id}/activate`);
  assert.equal(active.statusCode, 200, active.body);
  return active.json().transfer;
}
test("password hashes are salted and authenticated secret envelopes reject tampering", async () => {
  const a = await hashPassword(password),
    b = await hashPassword(password);
  assert.notEqual(a, b);
  assert.equal(await checkPassword(password, a), true);
  assert.equal(await checkPassword("wrong", a), false);
  const box = new SecretBox(randomBytes(32).toString("base64"));
  const envelope = box.seal({ key: "synthetic-only" });
  assert.deepEqual(box.open(envelope), { key: "synthetic-only" });
  const bytes = Buffer.from(envelope, "base64");
  bytes[20] ^= 1;
  assert.throws(() => box.open(bytes.toString("base64")));
});
test("upstream URLs cannot leave the configured origin or carry credentials", () => {
  assert.throws(() =>
    sourceUrl("https://outside.invalid/file", "http://127.0.0.1:1"),
  );
  assert.throws(() =>
    sourceUrl("http://user:pass@127.0.0.1:1/file", "http://127.0.0.1:1"),
  );
  assert.match(disposition("bad\r\nheader/ação.txt"), /^attachment;/);
  assert.ok(!disposition("bad\r\nname").includes("\r"));
});
test("cross-origin mutations, unauthenticated staff calls and invalid credentials are denied", async () => {
  const f = await fixture();
  try {
    assert.equal(
      (
        await f.app.inject({
          method: "POST",
          url: "/api/transfers",
          headers: { origin: "https://outside.invalid", cookie: f.cookie },
          payload: {},
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (await f.send("GET", "/api/transfers", undefined, "")).statusCode,
      401,
    );
    assert.equal(
      (
        await f.send(
          "POST",
          "/api/auth/login",
          { username: "admin", password: "incorrect" },
          "",
        )
      ).statusCode,
      401,
    );
  } finally {
    await f.close();
  }
});
test("a single group password protects every duplicate-named Unicode object", async () => {
  const f = await fixture();
  try {
    const t = await transfer(f);
    const preview = await f.send("GET", "/api/public/" + t.id, undefined, "");
    assert.equal(preview.json().locked, true);
    for (const file of t.files)
      assert.equal(
        (
          await f.send(
            "GET",
            `/api/public/${t.id}/files/${file.id}`,
            undefined,
            "",
          )
        ).statusCode,
        403,
      );
    assert.equal(
      (
        await f.send(
          "POST",
          `/api/public/${t.id}/authorize`,
          { password: "wrong" },
          "",
        )
      ).statusCode,
      403,
    );
    const unlocked = await f.send(
      "POST",
      `/api/public/${t.id}/authorize`,
      { password: "recipient-test-password" },
      "",
    );
    const grant = unlocked.cookies
      .map((c) => c.name + "=" + c.value)
      .join("; ");
    assert.equal(unlocked.cookies[0].httpOnly, true);
    assert.equal(unlocked.cookies[0].path, "/api/public/" + t.id);
    const manifest = (
      await f.send("GET", "/api/public/" + t.id, undefined, grant)
    ).json();
    assert.equal(manifest.files.length, 2);
    assert.equal(manifest.files[0].name, "ação.txt");
    assert.notEqual(manifest.files[0].id, manifest.files[1].id);
    for (const file of manifest.files) {
      const download = await f.send(
        "GET",
        `/api/public/${t.id}/files/${file.id}`,
        undefined,
        grant,
      );
      assert.equal(download.body, "hello");
      assert.match(
        download.headers["content-disposition"] as string,
        /filename\*=UTF-8/,
      );
    }
    assert.ok(!JSON.stringify(manifest).includes("source_secret"));
    assert.ok(!JSON.stringify(manifest).includes("UrlHotlink"));
  } finally {
    await f.close();
  }
});

function unzipStored(bytes: Buffer) {
  const entries = new Map<string, Buffer>();
  for (let pos = 0; pos < bytes.length - 46; pos++) {
    if (bytes.readUInt32LE(pos) !== 0x02014b50) continue;
    const length = bytes.readUInt16LE(pos + 28),
      size = bytes.readUInt32LE(pos + 24);
    const name = bytes.subarray(pos + 46, pos + 46 + length).toString("utf8");
    const local = bytes.readUInt32LE(pos + 42);
    assert.equal(
      bytes.readUInt16LE(pos + 10),
      0,
      "Original ZIP entry uses STORE",
    );
    assert.equal(bytes.readUInt32LE(local), 0x04034b50);
    const start =
      local +
      30 +
      bytes.readUInt16LE(local + 26) +
      bytes.readUInt16LE(local + 28);
    entries.set(name, bytes.subarray(start, start + size));
  }
  return entries;
}

test("ZIP retains exact binary original bytes and strips unsafe paths", async () => {
  const bytes = randomBytes(262144);
  const zip = originalZip(
    [
      { name: "../../original.jpg", open: async () => new Response(bytes) },
      { name: "..\\original.jpg", open: async () => new Response(bytes) },
    ],
    new AbortController().signal,
  );
  const chunks: Buffer[] = [];
  const consume = (async () => {
    for await (const chunk of zip) chunks.push(Buffer.from(chunk));
  })();
  await zip.finalize();
  await consume;
  const files = unzipStored(Buffer.concat(chunks));
  assert.deepEqual([...files.keys()], ["original.jpg", "original (2).jpg"]);
  for (const file of files.values()) assert.deepEqual(file, bytes);
});

test("ZIP downloads protect originals, retain duplicate Unicode filenames and consume one download start", async () => {
  const f = await fixture();
  try {
    const t = await transfer(f, { downloadLimit: 1 });
    const url = `/api/public/${t.id}/archive`;
    assert.equal((await f.send("GET", url, undefined, "")).statusCode, 403);
    const unlock = await f.send(
      "POST",
      `/api/public/${t.id}/authorize`,
      { password: "recipient-test-password" },
      "",
    );
    const grant = unlock.cookies.map((c) => c.name + "=" + c.value).join("; ");
    const response = await f.send("GET", url, undefined, grant);
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.headers["content-type"], "application/zip");
    const files = unzipStored(response.rawPayload);
    assert.deepEqual(
      [...files.keys()],
      ["a\u00e7\u00e3o.txt", "a\u00e7\u00e3o (2).txt"],
    );
    for (const bytes of files.values())
      assert.deepEqual(bytes, Buffer.from("hello"));
    assert.equal(f.store.transfer(t.id)?.downloads, 1);
    assert.equal((await f.send("GET", url, undefined, grant)).statusCode, 410);
  } finally {
    await f.close();
  }
});

test("ZIP rejects revoked, incomplete and anonymous locked transfers without consuming a start", async () => {
  const f = await fixture();
  try {
    const t = await transfer(f, { password: "" });
    f.store.run("UPDATE files SET complete=0 WHERE id=?", t.files[0].id);
    assert.equal(
      (await f.send("GET", `/api/public/${t.id}/archive`)).statusCode,
      410,
    );
    assert.equal(f.store.transfer(t.id)?.downloads, 0);
    f.store.run("UPDATE files SET complete=1 WHERE transfer_id=?", t.id);
    await f.send("POST", `/api/transfers/${t.id}/revoke`);
    assert.equal(
      (await f.send("GET", `/api/public/${t.id}/archive`)).statusCode,
      410,
    );
  } finally {
    await f.close();
  }
});
test("ownership prevents other staff editing or listing someone else’s transfers", async () => {
  const f = await fixture();
  try {
    const t = await transfer(f);
    const id = token();
    f.store.run(
      "INSERT INTO users(id,username,name,role,password_hash) VALUES(?,?,?,?,?)",
      id,
      "other",
      "Other synthetic user",
      "marketer",
      await hashPassword(password),
    );
    const session = token();
    f.store.run(
      "INSERT INTO sessions(hash,user_id,expires,version) VALUES(?,?,?,?)",
      digest(session),
      id,
      Date.now() + 10000,
      0,
    );
    const cookie = "aia_staff=" + session;
    assert.equal(
      (await f.send("POST", `/api/transfers/${t.id}/revoke`, {}, cookie))
        .statusCode,
      404,
    );
    assert.deepEqual(
      (await f.send("GET", "/api/transfers", undefined, cookie)).json()
        .transfers,
      [],
    );
    assert.equal(
      (await f.send("GET", "/api/admin/users", undefined, cookie)).statusCode,
      403,
    );
    assert.equal(
      (await f.send("GET", "/api/library?state=2", undefined, cookie))
        .statusCode,
      403,
    );
  } finally {
    await f.close();
  }
});
test("revocation blocks cached group/file URLs even when native cleanup fails, then retries", async () => {
  const f = await fixture();
  try {
    const t = await transfer(f, { password: "" });
    f.upstream.failDelete = true;
    const revoke = await f.send("POST", `/api/transfers/${t.id}/revoke`);
    assert.equal(revoke.json().cleanupPending, true);
    assert.equal(
      (
        await f.send(
          "GET",
          `/api/public/${t.id}/files/${t.files[0].id}`,
          undefined,
          "",
        )
      ).statusCode,
      410,
    );
    f.upstream.failDelete = false;
    await f.cleanup();
    assert.equal(f.store.transfer(t.id)?.state, "revoked");
    assert.equal(f.upstream.deleted.length, 2);
  } finally {
    await f.close();
  }
});
test("expiry blocks access before asynchronous source cleanup and reconciles both objects", async () => {
  const f = await fixture();
  try {
    const t = await transfer(f, { password: "" });
    f.store.run(
      "UPDATE transfers SET expires_at=? WHERE id=?",
      new Date(Date.now() - 1000).toISOString(),
      t.id,
    );
    assert.equal(
      (await f.send("GET", "/api/public/" + t.id, undefined, "")).statusCode,
      410,
    );
    await f.cleanup();
    assert.equal(f.store.transfer(t.id)?.state, "expired");
    assert.equal(f.upstream.deleted.length, 2);
  } finally {
    await f.close();
  }
});
test("concurrent object downloads cannot exceed the shared group download-start quota", async () => {
  const f = await fixture();
  try {
    const t = await transfer(f, { password: "", downloadLimit: 1 });
    const results = await Promise.all(
      t.files.map((file: any) =>
        f.send("GET", `/api/public/${t.id}/files/${file.id}`, undefined, ""),
      ),
    );
    assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 410]);
    assert.equal(f.store.transfer(t.id)?.downloads, 1);
  } finally {
    await f.close();
  }
});
test("disabled owners lose sessions and all recipient delivery immediately", async () => {
  const f = await fixture();
  try {
    const t = await transfer(f, { password: "" });
    f.store.run(
      "UPDATE users SET disabled=1 WHERE id=?",
      f.store.transfer(t.id)!.owner,
    );
    assert.equal((await f.send("GET", "/api/transfers")).statusCode, 401);
    assert.equal(
      (await f.send("GET", "/api/public/" + t.id, undefined, "")).statusCode,
      410,
    );
  } finally {
    await f.close();
  }
});
test("managed native accounts disable only after share cleanup and retry an upstream failure", async () => {
  const calls: string[] = [];
  let offline = true;
  const source = {
    call: async (_who: unknown, fn: string, args: Record<string, string>) => {
      calls.push(fn + ":" + args.enabled);
      if (offline) throw new Error("Synthetic source outage");
      return { enabled: args.enabled === "1" };
    },
  } as unknown as ResourceSpace;
  const f = await fixture(false, source);
  try {
    f.config.rsProvisionIdentity = {
      user: "synthetic-service",
      key: "synthetic-key",
    };
    const id = token();
    f.store.run(
      "INSERT INTO users(id,username,name,role,password_hash,rs_credentials,source_managed,disabled) VALUES(?,?,?,?,?,?,1,1)",
      id,
      "managedfixture",
      "Managed fixture",
      "marketer",
      await hashPassword(password),
      f.box.seal({ user: "aia_managedfixture", key: "synthetic-key" }),
    );
    await f.cleanup();
    assert.equal(f.store.user(id)?.source_disabled, 0);
    offline = false;
    await f.cleanup();
    assert.equal(f.store.user(id)?.source_disabled, 1);
    assert.deepEqual(calls, [
      "aia_staff_set_enabled:0",
      "aia_staff_set_enabled:0",
    ]);
    const enabled = await f.send("POST", "/api/admin/users/" + id, {
      disabled: false,
    });
    assert.equal(enabled.statusCode, 200);
    assert.equal(f.store.user(id)?.source_disabled, 0);
    assert.equal(calls.at(-1), "aia_staff_set_enabled:1");
  } finally {
    await f.close();
  }
});
test("bulk metadata authorizes the full selection before writes and reports partial native failures", async () => {
  let denySecond = true,
    failSecond = false;
  const written: number[] = [];
  const rs = {
    detail: async (_who: unknown, id: number) => {
      if (id === 2 && denySecond) throw new UpstreamError(403);
      return {};
    },
    call: async (_who: unknown, _fn: string, args: Record<string, string>) => {
      if (Number(args.resource) === 2 && failSecond)
        throw new UpstreamError(502);
      written.push(Number(args.resource));
      return true;
    },
  } as unknown as ResourceSpace;
  const f = await fixture(false, rs);
  try {
    const u = f.store.get<{ id: string }>(
      "SELECT id FROM users WHERE username='admin'",
    )!;
    f.store.run(
      "UPDATE users SET rs_credentials=? WHERE id=?",
      f.box.seal({ user: "fixture", key: "fixture" }),
      u.id,
    );
    const payload = {
      resourceIds: [1, 2],
      fields: [{ id: 3, value: "Synthetic keywords" }],
    };
    assert.equal(
      (await f.send("POST", "/api/library/bulk-metadata", payload)).statusCode,
      403,
    );
    assert.deepEqual(written, []);
    denySecond = false;
    failSecond = true;
    const partial = await f.send("POST", "/api/library/bulk-metadata", payload);
    assert.deepEqual(partial.json(), { updated: [1], failed: [2] });
    f.store.run("UPDATE users SET role='marketer' WHERE id=?", u.id);
    assert.equal(
      (await f.send("POST", "/api/library/bulk-metadata", payload)).statusCode,
      403,
    );
  } finally {
    await f.close();
  }
});
test("administrator enrollment is enforced and TOTP enables protected routes", async () => {
  const f = await fixture(true);
  try {
    assert.equal((await f.send("GET", "/api/transfers")).statusCode, 428);
    const setup = await f.send("POST", "/api/auth/mfa/setup");
    assert.equal(setup.statusCode, 200);
    const totp = new OTPAuth.TOTP({ secret: setup.json().secret });
    const confirmed = await f.send("POST", "/api/auth/mfa/confirm", {
      code: totp.generate(),
    });
    assert.equal(confirmed.statusCode, 200);
    assert.equal((await f.send("GET", "/api/transfers")).statusCode, 401);
    const rotated = confirmed.cookies
      .map((c) => c.name + "=" + c.value)
      .join("; ");
    assert.equal(
      (await f.send("GET", "/api/transfers", undefined, rotated)).statusCode,
      200,
    );
  } finally {
    await f.close();
  }
});
test("lost completion responses recover one native object and revocation cleans it up", async () => {
  const f = await fixture();
  try {
    for (const revokeFirst of [false, true]) {
      const t = (
        await f.send("POST", "/api/transfers", {
          title: "Interrupted completion",
          files: [{ name: "fixture.bin", size: 5 }],
        })
      ).json().transfer;
      const file = t.files[0];
      await f.send(
        "POST",
        `/api/transfers/${t.id}/chunk?fileId=${file.id}&offset=0`,
        Buffer.from("hello"),
      );
      f.upstream.failCompleteResponse = true;
      assert.equal(
        (
          await f.send("POST", `/api/transfers/${t.id}/complete-file`, {
            fileId: file.id,
          })
        ).statusCode,
        500,
      );
      assert.equal(f.store.files(t.id)[0].finalizing, 1);
      assert.equal(
        (await f.send("GET", "/api/public/" + t.id, undefined, "")).statusCode,
        410,
      );
      f.upstream.failCompleteResponse = false;
      if (!revokeFirst) {
        assert.equal(
          (
            await f.send("POST", `/api/transfers/${t.id}/complete-file`, {
              fileId: file.id,
            })
          ).statusCode,
          200,
        );
        assert.equal(f.upstream.objects.size, 1);
      }
      const revoked = await f.send("POST", `/api/transfers/${t.id}/revoke`);
      assert.equal(revoked.json().sourceRevoked, true);
      assert.equal(f.upstream.objects.size, 0);
    }
  } finally {
    await f.close();
  }
});
test("controlled metadata choices use the native ref binding and require reviewer access", async () => {
  const calls: unknown[] = [];
  const rs = {
    call: async (_who: unknown, fn: string, params: unknown) => {
      calls.push({ fn, params });
      return [{ ref: 7, name: "Native event" }];
    },
  } as unknown as ResourceSpace;
  const f = await fixture(false, rs);
  try {
    const u = f.store.get<{ id: string }>(
      "SELECT id FROM users WHERE username='admin'",
    )!;
    f.store.run(
      "UPDATE users SET rs_credentials=? WHERE id=?",
      f.box.seal({ user: "fixture", key: "fixture" }),
      u.id,
    );
    assert.deepEqual(
      (await f.send("GET", "/api/library/fields/89/options")).json(),
      { options: [{ id: 7, value: "Native event" }] },
    );
    assert.deepEqual(calls, [{ fn: "get_nodes", params: { ref: "89" } }]);
    f.store.run("UPDATE users SET role='marketer' WHERE id=?", u.id);
    assert.equal(
      (await f.send("GET", "/api/library/fields/89/options")).statusCode,
      403,
    );
  } finally {
    await f.close();
  }
});
test("drafts are not public and offsets cannot skip bytes or cross transfer boundaries", async () => {
  const f = await fixture();
  try {
    const t = (
      await f.send("POST", "/api/transfers", {
        title: "Draft",
        days: 1,
        files: [{ name: "a.bin", size: 5 }],
      })
    ).json().transfer;
    assert.equal(
      (await f.send("GET", "/api/public/" + t.id, undefined, "")).statusCode,
      410,
    );
    assert.equal(
      (await f.send("POST", `/api/transfers/${t.id}/activate`)).statusCode,
      409,
    );
    assert.equal(
      (
        await f.send(
          "POST",
          `/api/transfers/${t.id}/chunk?fileId=${t.files[0].id}&offset=2`,
          Buffer.from("hey"),
        )
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await f.send(
          "POST",
          `/api/transfers/${t.id}/chunk?fileId=foreign&offset=0`,
          Buffer.from("hello"),
        )
      ).statusCode,
      409,
    );
  } finally {
    await f.close();
  }
});

test("collection changes preserve source authorization, transfer namespace and partial failures", async () => {
  let denySecond = true,
    allowWrite = true;
  const writes: string[] = [];
  const rs = {
    detail: async (_who: unknown, id: number) => {
      if (id === 2 && denySecond) throw new UpstreamError(403);
      return {};
    },
    call: async (_who: unknown, fn: string, args: Record<string, string>) => {
      if (fn === "get_user_collections")
        return [
          { ref: 1, name: "Project" },
          { ref: 2, name: "[AIA Transfer] protected" },
        ];
      writes.push(fn + ":" + (args.resource || args.ref || ""));
      if (fn === "create_collection") return 3;
      return allowWrite ? true : "Native permission denied";
    },
  } as unknown as ResourceSpace;
  const f = await fixture(false, rs);
  try {
    const u = f.store.get<{ id: string }>(
      "SELECT id FROM users WHERE username='admin'",
    )!;
    f.store.run(
      "UPDATE users SET rs_credentials=? WHERE id=?",
      f.box.seal({ user: "fixture", key: "fixture" }),
      u.id,
    );
    assert.equal(
      (await f.send("POST", "/api/collections/1", { name: "Renamed" }, ""))
        .statusCode,
      401,
    );
    assert.equal(
      (await f.send("POST", "/api/collections/2", { name: "Renamed" }))
        .statusCode,
      403,
    );
    assert.equal(
      (await f.send("POST", "/api/collections/99", { name: "Renamed" }))
        .statusCode,
      404,
    );
    assert.equal(
      (
        await f.send("POST", "/api/collections/1", {
          name: "[AIA Transfer] reserved",
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await f.send("POST", "/api/collections/1/members", {
          action: "remove",
          resourceIds: [1, 2],
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await f.send("POST", "/api/collections", {
          name: "Project",
          resourceIds: [1, 2],
        })
      ).statusCode,
      403,
    );
    assert.deepEqual(writes, []);
    denySecond = false;
    allowWrite = false;
    assert.equal(
      (await f.send("POST", "/api/collections/1", { name: "Renamed" }))
        .statusCode,
      403,
    );
    assert.deepEqual(
      (
        await f.send("POST", "/api/collections/1/members", {
          action: "remove",
          resourceIds: [1, 2],
        })
      ).json(),
      { updated: [], failed: [1, 2] },
    );
    allowWrite = true;
    assert.deepEqual(
      (
        await f.send("POST", "/api/collections/1/members", {
          action: "add",
          resourceIds: [1, 1, 2],
        })
      ).json(),
      { updated: [1, 2], failed: [] },
    );
    assert.equal(
      writes.filter((w) => w === "add_resource_to_collection:1").length,
      1,
    );
    assert.equal(
      (
        await f.send("POST", "/api/collections/1", {
          name: "Renamed",
          owner: 99,
        })
      ).statusCode,
      400,
    );
  } finally {
    await f.close();
  }
});

test("native preview choices stay on-source and never generate or rewrite media", async () => {
  const choices: Record<string, string>[] = [];
  const server = createServer((_req, res) => {
    res.end("synthetic preview");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base =
    "http://127.0.0.1:" + (server.address() as { port: number }).port;
  const source = new ResourceSpace(base);
  source.call = async <T>(
    _who: unknown,
    fn: string,
    args?: Record<string, string>,
  ) => {
    if (fn === "get_resource_data")
      return { file_extension: "raw", preview_extension: "jpg" } as T;
    if (fn === "get_resource_all_image_sizes")
      return [{ size_code: "scr", extension: "jpg" }] as T;
    choices.push(args!);
    return (base + "/preview") as T;
  };
  try {
    const who = { user: "fixture", key: "fixture" };
    for (const args of [
      [false, undefined, false, true],
      [false, undefined, false, false],
      [true, undefined, false, false],
    ] as const) {
      const response = await source.preview(who, 1, ...args);
      await response.text();
    }
    assert.deepEqual(
      choices.map((c) => c.size),
      ["thm", "scr", ""],
    );
    for (const c of choices) {
      assert.equal(c.generate, "0");
      assert.equal(c.write_metadata, "0");
    }
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("detail membership exposes only caller-visible normal collections after resource authorization", async () => {
  let deny = false,
    unavailable = false,
    calls = 0;
  const rs = {
    detail: async () => {
      if (deny) throw new UpstreamError(403);
      return { asset: { id: 1, state: 0, access: 0 }, fields: [] };
    },
    call: async (_who: unknown, fn: string) => {
      calls++;
      if (unavailable) throw new UpstreamError(502);
      return fn === "get_user_collections"
        ? [
            { ref: 1, name: "Visible" },
            { ref: 2, name: "[AIA Transfer] reserved" },
          ]
        : [
            { ref: 1, name: "do not trust member names" },
            { ref: 2, name: "reserved" },
            { ref: 99, name: "Another owner private collection" },
          ];
    },
  } as unknown as ResourceSpace;
  const f = await fixture(false, rs);
  try {
    const u = f.store.get<{ id: string }>(
      "SELECT id FROM users WHERE username='admin'",
    )!;
    f.store.run(
      "UPDATE users SET rs_credentials=? WHERE id=?",
      f.box.seal({ user: "fixture", key: "fixture" }),
      u.id,
    );
    assert.equal(
      (await f.send("GET", "/api/library/1", undefined, "")).statusCode,
      401,
    );
    assert.equal(calls, 0);
    deny = true;
    assert.equal((await f.send("GET", "/api/library/1")).statusCode, 403);
    assert.equal(calls, 0);
    deny = false;
    const visible = (await f.send("GET", "/api/library/1")).json();
    assert.deepEqual(visible.collections, [{ ref: 1, name: "Visible" }]);
    assert.equal(visible.collectionsAvailable, true);
    unavailable = true;
    const degraded = (await f.send("GET", "/api/library/1")).json();
    assert.equal(degraded.asset.id, 1);
    assert.deepEqual(degraded.collections, []);
    assert.equal(degraded.collectionsAvailable, false);
  } finally {
    await f.close();
  }
});

test("missing screen preview selects native standard preview and never falls back to an original", async () => {
  const server = createServer((_req, res) => res.end("standard preview"));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base =
    "http://127.0.0.1:" + (server.address() as { port: number }).port;
  const source = new ResourceSpace(base);
  let sizes = [
    { size_code: "original", extension: "raw" },
    { size_code: "pre", extension: "jpg" },
  ];
  const paths: Record<string, string>[] = [];
  source.call = async <T>(
    _who: unknown,
    fn: string,
    args?: Record<string, string>,
  ) => {
    if (fn === "get_resource_data")
      return { file_extension: "raw", preview_extension: "png" } as T;
    if (fn === "get_resource_all_image_sizes") return sizes as T;
    paths.push(args!);
    return (base + "/preview") as T;
  };
  try {
    const who = { user: "fixture", key: "fixture" };
    assert.equal(
      await (await source.preview(who, 2)).text(),
      "standard preview",
    );
    assert.deepEqual(paths[0], {
      ref: "2",
      size: "pre",
      generate: "0",
      extension: "jpg",
      write_metadata: "0",
    });
    sizes = [{ size_code: "original", extension: "raw" }];
    await assert.rejects(
      () => source.preview(who, 2),
      (error: unknown) =>
        error instanceof UpstreamError && error.status === 404,
    );
    assert.equal(paths.length, 1);
    sizes = [
      { size_code: "pre", extension: "jpg" },
      { size_code: "scr", extension: "jpg" },
    ];
    await (await source.preview(who, 2)).text();
    assert.equal(paths[1].size, "scr");
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("tag edits preserve unrelated metadata, canonical IDs, preflight denial and partial outcomes", async () => {
  const options = [
    { ref: 11, name: "Circuit" },
    { ref: 12, name: "Racing" },
    { ref: 13, name: "Paddock" },
  ];
  const values = new Map([
    [1, "Circuit, Racing"],
    [2, "Circuit"],
  ]);
  let denied = 0,
    failWrite = 0,
    nodeDenied = false;
  const writes: Record<string, string>[] = [];
  const rs = {
    detail: async (_who: unknown, id: number) => {
      if (id === denied) throw new UpstreamError(403);
      return { asset: { id }, fields: [] };
    },
    call: async (_who: unknown, fn: string, args: Record<string, string>) => {
      const id = Number(args.resource);
      if (fn === "get_resource_field_data")
        return [
          { ref: 1, name: "keywords", type: 9, value: values.get(id) || "" },
          { ref: 8, name: "title", type: 0, value: "Preserved title" },
        ];
      if (fn === "get_nodes") return options;
      if (fn === "get_edit_access") return id !== denied;
      if (fn === "set_node") {
        if (nodeDenied) throw new UpstreamError(403);
        const next = { ref: options.length + 11, name: args.name };
        options.push(next);
        return next.ref;
      }
      if (fn === "update_field") {
        if (id === failWrite) return "Native denial";
        writes.push(args);
        values.set(
          id,
          args.value
            .split(",")
            .filter(Boolean)
            .map((ref) => options.find((o) => o.ref === Number(ref))!.name)
            .join(", "),
        );
        return true;
      }
      throw new Error("Unexpected native call " + fn);
    },
  } as unknown as ResourceSpace;
  const f = await fixture(false, rs);
  try {
    f.store.run(
      "UPDATE users SET rs_credentials=? WHERE username='admin'",
      f.box.seal({ user: "fixture", key: "fixture" }),
    );
    denied = 2;
    assert.equal(
      (
        await f.send("POST", "/api/library/tags", {
          resourceIds: [1, 2],
          mode: "add",
          tags: ["Paddock"],
        })
      ).statusCode,
      403,
    );
    assert.equal(writes.length, 0);
    denied = 0;
    failWrite = 2;
    const partial = await f.send("POST", "/api/library/tags", {
      resourceIds: [1, 2],
      mode: "add",
      tags: ["PADDOCK", "paddock"],
    });
    assert.deepEqual(partial.json().updated, [1]);
    assert.equal(partial.json().failed[0].id, 2);
    assert.equal(values.get(1), "Circuit, Racing, Paddock");
    assert.equal(writes[0].field, "1");
    assert.equal(writes[0].nodevalues, "1");
    assert.equal(
      (
        await f.send("POST", "/api/library/tags", {
          resourceIds: [1],
          mode: "replace",
          tags: [],
          expected: ["stale"],
        })
      ).json().failed.length,
      1,
    );
    assert.equal(values.get(1), "Circuit, Racing, Paddock");
    await f.send("POST", "/api/library/tags", {
      resourceIds: [1],
      mode: "remove",
      tags: ["Racing"],
    });
    assert.equal(values.get(1), "Circuit, Paddock");
    nodeDenied = true;
    assert.equal(
      (
        await f.send("POST", "/api/library/tags", {
          resourceIds: [1],
          mode: "add",
          tags: ["Denied new node"],
        })
      ).json().failed.length,
      1,
    );
    assert.equal(values.get(1), "Circuit, Paddock");
    assert.equal(
      (
        await f.send("POST", "/api/library/tags", {
          resourceIds: [1],
          mode: "replace",
          tags: [],
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await f.send("POST", "/api/library/tags", {
          resourceIds: [1],
          mode: "add",
          tags: ["bad,tag"],
        })
      ).statusCode,
      400,
    );
    nodeDenied = false;
    await Promise.all(
      ["Alpha", "Beta"].map((tag) =>
        f.send("POST", "/api/library/tags", {
          resourceIds: [1],
          mode: "add",
          tags: [tag],
        }),
      ),
    );
    assert.ok(values.get(1)!.includes("Alpha"));
    assert.ok(values.get(1)!.includes("Beta"));
    f.store.run("UPDATE users SET role='marketer' WHERE username='admin'");
    assert.equal((await f.send("GET", "/api/library/1/tags")).statusCode, 403);
    assert.equal(
      (
        await f.send("POST", "/api/library/tags", {
          resourceIds: [1],
          mode: "add",
          tags: ["Paddock"],
        })
      ).statusCode,
      403,
    );
    assert.equal((await f.send("GET", "/api/storage")).statusCode, 403);
  } finally {
    await f.close();
  }
});

test("filesystem storage reports real statfs totals only to administrators and fails unavailable", async () => {
  const f = await fixture();
  try {
    assert.equal(
      (await f.send("GET", "/api/storage", undefined, "")).statusCode,
      401,
    );
    assert.equal((await f.send("GET", "/api/storage")).json().available, false);
    f.config.dataDir = process.cwd();
    const result = (await f.send("GET", "/api/storage")).json();
    assert.equal(result.available, true);
    assert.ok(result.totalBytes > 0);
    assert.equal(result.usedBytes + result.availableBytes, result.totalBytes);
    assert.equal(result.label, "Application data filesystem");
    assert.equal(JSON.stringify(result).includes(process.cwd()), false);
    f.config.dataDir = "/nonexistent-synthetic-storage-path";
    assert.equal((await f.send("GET", "/api/storage")).json().available, false);
  } finally {
    await f.close();
  }
});

test("legacy review states cannot be listed or assigned through the application", async () => {
  const f = await fixture();
  try {
    for (const state of [-1, 1]) {
      assert.equal(
        (await f.send("GET", "/api/library?state=" + state)).statusCode,
        400,
      );
      assert.equal(
        (await f.send("POST", "/api/library/1/state", { state })).statusCode,
        400,
      );
    }
  } finally {
    await f.close();
  }
});

test("failed automatic publication cleans up only the new upload", async () => {
  const calls: string[] = [];
  const source = new ResourceSpace("http://127.0.0.1:1");
  source.call = async <T>(
    _who: unknown,
    fn: string,
    args?: Record<string, string>,
  ) => {
    calls.push(fn);
    if (fn === "create_resource") return 42 as T;
    if (fn === "put_resource_data") return "Native publication denied" as T;
    if (fn === "delete_resource") assert.equal(args!.resource, "42");
    return true as T;
  };
  await assert.rejects(
    () =>
      source.upload(
        { user: "fixture", key: "fixture" },
        "fixture.png",
        new Blob(["synthetic"]),
        1,
      ),
    (error) => error instanceof UpstreamError && error.status === 403,
  );
  assert.equal(calls.at(-1), "delete_resource");
});

test("legacy review notes are omitted from app metadata without altering stored fields", async () => {
  const fields = [
    { ref: 8, name: "title", title: "Title", type: 0, value: "Keep title" },
    {
      ref: 92,
      name: "aiareviewnotes",
      title: "Review notes",
      type: 1,
      value: "Retained native notes",
    },
    { ref: 1, name: "keywords", title: "Keywords", type: 9, value: "Circuit" },
  ];
  const source = new ResourceSpace("http://127.0.0.1:1");
  source.call = async <T>(_who: unknown, fn: string) => {
    if (fn === "get_resource_access") return 0 as T;
    if (fn === "get_resource_data")
      return { ref: 1, file_extension: "jpg", archive: 0, access: 0 } as T;
    if (fn === "get_resource_field_data") return fields as T;
    throw new Error("No write expected");
  };
  const detail = await source.detail({ user: "fixture", key: "fixture" }, 1);
  assert.deepEqual(
    detail.fields.map((f) => f.name),
    ["title", "keywords"],
  );
  assert.equal(fields[1].value, "Retained native notes");
});

// These exercise the real API against an isolated in-memory registry.
test("password-first MFA never creates a session before verification and consumes the challenge", async () => {
  const f = await fixture();
  try {
    const user = f.store.get<any>(
      "SELECT * FROM users WHERE username='admin'",
    )!;
    const secret = new OTPAuth.Secret({ size: 20 });
    f.store.run(
      "UPDATE users SET totp_secret=? WHERE id=?",
      f.box.seal(secret.base32),
      user.id,
    );
    const wrong = await f.send(
      "POST",
      "/api/auth/login",
      { username: "admin", password: "incorrect" },
      "",
    );
    assert.equal(wrong.statusCode, 401);
    assert.equal(wrong.cookies.filter((c) => c.name === "aia_mfa").length, 0);
    const first = await f.send(
      "POST",
      "/api/auth/login",
      { username: "admin", password },
      "",
    );
    assert.equal(first.statusCode, 200);
    assert.equal(first.json().mfaRequired, true);
    assert.equal(first.cookies.filter((c) => c.name === "aia_staff").length, 0);
    const challenge = first.cookies
      .filter((c) => c.name === "aia_mfa" && c.value)
      .map((c) => c.name + "=" + c.value)
      .join("; ");
    assert.equal(
      (await f.send("GET", "/api/auth/me", undefined, challenge)).statusCode,
      401,
    );
    const valid = new OTPAuth.TOTP({ secret }).generate(),
      bad = valid === "000000" ? "111111" : "000000";
    assert.equal(
      (await f.send("POST", "/api/auth/verify", { code: bad }, challenge))
        .statusCode,
      401,
    );
    const result = await f.send(
      "POST",
      "/api/auth/verify",
      { code: valid },
      challenge,
    );
    assert.equal(result.statusCode, 200);
    assert.ok(result.cookies.some((c) => c.name === "aia_staff" && c.value));
    assert.equal(
      (await f.send("POST", "/api/auth/verify", { code: valid }, challenge))
        .statusCode,
      410,
    );
    const again = await f.send(
      "POST",
      "/api/auth/login",
      { username: "admin", password },
      "",
    );
    const raw = again.cookies
      .filter((c) => c.name === "aia_mfa" && c.value)
      .map((c) => c.name + "=" + c.value)
      .join("; ");
    f.store.run(
      "UPDATE users SET session_version=session_version+1 WHERE id=?",
      user.id,
    );
    assert.equal(
      (await f.send("POST", "/api/auth/verify", { code: valid }, raw))
        .statusCode,
      410,
    );
  } finally {
    await f.close();
  }
});
test("invitations require recipient password and verified MFA before access, with single-use links", async () => {
  const f = await fixture();
  try {
    const creation = await f.send("POST", "/api/admin/users", {
      username: "invited",
      name: "Jo?o Actual Name",
      role: "marketer",
      libraryAccess: false,
    });
    assert.equal(creation.statusCode, 200);
    const invitation = creation.json(),
      token = invitation.invitationUrl.split("#")[1],
      uid = invitation.user.id;
    assert.equal(invitation.user.invitationPending, true);
    assert.equal(creation.cookies.length, 0);
    assert.equal(
      (
        await f.send(
          "POST",
          "/api/auth/login",
          { username: "invited", password },
          "",
        )
      ).statusCode,
      401,
    );
    const read = await f.send(
      "POST",
      "/api/auth/invitation/read",
      { token },
      "",
    );
    assert.equal(read.statusCode, 200);
    assert.equal(read.json().name, "Jo?o Actual Name");
    assert.equal(
      (await f.send("GET", "/api/library", undefined, "")).statusCode,
      401,
    );
    assert.equal(
      (
        await f.send(
          "POST",
          "/api/auth/invitation/start",
          { token, password: "short" },
          "",
        )
      ).statusCode,
      400,
    );
    await uploadInvitationPhoto(f, token);
    const started = await f.send(
      "POST",
      "/api/auth/invitation/start",
      { token, password },
      "",
    );
    assert.equal(started.statusCode, 200);
    assert.ok(!started.cookies.some((c) => c.name === "aia_staff"));
    assert.ok(!started.json().user);
    const setup = started.cookies.map((c) => c.name + "=" + c.value).join("; ");
    assert.equal(
      (await f.send("GET", "/api/auth/me", undefined, setup)).statusCode,
      401,
    );
    assert.equal(
      (
        await f.send(
          "POST",
          "/api/auth/invitation/start",
          { token, password },
          "",
        )
      ).statusCode,
      410,
    );
    const valid = new OTPAuth.TOTP({
        secret: started.json().secret,
      }).generate(),
      bad = valid === "000000" ? "111111" : "000000";
    assert.equal(
      (
        await f.send(
          "POST",
          "/api/auth/invitation/complete",
          { code: bad },
          setup,
        )
      ).statusCode,
      401,
    );
    const completed = await f.send(
      "POST",
      "/api/auth/invitation/complete",
      { code: valid },
      setup,
    );
    assert.equal(completed.statusCode, 200);
    assert.equal(completed.json().user.mfaEnabled, true);
    assert.equal(completed.json().user.invitationPending, false);
    assert.equal(
      f.store.get("SELECT * FROM invitations WHERE user_id=?", uid),
      undefined,
    );
    assert.equal(
      (
        await f.send(
          "POST",
          "/api/auth/invitation/complete",
          { code: valid },
          setup,
        )
      ).statusCode,
      410,
    );
    assert.equal(
      (await f.send("POST", "/api/auth/invitation/read", { token }, ""))
        .statusCode,
      410,
    );
    assert.equal(
      (
        await f.send(
          "POST",
          "/api/auth/login",
          { username: "invited", password },
          "",
        )
      ).json().mfaRequired,
      true,
    );
  } finally {
    await f.close();
  }
});
test("invitation reissue, expiry, offboarding and setup attempt limits fail closed", async () => {
  const f = await fixture();
  try {
    const c = await f.send("POST", "/api/admin/users", {
      username: "pending",
      name: "Pending",
      role: "marketer",
      libraryAccess: false,
    });
    const id = c.json().user.id,
      old = c.json().invitationUrl.split("#")[1];
    const updated = await f.send(
      "POST",
      "/api/admin/users/" + id + "/invitation",
    );
    const token = updated.json().invitationUrl.split("#")[1];
    assert.equal(
      (await f.send("POST", "/api/auth/invitation/read", { token: old }, ""))
        .statusCode,
      410,
    );
    f.store.run("UPDATE invitations SET expires=0 WHERE user_id=?", id);
    assert.equal(
      (await f.send("POST", "/api/auth/invitation/read", { token }, ""))
        .statusCode,
      410,
    );
    const fresh = await f.send(
      "POST",
      "/api/admin/users/" + id + "/invitation",
    );
    await uploadInvitationPhoto(f, fresh.json().invitationUrl.split("#")[1]);
    const started = await f.send(
      "POST",
      "/api/auth/invitation/start",
      { token: fresh.json().invitationUrl.split("#")[1], password },
      "",
    );
    const cookie = started.cookies
      .map((c) => c.name + "=" + c.value)
      .join("; ");
    f.store.run("UPDATE invitations SET attempts=6 WHERE user_id=?", id);
    assert.equal(
      (
        await f.send(
          "POST",
          "/api/auth/invitation/complete",
          {
            code: new OTPAuth.TOTP({
              secret: started.json().secret,
            }).generate(),
          },
          cookie,
        )
      ).statusCode,
      410,
    );
    f.store.run(
      "UPDATE invitations SET attempts=0,setup_expires=0 WHERE user_id=?",
      id,
    );
    assert.equal(
      (
        await f.send(
          "POST",
          "/api/auth/invitation/complete",
          { code: "000000" },
          cookie,
        )
      ).statusCode,
      410,
    );
    await f.send("POST", "/api/admin/users/" + id, { disabled: true });
    assert.equal(
      (await f.send("POST", "/api/admin/users/" + id + "/invitation"))
        .statusCode,
      409,
    );
  } finally {
    await f.close();
  }
});

test("pending setup resumes with its private cookie, concurrent starts consume only once and origin checks remain enforced", async () => {
  const f = await fixture();
  try {
    const created = (
      await f.send("POST", "/api/admin/users", {
        username: "resume",
        name: "Resume User",
        role: "marketer",
        libraryAccess: false,
      })
    ).json();
    const token = created.invitationUrl.split("#")[1];
    const forbidden = await f.app.inject({
      method: "POST",
      url: "/api/auth/invitation/start",
      headers: { origin: "https://untrusted.example" },
      payload: { token, password },
    });
    assert.equal(forbidden.statusCode, 403);
    await uploadInvitationPhoto(f, token);
    const starts = await Promise.all([
      f.send("POST", "/api/auth/invitation/start", { token, password }, ""),
      f.send("POST", "/api/auth/invitation/start", { token, password }, ""),
    ]);
    assert.deepEqual(starts.map((r) => r.statusCode).sort(), [200, 410]);
    const started = starts.find((r) => r.statusCode === 200)!;
    const cookie = started.cookies
      .map((c) => c.name + "=" + c.value)
      .join("; ");
    const resumed = await f.send(
      "POST",
      "/api/auth/invitation/read",
      { token: "" },
      cookie,
    );
    assert.equal(resumed.statusCode, 200);
    assert.equal(resumed.json().setup.secret, started.json().secret);
    assert.equal(resumed.json().username, "resume");
    assert.equal(
      (await f.send("POST", "/api/auth/invitation/read", { token: "" }, ""))
        .statusCode,
      410,
    );
    assert.equal(
      (await f.send("GET", "/api/auth/me", undefined, cookie)).statusCode,
      401,
    );
    f.store.run(
      "UPDATE users SET disabled=1,session_version=session_version+1 WHERE id=?",
      created.user.id,
    );
    assert.equal(
      (await f.send("POST", "/api/auth/invitation/read", { token: "" }, cookie))
        .statusCode,
      410,
    );
  } finally {
    await f.close();
  }
});
test("the MFA verification endpoint retains its per-minute rate limit", async () => {
  const f = await fixture();
  try {
    const user = f.store.get<any>(
      "SELECT * FROM users WHERE username='admin'",
    )!;
    f.store.run(
      "UPDATE users SET totp_secret=? WHERE id=?",
      f.box.seal(new OTPAuth.Secret({ size: 20 }).base32),
      user.id,
    );
    const login = await f.send(
      "POST",
      "/api/auth/login",
      { username: "admin", password },
      "",
    );
    const cookie = login.cookies
      .filter((c) => c.name === "aia_mfa" && c.value)
      .map((c) => c.name + "=" + c.value)
      .join("; ");
    for (let i = 0; i < 6; i++)
      await f.send("POST", "/api/auth/verify", { code: "000000" }, cookie);
    assert.equal(
      (await f.send("POST", "/api/auth/verify", { code: "000000" }, cookie))
        .statusCode,
      429,
    );
  } finally {
    await f.close();
  }
});

async function imagePayload(bytes?: Buffer) {
  const data =
      bytes ||
      (await readFile(new URL("./fixtures/profile.png", import.meta.url))),
    boundary = "synthetic-upload-photo";
  return {
    payload: Buffer.concat([
      Buffer.from(
        "--" +
          boundary +
          '\r\nContent-Disposition: form-data; name="photo"; filename="chosen.png"\r\nContent-Type: image/png\r\n\r\n',
      ),
      data,
      Buffer.from("\r\n--" + boundary + "--\r\n"),
    ]),
    contentType: "multipart/form-data; boundary=" + boundary,
  };
}
test("background publication is administrator-only, image-only, bounded, removable and independent of private photos", async () => {
  const f = await fixture();
  try {
    const image = await imagePayload();
    const upload = (session: string, payload = image.payload) =>
      f.app.inject({
        method: "POST",
        url: "/api/admin/backgrounds",
        headers: { origin, cookie: session, "content-type": image.contentType },
        payload,
      });
    assert.deepEqual(
      (await f.send("GET", "/api/public/backgrounds", undefined, "")).json(),
      { photos: [] },
    );
    assert.equal((await upload("")).statusCode, 401);
    const admin = f.store.get<any>(
      "SELECT * FROM users WHERE username='admin'",
    )!;
    f.store.run("UPDATE users SET role='marketer' WHERE id=?", admin.id);
    assert.equal((await upload(f.cookie)).statusCode, 403);
    assert.equal(
      (await f.send("GET", "/api/admin/backgrounds")).statusCode,
      403,
    );
    f.store.run("UPDATE users SET role='admin' WHERE id=?", admin.id);
    const published = await upload(f.cookie);
    assert.equal(published.statusCode, 200);
    const photo = published.json().photos[0];
    const publicImage = await f.send(
      "GET",
      photo.url.replace("/api", "/api"),
      undefined,
      "",
    );
    assert.equal(publicImage.statusCode, 200);
    assert.match(publicImage.headers["content-type"]!, /^image\/webp/);
    assert.equal(publicImage.rawPayload.subarray(0, 4).toString(), "RIFF");
    assert.equal(
      (await f.send("GET", "/api/auth/profile-photo", undefined, ""))
        .statusCode,
      401,
    );
    const svg = await imagePayload(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20"/></svg>',
      ),
    );
    assert.equal((await upload(f.cookie, svg.payload)).statusCode, 400);
    const bad = await imagePayload(Buffer.from("not an image"));
    assert.equal((await upload(f.cookie, bad.payload)).statusCode, 400);
    const oversized = await imagePayload(Buffer.alloc(8 * 1024 ** 2 + 1));
    assert.equal((await upload(f.cookie, oversized.payload)).statusCode, 413);
    const binary = f.store.get<any>(
      "SELECT data FROM background_photos WHERE id=?",
      photo.id,
    )!.data;
    for (let i = 0; i < 11; i++)
      f.store.run(
        "INSERT INTO background_photos(id,title,data,created_at) VALUES(?,?,?,?)",
        token(),
        "Synthetic",
        binary,
        new Date().toISOString(),
      );
    assert.equal((await upload(f.cookie)).statusCode, 409);
    assert.equal(
      (
        await f.send(
          "POST",
          "/api/admin/backgrounds/" + photo.id + "/remove",
          {},
          "",
        )
      ).statusCode,
      401,
    );
    assert.equal(
      (await f.send("POST", "/api/admin/backgrounds/" + photo.id + "/remove"))
        .statusCode,
      200,
    );
    assert.equal(
      (await f.send("GET", photo.url, undefined, "")).statusCode,
      404,
    );
  } finally {
    await f.close();
  }
});
test("profile photo is required by the API and remains private after successful enrollment", async () => {
  const f = await fixture();
  try {
    const invited = (
      await f.send("POST", "/api/admin/users", {
        username: "photo-required",
        name: "Photo Required",
        role: "marketer",
        libraryAccess: false,
      })
    ).json();
    const raw = invited.invitationUrl.split("#")[1];
    const absent = await f.send(
      "POST",
      "/api/auth/invitation/start",
      { token: raw, password },
      "",
    );
    assert.equal(absent.statusCode, 400);
    assert.match(absent.json().error, /profile photo/);
    const bad = await imagePayload(Buffer.from("fake"));
    assert.equal(
      (
        await f.app.inject({
          method: "POST",
          url: "/api/auth/invitation/photo",
          headers: {
            origin,
            "x-aia-invitation": raw,
            "content-type": bad.contentType,
          },
          payload: bad.payload,
        })
      ).statusCode,
      400,
    );
    const oversized = await imagePayload(Buffer.alloc(5 * 1024 ** 2 + 1));
    assert.equal(
      (
        await f.app.inject({
          method: "POST",
          url: "/api/auth/invitation/photo",
          headers: {
            origin,
            "x-aia-invitation": raw,
            "content-type": oversized.contentType,
          },
          payload: oversized.payload,
        })
      ).statusCode,
      413,
    );
    await uploadInvitationPhoto(f, raw);
    assert.equal(
      (
        await f.send(
          "POST",
          "/api/auth/invitation/start",
          { token: raw, password: "abcdefgh" },
          "",
        )
      ).statusCode,
      400,
    );
    const started = await f.send(
      "POST",
      "/api/auth/invitation/start",
      { token: raw, password: "Abcd123!" },
      "",
    );
    assert.equal(started.statusCode, 200);
    const setup = started.cookies.map((c) => c.name + "=" + c.value).join("; ");
    const completed = await f.send(
      "POST",
      "/api/auth/invitation/complete",
      { code: new OTPAuth.TOTP({ secret: started.json().secret }).generate() },
      setup,
    );
    assert.equal(completed.statusCode, 200);
    const session = completed.cookies
      .filter((c) => c.name === "aia_staff" && c.value)
      .map((c) => c.name + "=" + c.value)
      .join("; ");
    const privatePhoto = await f.send(
      "GET",
      "/api/auth/profile-photo",
      undefined,
      session,
    );
    assert.equal(privatePhoto.statusCode, 200);
    assert.match(privatePhoto.headers["content-type"]!, /^image\/webp/);
    assert.equal(
      (await f.send("GET", "/api/auth/profile-photo", undefined, ""))
        .statusCode,
      401,
    );
    assert.equal(
      (await f.send("GET", "/api/auth/me", undefined, session)).json().user
        .hasProfilePhoto,
      true,
    );
    assert.equal(
      (
        await f.send(
          "GET",
          "/api/staff/" + invited.user.id + "/photo",
          undefined,
          session,
        )
      ).statusCode,
      200,
    );
    assert.equal(
      (await f.send("GET", "/api/staff/" + invited.user.id + "/photo"))
        .statusCode,
      200,
    );
    assert.equal(
      (
        await f.send(
          "GET",
          "/api/staff/" + invited.user.id + "/photo",
          undefined,
          "",
        )
      ).statusCode,
      401,
    );
    const administrator = f.store.get<any>(
      "SELECT id FROM users WHERE username='admin'",
    )!;
    assert.equal(
      (
        await f.send(
          "GET",
          "/api/staff/" + administrator.id + "/photo",
          undefined,
          session,
        )
      ).statusCode,
      403,
    );
    assert.deepEqual(
      (await f.send("GET", "/api/public/backgrounds", undefined, "")).json()
        .photos,
      [],
    );
    const late = await imagePayload();
    assert.equal(
      (
        await f.app.inject({
          method: "POST",
          url: "/api/auth/invitation/photo",
          headers: {
            origin,
            "x-aia-invitation": raw,
            "content-type": late.contentType,
          },
          payload: late.payload,
        })
      ).statusCode,
      410,
    );
  } finally {
    await f.close();
  }
});
