import test from "node:test";
import assert from "node:assert/strict";
import {
  remainingSeconds,
  expiryParts,
} from "../packages/ui/src/lib/expiry.js";
import { nameLines } from "../packages/ui/src/lib/badge-images.js";
import { MfaChallenges } from "../services/transfer-api/src/mfa-challenges.js";
import type { UserRow } from "../services/transfer-api/src/store.js";
import { passwordInput } from "../packages/contracts/src/index.js";
test("new passwords require eight characters, uppercase, number and symbol", () => {
  for (const value of ["Abcd123!", "UPPER12!", "Ábcd123!"])
    assert.equal(passwordInput.safeParse(value).success, true);
  for (const value of [
    "Abc12!",
    "abcd123!",
    "Abcdefg!",
    "Abcdef12",
    "abcdefgh",
  ])
    assert.equal(passwordInput.safeParse(value).success, false);
});
test("countdown uses timestamp differences across timezones, refresh, long durations and zero", () => {
  const now = Date.parse("2026-11-09T12:00:00Z");
  assert.equal(remainingSeconds("2026-11-09T13:00:00+01:00", now), 0);
  assert.deepEqual(
    expiryParts(remainingSeconds("2026-11-20T14:03:04Z", now)!),
    [11, 2, 3, 4],
  );
  assert.equal(remainingSeconds("2026-11-09T12:00:04Z", now + 1100), 3);
  assert.equal(remainingSeconds("2026-11-09T12:00:04Z", now + 5000), 0);
  assert.equal(remainingSeconds("bad", now), null);
  assert.deepEqual(expiryParts(-20), [0, 0, 0, 0]);
});
test("badge name layout retains Unicode and long unbroken names", () => {
  for (const name of ["Ana", "João Luís de Albuquerque", "Ł".repeat(80)]) {
    const lines = nameLines(name, (t) => Array.from(t).length * 10, 100);
    assert.equal(lines.join("").replaceAll(" ", ""), name.replaceAll(" ", ""));
    assert.ok(lines.every((line) => Array.from(line).length <= 10));
  }
});
test("MFA challenges expire, limit retries, consume once and bind account security state", () => {
  let now = 1000;
  const challenges = new MfaChallenges(() => now);
  const user = {
    id: "one",
    session_version: 0,
    password_hash: "password-hash",
    totp_secret: "encrypted-secret",
    disabled: 0,
    invitation_pending: 0,
  } as UserRow;
  const lookup = () => user;
  const raw = challenges.issue(user)!;
  assert.equal(challenges.attempt(raw, lookup), user);
  challenges.remove(raw);
  assert.equal(challenges.attempt(raw, lookup), null);
  const expired = challenges.issue(user)!;
  now += 300001;
  assert.equal(challenges.attempt(expired, lookup), null);
  const limited = challenges.issue(user)!;
  for (let i = 0; i < 6; i++)
    assert.equal(challenges.attempt(limited, lookup), user);
  assert.equal(challenges.attempt(limited, lookup), null);
  for (const field of [
    "session_version",
    "password_hash",
    "totp_secret",
    "disabled",
    "invitation_pending",
  ] as const) {
    const raw = challenges.issue(user)!;
    const copy = { ...user };
    (user as any)[field] = typeof user[field] === "number" ? 1 : "changed";
    assert.equal(challenges.attempt(raw, lookup), null);
    Object.assign(user, copy);
  }
});

test("public background and private profile images survive a registry reopen without altering existing accounts", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises"),
    { tmpdir } = await import("node:os"),
    path = await import("node:path"),
    { Store } = await import("../services/transfer-api/src/store.js");
  const directory = await mkdtemp(path.join(tmpdir(), "aia-image-registry-"));
  let store: InstanceType<typeof Store> | undefined;
  try {
    store = new Store(directory);
    store.run(
      "INSERT INTO users(id,username,name,role,password_hash) VALUES(?,?,?,?,?)",
      "fixture-user",
      "fixture",
      "Fixture",
      "marketer",
      "unchanged-hash",
    );
    const image = Buffer.from("synthetic-test-image");
    store.run(
      "INSERT INTO profile_photos(user_id,data) VALUES(?,?)",
      "fixture-user",
      image,
    );
    store.run(
      "INSERT INTO background_photos(id,title,data,created_at) VALUES(?,?,?,?)",
      "fixture-background",
      "Fixture",
      image,
      new Date().toISOString(),
    );
    store.close();
    store = new Store(directory);
    assert.equal(store.user("fixture-user")!.password_hash, "unchanged-hash");
    assert.deepEqual(
      Buffer.from(
        store.get<{ data: Uint8Array }>(
          "SELECT data FROM profile_photos WHERE user_id=?",
          "fixture-user",
        )!.data,
      ),
      image,
    );
    assert.deepEqual(
      Buffer.from(
        store.get<{ data: Uint8Array }>(
          "SELECT data FROM background_photos WHERE id=?",
          "fixture-background",
        )!.data,
      ),
      image,
    );
    assert.equal(
      store.get<{ version: number }>("SELECT version FROM schema_version")!
        .version,
      6,
    );
  } finally {
    store?.close();
    assert.equal(path.resolve(path.dirname(directory)), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith("aia-image-registry-"));
    await rm(directory, { recursive: true, force: true });
  }
});
