import { originalZip } from "./zip.js";
import { registerBackgrounds, normalizePhoto } from "./backgrounds.js";
import { MfaChallenges } from "./mfa-challenges.js";
import { readTags, writeTags, serializeTagWrite } from "./tags.js";
import Fastify, { type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";
import { Readable, Transform } from "node:stream";
import { randomUUID } from "node:crypto";
import { statfs, mkdir, mkdtemp, unlink, rmdir } from "node:fs/promises";
import { createWriteStream, openAsBlob } from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { fileTypeFromFile } from "file-type";
import * as OTPAuth from "otpauth";
import { z } from "zod";
import {
  MAX_CHUNK,
  transferInput,
  userInput,
  passwordInput,
  type Staff,
  type Transfer,
} from "@aia/contracts";
import {
  Store,
  type UserRow,
  type TransferRow,
  type FileRow,
} from "./store.js";
import {
  token,
  digest,
  hashPassword,
  checkPassword,
  SecretBox,
  disposition,
  safeFilename,
} from "./security.js";
import {
  ResourceSpace,
  Gokapi,
  UpstreamError,
  nativeDownload,
  type RsIdentity,
} from "./adapters.js";
declare module "fastify" {
  interface FastifyRequest {
    staff: UserRow | null;
  }
}
export type Config = {
  dataDir: string;
  masterKey: string;
  mediaOrigin: string;
  transferOrigin: string;
  secureCookies: boolean;
  rsUrl: string;
  gokapiUrl: string;
  gokapiKey: string;
  bootstrapPassword?: string;
  rsIdentity?: RsIdentity;
  rsProvisionIdentity?: RsIdentity;
  logger?: boolean;
  requireAdminMfa?: boolean;
};
class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}
const idParam = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });
const nId = z.coerce.number().int().positive();
export async function createApp(
  config: Config,
  dependencies?: { store?: Store; rs?: ResourceSpace; gokapi?: Gokapi },
) {
  const store = dependencies?.store || new Store(config.dataDir);
  const staffView = (u: UserRow): Staff => ({
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role as Staff["role"],
    mfaEnabled: !!u.totp_secret,
    hasProfilePhoto: !!store.get(
      "SELECT user_id FROM profile_photos WHERE user_id=?",
      u.id,
    ),
    invitationPending: !!u.invitation_pending,
    libraryAccess: !!u.rs_credentials,
  });
  const box = new SecretBox(config.masterKey);
  try {
    const marker = store.get<{ value: string }>(
      "SELECT value FROM auth_metadata WHERE name='key-check'",
    );
    if (!marker) {
      // Validate legacy ciphertext before binding an existing registry to a key.
      for (const column of ["rs_credentials", "totp_secret"]) {
        const sample = store.get<{ value: string }>(
          `SELECT ${column} AS value FROM users WHERE ${column} IS NOT NULL LIMIT 1`,
        );
        if (sample) box.open(sample.value);
      }
      for (const column of ["source_secret", "native_share"]) {
        const sample = store.get<{ value: string }>(
          `SELECT ${column} AS value FROM transfers WHERE ${column} IS NOT NULL AND ${column}!='' LIMIT 1`,
        );
        if (sample) box.open(sample.value);
      }
      store.run(
        "INSERT OR IGNORE INTO auth_metadata(name,value) VALUES('key-check',?)",
        box.seal("aia-registry-key"),
      );
    }
    if (
      box.open(
        store.get<{ value: string }>(
          "SELECT value FROM auth_metadata WHERE name='key-check'",
        )!.value,
      ) !== "aia-registry-key"
    )
      throw new Error("Key mismatch");
  } catch {
    store.close();
    throw new Error(
      "The registry encryption key does not match. Restore the original key; existing accounts were not reset.",
    );
  }
  const rs = dependencies?.rs || new ResourceSpace(config.rsUrl);
  const gokapi =
    dependencies?.gokapi || new Gokapi(config.gokapiUrl, config.gokapiKey);
  const app = Fastify({
    logger: config.logger
      ? {
          level: "info",
          redact: [
            "req.headers.cookie",
            "req.headers.authorization",
            "req.body",
            "res.headers.set-cookie",
          ],
          serializers: {
            req: (r) => ({
              method: r.method,
              url: String(r.url)
                .split("?")[0]
                .replace(/[A-Za-z0-9_-]{43}/g, "[id]"),
              hostname: r.hostname,
            }),
          },
        }
      : false,
    bodyLimit: 128 * 1024,
    requestTimeout: 0,
  });
  await app.register(cookie);
  await app.register(multipart, {
    limits: { files: 1, fileSize: 20 * 1024 ** 3, fields: 12 },
  });
  await app.register(rateLimit, {
    global: true,
    max: 240,
    timeWindow: "1 minute",
  });
  await app.register(helmet, { contentSecurityPolicy: false });
  app.addContentTypeParser(
    "application/octet-stream",
    { parseAs: "buffer", bodyLimit: MAX_CHUNK },
    (_req, body, done) => done(null, body),
  );
  app.decorateRequest("staff", null);
  const origins = new Set([config.mediaOrigin, config.transferOrigin]);
  const uploads = new Set<string>();
  const userUploads = new Map<string, number>();
  const streams = new Map<string, Set<Readable>>();
  const challenges = new MfaChallenges();
  const enrollments = new Map<string, { secret: string; expires: number }>();
  const cookieOptions = {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: "strict" as const,
    path: "/",
  };
  const who = (request: FastifyRequest) =>
    request.staff || fail(401, "Sign in to continue");
  const mediaEditor = (request: FastifyRequest) => {
    const u = who(request);
    if (!["admin", "reviewer"].includes(u.role))
      fail(403, "Media edit access required");
    return u;
  };
  const admin = (request: FastifyRequest) => {
    const u = who(request);
    if (u.role !== "admin") fail(403, "Administrator access required");
    return u;
  };
  const identity = (u: UserRow) =>
    u.rs_credentials
      ? box.open<RsIdentity>(u.rs_credentials)
      : fail(403, "Library access has not been assigned to this account");
  const owns = (request: FastifyRequest, id: string) => {
    const u = who(request),
      t = store.transfer(id);
    if (!t || (t.owner !== u.id && u.role !== "admin"))
      fail(404, "Transfer not found");
    return t!;
  };
  const view = (t: TransferRow, files = false): Transfer => {
    const recordFiles = store.files(t.id);
    return {
      id: t.id,
      title: t.title,
      note: t.note,
      source: t.source as Transfer["source"],
      state:
        t.state === "active" && Date.parse(t.expires_at) <= Date.now()
          ? "expired"
          : (t.state as Transfer["state"]),
      createdAt: t.created_at,
      expiresAt: t.expires_at,
      passwordProtected: !!t.password_hash,
      downloadLimit: t.download_limit,
      downloads: t.downloads,
      fileCount: recordFiles.length,
      totalBytes:
        recordFiles.length && recordFiles.every((f) => f.size > 0)
          ? recordFiles.reduce((sum, f) => sum + f.size, 0)
          : null,
      ownerName: store.user(t.owner)?.name || "Former staff",
      ...(files
        ? {
            files: recordFiles.map((f) => ({
              id: f.id,
              name: f.name,
              size: f.size,
              uploadedBytes: f.uploaded,
              complete: !!f.complete,
            })),
            link: config.transferOrigin + "/t/" + t.id,
          }
        : {}),
    };
  };
  app.addHook("onRequest", async (request, reply) => {
    reply
      .header("Cache-Control", "no-store")
      .header("Referrer-Policy", "no-referrer");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      !origins.has(String(request.headers.origin || ""))
    )
      fail(403, "Request origin is not permitted");
    const raw = request.cookies.aia_staff;
    if (raw) {
      const session = store.get<{ user_id: string; version: number }>(
        "SELECT user_id,version FROM sessions WHERE hash=? AND expires>?",
        digest(raw),
        Date.now(),
      );
      if (session) {
        const u = store.user(session.user_id);
        if (
          u &&
          !u.disabled &&
          !u.invitation_pending &&
          u.session_version === session.version
        )
          request.staff = u;
      }
    }
    const route = request.url.split("?")[0];
    if (
      route.startsWith("/api/") &&
      route !== "/api/health" &&
      route !== "/api/auth/login" &&
      route !== "/api/auth/verify" &&
      ![
        "/api/auth/invitation/read",
        "/api/auth/invitation/start",
        "/api/auth/invitation/photo",
        "/api/auth/invitation/complete",
      ].includes(route) &&
      route !== "/api/auth/logout" &&
      !route.startsWith("/api/public/") &&
      !request.staff
    )
      fail(401, "Sign in to continue");
    if (
      config.requireAdminMfa !== false &&
      request.staff?.role === "admin" &&
      !request.staff.totp_secret &&
      !/^\/api\/auth\/(me|mfa|logout)/.test(request.url)
    )
      fail(428, "Set up your authenticator to finish administrator sign-in");
  });
  app.setErrorHandler((error, request, reply) => {
    const e = error as Error & { statusCode?: number };
    const code =
      error instanceof z.ZodError
        ? 400
        : error instanceof UpstreamError
          ? error.status === 403 || error.status === 401
            ? 403
            : error.status === 404
              ? 404
              : error.status === 410
                ? 410
                : 502
          : Number(e.statusCode) || 500;
    const message =
      error instanceof z.ZodError
        ? "Check the form fields and try again"
        : code >= 500
          ? "The service is temporarily unavailable. Please retry."
          : error instanceof UpstreamError
            ? "The source denied or no longer provides this item"
            : e.message;
    request.log.warn({ status: code, requestId: request.id }, "Request failed");
    reply.code(code).send({ error: message, requestId: request.id });
  });
  if (!store.get("SELECT id FROM users LIMIT 1")) {
    if (!config.bootstrapPassword || config.bootstrapPassword.length < 14)
      throw new Error(
        "A strong bootstrap password is required for the first administrator",
      );
    const ownerIdentity = config.rsProvisionIdentity
      ? await rs.call<RsIdentity>(
          config.rsProvisionIdentity,
          "aia_staff_create",
          {
            username: "aia_owner_admin",
            role: "reviewer",
            fullname: "AIA owner administrator",
          },
        )
      : config.rsIdentity;
    store.run(
      "INSERT INTO users(id,username,name,role,password_hash,rs_credentials,source_managed) VALUES(?,?,?,?,?,?,?)",
      token(),
      "admin",
      "AIA Administrator",
      "admin",
      await hashPassword(config.bootstrapPassword),
      ownerIdentity ? box.seal(ownerIdentity) : null,
      config.rsProvisionIdentity ? 1 : 0,
    );
    store.audit("system", "administrator.bootstrap", "admin");
  }
  const dummyHash = await hashPassword(token());
  app.get("/api/health", async () => ({
    status: "ok",
    version: "0.1.0",
    storage: !!store.get("SELECT version FROM schema_version"),
  }));
  const finishLogin = (u: UserRow, reply: import("fastify").FastifyReply) => {
    const session = token();
    store.run(
      "INSERT INTO sessions(hash,user_id,expires,version) VALUES(?,?,?,?)",
      digest(session),
      u.id,
      Date.now() + 8 * 3600_000,
      u.session_version,
    );
    reply.setCookie("aia_staff", session, {
      ...cookieOptions,
      maxAge: 8 * 3600,
    });
    store.audit(u.id, "session.login", u.id);
    return {
      user: staffView(u),
      needsMfaEnrollment:
        config.requireAdminMfa !== false &&
        u.role === "admin" &&
        !u.totp_secret,
    };
  };
  const validTotp = (u: UserRow, code: string) => {
    const totp = new OTPAuth.TOTP({
      issuer: "AIA",
      label: u.username,
      secret: box.open<string>(u.totp_secret!),
      algorithm: "SHA1",
      digits: 6,
      period: 30,
    });
    const timestamp = Date.now(),
      delta = totp.validate({ token: code, window: 1, timestamp });
    if (delta === null) return false;
    const step = totp.counter({ timestamp }) + delta;
    return (
      store.run(
        "INSERT INTO totp_steps(user_id,step) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET step=excluded.step WHERE excluded.step>totp_steps.step",
        u.id,
        step,
      ).changes === 1
    );
  };
  app.post(
    "/api/auth/login",
    { config: { rateLimit: { max: 6, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const input = z
        .object({
          username: z.string().max(100),
          password: z.string().max(128),
          code: z.string().max(10).optional(),
        })
        .parse(request.body);
      const u = store.get<UserRow>(
        "SELECT * FROM users WHERE username=? COLLATE NOCASE",
        input.username,
      );
      const valid = await checkPassword(
        input.password,
        u?.password_hash || dummyHash,
      );
      if (!u || u.disabled || u.invitation_pending || !valid)
        fail(401, "Sign-in details are incorrect");
      challenges.remove(request.cookies.aia_mfa);
      reply.clearCookie("aia_mfa", cookieOptions);
      if (u.totp_secret) {
        if (!input.code) {
          const challenge =
            challenges.issue(u) || fail(503, "Please retry sign-in shortly");
          reply.setCookie("aia_mfa", challenge, {
            ...cookieOptions,
            maxAge: 300,
          });
          return {
            mfaRequired: true,
            digits: 6,
            expiresAt: new Date(Date.now() + 300_000).toISOString(),
          };
        }
        if (!validTotp(u, input.code))
          fail(
            401,
            "Enter a new authenticator code. If you just used one, wait for it to change.",
          );
      }
      return finishLogin(u, reply);
    },
  );
  app.post(
    "/api/auth/verify",
    { config: { rateLimit: { max: 6, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { code } = z
        .object({ code: z.string().regex(/^\d{6}$/) })
        .parse(request.body);
      const raw = request.cookies.aia_mfa;
      const u = challenges.attempt(raw, (id) => store.user(id));
      if (!u) {
        reply.clearCookie("aia_mfa", cookieOptions);
        fail(410, "This sign-in challenge has expired. Return to sign in.");
      }
      if (!validTotp(u, code))
        fail(
          401,
          "That code is incorrect or already used. Wait for a new authenticator code and try again.",
        );
      challenges.remove(raw);
      reply.clearCookie("aia_mfa", cookieOptions);
      return finishLogin(u, reply);
    },
  );
  registerBackgrounds(app, store, admin, fail);
  app.get("/api/staff/:id/photo", async (request, reply) => {
    const user = who(request),
      { id } = idParam.parse(request.params);
    if (user.id !== id && user.role !== "admin")
      fail(403, "This profile photo is private");
    const photo =
      store.get<{ data: Uint8Array }>(
        "SELECT data FROM profile_photos WHERE user_id=?",
        id,
      ) || fail(404, "Profile photo not found");
    return reply.type("image/webp").send(Buffer.from(photo.data));
  });
  app.get("/api/auth/profile-photo", async (request, reply) => {
    const u = who(request),
      photo =
        store.get<{ data: Uint8Array }>(
          "SELECT data FROM profile_photos WHERE user_id=?",
          u.id,
        ) || fail(404, "Profile photo not found");
    return reply.type("image/webp").send(Buffer.from(photo.data));
  });
  app.get("/api/auth/me", async (request) => ({
    user: staffView(who(request)),
    mediaUrl: config.mediaOrigin,
    transferUrl: config.transferOrigin,
    needsMfaEnrollment:
      config.requireAdminMfa !== false &&
      request.staff?.role === "admin" &&
      !request.staff?.totp_secret,
  }));
  app.post("/api/auth/logout", async (request, reply) => {
    if (request.cookies.aia_staff)
      store.run(
        "DELETE FROM sessions WHERE hash=?",
        digest(request.cookies.aia_staff),
      );
    challenges.remove(request.cookies.aia_mfa);
    reply.clearCookie("aia_mfa", cookieOptions);
    reply.clearCookie("aia_staff", cookieOptions);
    return { ok: true };
  });
  app.post("/api/auth/mfa/setup", async (request) => {
    const u = who(request);
    if (u.totp_secret) fail(409, "Authenticator is already enabled");
    const secret = new OTPAuth.Secret({ size: 20 });
    enrollments.set(u.id, {
      secret: secret.base32,
      expires: Date.now() + 10 * 60_000,
    });
    return {
      uri: new OTPAuth.TOTP({
        issuer: "AIA",
        label: u.username,
        secret,
      }).toString(),
      secret: secret.base32,
    };
  });
  app.post("/api/auth/mfa/confirm", async (request, reply) => {
    const u = who(request),
      pending = enrollments.get(u.id);
    const { code } = z
      .object({ code: z.string().regex(/^\d{6}$/) })
      .parse(request.body);
    if (
      !pending ||
      pending.expires < Date.now() ||
      new OTPAuth.TOTP({ secret: pending.secret }).validate({
        token: code,
        window: 1,
      }) === null
    )
      fail(400, "Authenticator code is invalid or setup expired");
    store.run(
      "UPDATE users SET totp_secret=?,session_version=session_version+1 WHERE id=?",
      box.seal(pending.secret),
      u.id,
    );
    store.run("DELETE FROM sessions WHERE user_id=?", u.id);
    const rotated = token();
    store.run(
      "INSERT INTO sessions(hash,user_id,expires,version) VALUES(?,?,?,?)",
      digest(rotated),
      u.id,
      Date.now() + 8 * 3600_000,
      u.session_version + 1,
    );
    reply.setCookie("aia_staff", rotated, {
      ...cookieOptions,
      maxAge: 8 * 3600,
    });
    enrollments.delete(u.id);
    store.audit(u.id, "mfa.enabled", u.id);
    return { ok: true };
  });
  app.post("/api/auth/password", async (request) => {
    const u = who(request);
    const input = z
      .object({
        current: z.string().max(128),
        password: passwordInput,
      })
      .parse(request.body);
    if (!(await checkPassword(input.current, u.password_hash)))
      fail(403, "Current password is incorrect");
    store.run(
      "UPDATE users SET password_hash=?,session_version=session_version+1 WHERE id=?",
      await hashPassword(input.password),
      u.id,
    );
    store.audit(u.id, "password.changed", u.id);
    return { ok: true };
  });

  type InvitationRow = {
    user_id: string;
    hash: string | null;
    expires: number;
    version: number;
    setup_hash: string | null;
    setup_expires: number | null;
    password_hash: string | null;
    totp_secret: string | null;
    attempts: number;
  };
  const issueInvitation = (u: UserRow) => {
    const raw = token(),
      expires = Date.now() + 48 * 3600_000;
    store.run(
      "INSERT INTO invitations(user_id,hash,expires,version) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET hash=excluded.hash,expires=excluded.expires,version=excluded.version,setup_hash=NULL,setup_expires=NULL,password_hash=NULL,totp_secret=NULL,attempts=0",
      u.id,
      digest(raw),
      expires,
      u.session_version,
    );
    // Fragment keeps the bearer token out of HTTP URLs, logs and referrers.
    return {
      invitationUrl: config.mediaOrigin + "/join#" + raw,
      expiresAt: new Date(expires).toISOString(),
    };
  };
  const invitationUser = (row: InvitationRow | undefined, setup = false) => {
    const u = row && store.user(row.user_id);
    if (
      !row ||
      !u ||
      u.disabled ||
      !u.invitation_pending ||
      row.version !== u.session_version ||
      (setup
        ? !row.setup_expires ||
          row.setup_expires <= Date.now() ||
          row.attempts >= 6
        : row.expires <= Date.now())
    )
      fail(
        410,
        "This invitation is inactive or setup has expired. Ask your administrator for a new link.",
      );
    return u;
  };
  app.post(
    "/api/auth/invitation/photo",
    { config: { rateLimit: { max: 6, timeWindow: "1 minute" } } },
    async (request) => {
      const raw = z
        .string()
        .regex(/^[A-Za-z0-9_-]{43}$/)
        .parse(request.headers["x-aia-invitation"]);
      const row = store.get<InvitationRow>(
        "SELECT * FROM invitations WHERE hash=?",
        digest(raw),
      );
      const u = invitationUser(row);
      const file = await request.file({
        limits: { files: 1, fileSize: 5 * 1024 ** 2, fields: 0 },
      });
      if (!file) fail(400, "A profile photo is required");
      const data = await normalizePhoto(await file.toBuffer(), true, fail);
      invitationUser(
        store.get<InvitationRow>(
          "SELECT * FROM invitations WHERE hash=?",
          digest(raw),
        ),
      );
      store.run(
        "INSERT INTO profile_photos(user_id,data) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data",
        u.id,
        data,
      );
      return { ok: true };
    },
  );
  const invitationToken = z.object({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  });
  app.post(
    "/api/auth/invitation/read",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const input = z
        .object({
          token: z
            .string()
            .regex(/^[A-Za-z0-9_-]{43}$/)
            .or(z.literal("")),
        })
        .parse(request.body);
      if (!input.token) {
        const row = store.get<InvitationRow>(
          "SELECT * FROM invitations WHERE setup_hash=?",
          digest(request.cookies.aia_setup || ""),
        );
        const u = invitationUser(row, true);
        const secret = box.open<string>(row!.totp_secret!);
        return {
          name: u.name,
          username: u.username,
          setup: {
            secret,
            uri: new OTPAuth.TOTP({
              issuer: "AIA",
              label: u.username,
              secret,
              algorithm: "SHA1",
              digits: 6,
              period: 30,
            }).toString(),
            expiresAt: new Date(row!.setup_expires!).toISOString(),
          },
        };
      }
      const row = store.get<InvitationRow>(
        "SELECT * FROM invitations WHERE hash=?",
        digest(input.token),
      );
      const u = invitationUser(row);
      return {
        name: u.name,
        username: u.username,
        expiresAt: new Date(row!.expires).toISOString(),
      };
    },
  );
  app.post(
    "/api/auth/invitation/start",
    { config: { rateLimit: { max: 6, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const input = invitationToken
        .extend({ password: passwordInput })
        .parse(request.body);
      const row = store.get<InvitationRow>(
        "SELECT * FROM invitations WHERE hash=?",
        digest(input.token),
      );
      const u = invitationUser(row);
      if (
        !store.get("SELECT user_id FROM profile_photos WHERE user_id=?", u.id)
      )
        fail(400, "A profile photo is required");
      const passwordHash = await hashPassword(input.password);
      // Password hashing yields. Recheck offboarding/expiry before consuming the link.
      invitationUser(
        store.get<InvitationRow>(
          "SELECT * FROM invitations WHERE hash=?",
          digest(input.token),
        ),
      );
      const secret = new OTPAuth.Secret({ size: 20 }),
        setup = token();
      const result = store.run(
        "UPDATE invitations SET hash=NULL,setup_hash=?,setup_expires=?,password_hash=?,totp_secret=?,attempts=0 WHERE user_id=? AND hash=?",
        digest(setup),
        Date.now() + 15 * 60_000,
        passwordHash,
        box.seal(secret.base32),
        u.id,
        digest(input.token),
      );
      if (result.changes !== 1)
        fail(
          410,
          "This invitation has already been opened for setup. Ask your administrator for a new link.",
        );
      reply.setCookie("aia_setup", setup, { ...cookieOptions, maxAge: 900 });
      return {
        secret: secret.base32,
        uri: new OTPAuth.TOTP({
          issuer: "AIA",
          label: u.username,
          secret,
          algorithm: "SHA1",
          digits: 6,
          period: 30,
        }).toString(),
        expiresAt: new Date(Date.now() + 900_000).toISOString(),
      };
    },
  );
  app.post(
    "/api/auth/invitation/complete",
    { config: { rateLimit: { max: 6, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { code } = z
        .object({ code: z.string().regex(/^\d{6}$/) })
        .parse(request.body);
      const row = store.get<InvitationRow>(
        "SELECT * FROM invitations WHERE setup_hash=?",
        digest(request.cookies.aia_setup || ""),
      );
      const u = invitationUser(row, true);
      if (
        !store.get("SELECT user_id FROM profile_photos WHERE user_id=?", u.id)
      )
        fail(400, "A profile photo is required");
      store.run(
        "UPDATE invitations SET attempts=attempts+1 WHERE user_id=?",
        u.id,
      );
      if (
        !row!.password_hash ||
        !row!.totp_secret ||
        !validTotp({ ...u, totp_secret: row!.totp_secret }, code)
      )
        fail(
          401,
          "That code is incorrect or already used. Wait for a new authenticator code and try again.",
        );
      store.db.exec("BEGIN IMMEDIATE");
      try {
        store.run(
          "UPDATE users SET password_hash=?,totp_secret=?,invitation_pending=0,session_version=session_version+1 WHERE id=?",
          row!.password_hash,
          row!.totp_secret,
          u.id,
        );
        store.run("DELETE FROM invitations WHERE user_id=?", u.id);
        store.db.exec("COMMIT");
      } catch (e) {
        store.db.exec("ROLLBACK");
        throw e;
      }
      reply.clearCookie("aia_setup", cookieOptions);
      store.audit(u.id, "user.invitation.accepted", u.id);
      return finishLogin(store.user(u.id)!, reply);
    },
  );
  app.post("/api/admin/users/:id/invitation", async (request) => {
    const actor = admin(request),
      { id } = idParam.parse(request.params);
    const u = store.user(id) || fail(404, "Staff account not found");
    if (!u.invitation_pending || u.disabled)
      fail(409, "Only pending, enabled accounts can be invited again");
    store.audit(actor.id, "user.reinvited", id);
    return issueInvitation(u);
  });
  app.get("/api/admin/users", async (request) => {
    admin(request);
    return {
      users: store
        .all<UserRow>("SELECT * FROM users ORDER BY name")
        .map((u) => ({ ...staffView(u), disabled: !!u.disabled })),
    };
  });
  app.post("/api/admin/users", async (request) => {
    const actor = admin(request),
      input = userInput.omit({ password: true }).parse(request.body);
    if (
      store.get(
        "SELECT id FROM users WHERE username=? COLLATE NOCASE",
        input.username,
      )
    )
      fail(409, "Username already exists");
    if (!!input.rsUser !== !!input.rsKey)
      fail(400, "Provide both ResourceSpace mapping fields");
    if (input.rsUser && input.rsKey)
      await rs.call(
        { user: input.rsUser, key: input.rsKey },
        "get_system_status",
      );
    let mapping: RsIdentity | null = null;
    if (input.rsUser && input.rsKey)
      mapping = { user: input.rsUser, key: input.rsKey };
    else if (input.libraryAccess) {
      const provisioned = await rs.call<RsIdentity>(
        config.rsProvisionIdentity || identity(actor),
        "aia_staff_create",
        {
          username: "aia_" + input.username,
          role: input.role === "marketer" ? "marketer" : "reviewer",
          fullname: input.name,
        },
      );
      mapping = { user: provisioned.user, key: provisioned.key };
    }
    const id = token();
    try {
      store.run(
        "INSERT INTO users(id,username,name,role,password_hash,rs_credentials,source_managed) VALUES(?,?,?,?,?,?,?)",
        id,
        input.username,
        input.name,
        input.role,
        await hashPassword(token()),
        mapping ? box.seal(mapping) : null,
        input.libraryAccess && !input.rsUser ? 1 : 0,
      );
    } catch {
      fail(409, "Username already exists");
    }
    store.run("UPDATE users SET invitation_pending=1 WHERE id=?", id);
    store.audit(actor.id, "user.invited", id, input.role);
    return {
      user: staffView(store.user(id)!),
      ...issueInvitation(store.user(id)!),
    };
  });
  app.post("/api/admin/users/:id", async (request) => {
    const actor = admin(request),
      { id } = idParam.parse(request.params);
    const input = z
      .object({
        disabled: z.boolean().optional(),
        rsUser: z.string().max(100).optional(),
        rsKey: z
          .string()
          .regex(/^[a-f0-9]{64}$/i)
          .optional(),
        password: passwordInput.optional(),
      })
      .parse(request.body);
    const target = store.user(id) || fail(404, "Staff account not found");
    if (id === actor.id && input.disabled)
      fail(400, "You cannot disable your own account");
    if (input.rsUser && input.rsKey) {
      if (target.source_managed)
        fail(400, "Managed source identities cannot be replaced");
      await rs.call(
        { user: input.rsUser, key: input.rsKey },
        "get_system_status",
      );
      store.run(
        "UPDATE users SET rs_credentials=? WHERE id=?",
        box.seal({ user: input.rsUser, key: input.rsKey }),
        id,
      );
    }
    if (input.password)
      store.run(
        "UPDATE users SET password_hash=?,session_version=session_version+1 WHERE id=?",
        await hashPassword(input.password),
        id,
      );
    if (input.disabled !== undefined) {
      if (!input.disabled && target.source_managed && target.source_disabled) {
        await rs.call(
          config.rsProvisionIdentity || identity(actor),
          "aia_staff_set_enabled",
          {
            username: identity(target).user,
            enabled: "1",
          },
        );
        store.run("UPDATE users SET source_disabled=0 WHERE id=?", id);
      }
      store.run(
        "UPDATE users SET disabled=?,session_version=session_version+1 WHERE id=?",
        input.disabled ? 1 : 0,
        id,
      );
      if (input.disabled) {
        for (const t of store.all<TransferRow>(
          "SELECT * FROM transfers WHERE owner=?",
          id,
        ))
          stopStreams(t.id);
        store.run("DELETE FROM sessions WHERE user_id=?", id);
        store.run(
          "UPDATE transfers SET state='revoking' WHERE owner=? AND state IN ('active','draft')",
          id,
        );
      }
    }
    store.audit(actor.id, "user.updated", target.id);
    return { ok: true };
  });
  app.get("/api/admin/audit", async (request) => {
    admin(request);
    return {
      events: store.all(
        "SELECT at,actor,action,subject,detail FROM audit ORDER BY id DESC LIMIT 200",
      ),
    };
  });
  app.get("/api/library", async (request) => {
    const u = who(request);
    const q = z
      .object({
        search: z.string().max(200).default(""),
        kind: z.enum(["all", "photo", "video"]).default("all"),
        page: z.coerce.number().int().min(0).max(10000).default(0),
        state: z.coerce
          .number()
          .int()
          .refine((n) => [0, 2].includes(n))
          .default(0),
      })
      .parse(request.query);
    if (q.state !== 0 && u.role === "marketer")
      fail(403, "Media edit access required");
    return rs.search(identity(u), q.search, q.page, q.state, q.kind);
  });
  app.get("/api/library/:id", async (request) => {
    const u = who(request),
      id = nId.parse((request.params as { id: string }).id);
    const detail = await rs.detail(identity(u), id);
    if (
      u.role === "marketer" &&
      (detail.asset.state !== 0 || detail.asset.access !== 0)
    )
      fail(403, "This asset is not available");
    try {
      const [members, visible] = await Promise.all([
        rs.call<{ ref: number }[]>(identity(u), "get_resource_collections", {
          ref: String(id),
        }),
        rs.call<{ ref: number; name: string }[]>(
          identity(u),
          "get_user_collections",
        ),
      ]);
      if (!Array.isArray(members) || !Array.isArray(visible))
        throw new UpstreamError(502);
      const refs = new Set(members.map((c) => Number(c.ref)));
      return {
        ...detail,
        collections: visible
          .filter(
            (c) =>
              refs.has(Number(c.ref)) &&
              !String(c.name).startsWith("[AIA Transfer]"),
          )
          .map((c) => ({ ref: Number(c.ref), name: String(c.name) })),
        collectionsAvailable: true,
      };
    } catch {
      return { ...detail, collections: [], collectionsAvailable: false };
    }
  });
  app.get("/api/storage", async (request) => {
    admin(request);
    if (config.dataDir === ":memory:")
      return { available: false, label: "Application data filesystem" };
    try {
      const stats = await statfs(config.dataDir, { bigint: true });
      const totalBytes = Number(stats.blocks * stats.bsize),
        availableBytes = Number(stats.bavail * stats.bsize);
      if (
        !Number.isSafeInteger(totalBytes) ||
        totalBytes <= 0 ||
        availableBytes < 0 ||
        availableBytes > totalBytes
      )
        throw new Error("Unavailable");
      return {
        available: true,
        label: "Application data filesystem",
        totalBytes,
        availableBytes,
        usedBytes: totalBytes - availableBytes,
        measuredAt: new Date().toISOString(),
      };
    } catch {
      return { available: false, label: "Application data filesystem" };
    }
  });
  app.get("/api/library/:id/tags", async (request) => {
    const u = mediaEditor(request),
      id = nId.parse((request.params as { id: string }).id);
    return readTags(rs, identity(u), id);
  });
  app.post("/api/library/tags", async (request) => {
    const u = mediaEditor(request);
    const input = z
      .object({
        resourceIds: z.array(z.number().int().positive()).min(1).max(100),
        mode: z.enum(["add", "remove", "replace"]),
        tags: z
          .array(
            z
              .string()
              .transform((t) => t.normalize("NFKC").trim())
              .pipe(
                z
                  .string()
                  .min(1)
                  .max(80)
                  .regex(/^[^,\r\n]+$/),
              ),
          )
          .max(100),
        expected: z.array(z.string().max(80)).max(100).optional(),
      })
      .strict()
      .parse(request.body);
    if (
      input.mode === "replace" &&
      (input.resourceIds.length !== 1 || !input.expected)
    )
      fail(400, "Single-asset replacement requires the original tags");
    const ids = [...new Set(input.resourceIds)];
    // Preflight every resource before any metadata or canonical node write.
    for (const id of ids) {
      const state = await readTags(rs, identity(u), id);
      if (!state.editable) fail(403, "Native edit access denied");
    }
    const updated: number[] = [],
      failed: { id: number; error: string }[] = [];
    for (const id of ids) {
      try {
        await serializeTagWrite(() => writeTags(rs, identity(u), id, input));
        updated.push(id);
        store.audit(u.id, "asset.tags", String(id), input.mode);
      } catch (e) {
        failed.push({
          id,
          error:
            e instanceof UpstreamError
              ? "Native tag permission or source failure"
              : "Tags changed. Reload and retry.",
        });
      }
    }
    return { updated, failed };
  });
  app.get("/api/library/fields/:id/options", async (request) => {
    const u = mediaEditor(request),
      id = nId.parse((request.params as { id: string }).id);
    const nodes = await rs.call<{ ref: number; name: string }[]>(
      identity(u),
      "get_nodes",
      { ref: String(id) },
    );
    return {
      options: nodes.map((node) => ({
        id: Number(node.ref),
        value: String(node.name),
      })),
    };
  });
  async function relay(reply: any, response: Response, name?: string) {
    if (!response.ok || !response.body)
      throw new UpstreamError(response.status);
    if (name)
      reply
        .header("Content-Disposition", disposition(name))
        .type("application/octet-stream");
    else {
      const type = response.headers.get("content-type") || "";
      if (!/^image\/(jpeg|png|webp|gif)(;|$)/.test(type))
        throw new UpstreamError(404);
      reply.type(type);
    }
    const length = response.headers.get("content-length");
    if (length) reply.header("Content-Length", length);
    return reply
      .code(response.status)
      .send(Readable.fromWeb(response.body as any));
  }
  app.get("/api/library/:id/preview", async (request, reply) => {
    const query = z
      .object({ size: z.enum(["thm", "scr"]).default("scr") })
      .parse(request.query);
    const u = who(request),
      id = nId.parse((request.params as { id: string }).id);
    const detail = await rs.detail(identity(u), id);
    if (
      u.role === "marketer" &&
      (detail.asset.state !== 0 || detail.asset.access !== 0)
    )
      fail(403, "This asset is not available");
    return relay(
      reply,
      await rs.preview(
        identity(u),
        id,
        false,
        undefined,
        false,
        query.size === "thm",
      ),
    );
  });
  app.get("/api/library/:id/download", async (request, reply) => {
    const u = who(request),
      id = nId.parse((request.params as { id: string }).id);
    const detail = await rs.detail(identity(u), id);
    if (
      u.role === "marketer" &&
      (detail.asset.state !== 0 || detail.asset.access !== 0)
    )
      fail(403, "This asset is not available");
    store.audit(u.id, "asset.download", String(id));
    return relay(
      reply,
      await rs.preview(identity(u), id, true),
      detail.asset.filename.toLowerCase().endsWith("." + detail.asset.extension)
        ? detail.asset.filename
        : detail.asset.filename + "." + detail.asset.extension,
    );
  });
  app.get("/api/library/:id/video", async (request, reply) => {
    const u = who(request),
      id = nId.parse((request.params as { id: string }).id);
    const detail = await rs.detail(identity(u), id);
    if (
      detail.asset.kind !== "video" ||
      (u.role === "marketer" &&
        (detail.asset.state !== 0 || detail.asset.access !== 0))
    )
      fail(403, "This video is not available");
    const range = request.headers.range;
    if (range && !/^bytes=\d*-\d*$/.test(range))
      fail(416, "Choose a single byte range");
    let response = await rs.preview(identity(u), id, false, range, true);
    if (response.status === 404)
      response = await rs.preview(identity(u), id, true, range);
    if (!response.ok || !response.body)
      throw new UpstreamError(response.status);
    const type = response.headers.get("content-type") || "";
    if (!/^video\/(mp4|webm|quicktime)(;|$)/.test(type))
      fail(415, "This video needs a browser-compatible preview");
    for (const h of ["content-length", "content-range", "accept-ranges"]) {
      const v = response.headers.get(h);
      if (v) reply.header(h, v);
    }
    return reply
      .code(response.status)
      .type(type)
      .send(Readable.fromWeb(response.body as any));
  });
  app.post("/api/library/:id/metadata", async (request) => {
    const u = mediaEditor(request),
      id = nId.parse((request.params as { id: string }).id);
    const { fields } = z
      .object({
        fields: z
          .array(
            z.object({
              id: z.number().int().positive(),
              value: z.string().max(5000),
            }),
          )
          .min(1)
          .max(20),
      })
      .parse(request.body);
    for (const f of fields)
      await rs.call(identity(u), "update_field", {
        resource: String(id),
        field: String(f.id),
        value: f.value,
      });
    store.audit(u.id, "asset.metadata", String(id), String(fields.length));
    return { ok: true };
  });
  app.post("/api/library/:id/state", async (request) => {
    const u = mediaEditor(request),
      id = nId.parse((request.params as { id: string }).id);
    const input = z
      .object({
        state: z
          .number()
          .int()
          .refine((n) => [0, 2].includes(n)),
      })
      .parse(request.body);
    await rs.call(identity(u), "put_resource_data", {
      resource: String(id),
      data: JSON.stringify({ archive: input.state }),
    });
    store.audit(u.id, "asset.state", String(id), String(input.state));
    return { ok: true };
  });
  app.post("/api/library/upload", async (request) => {
    const u = who(request);
    const file = await request.file();
    if (!file) fail(400, "Choose a media file");
    const expectedSize = z.coerce
      .number()
      .int()
      .min(1)
      .max(20 * 1024 ** 3)
      .parse((request.query as { size?: string }).size);
    const name = safeFilename(file.filename),
      ext = name.split(".").pop()?.toLowerCase();
    if (
      !ext ||
      ![
        "jpg",
        "jpeg",
        "png",
        "webp",
        "tif",
        "tiff",
        "dng",
        "cr2",
        "nef",
        "arw",
        "mp4",
        "mov",
        "m4v",
        "webm",
      ].includes(ext)
    )
      fail(415, "Choose a supported photo or video");
    if ((userUploads.get(u.id) || 0) >= 2)
      fail(429, "Wait for a current upload to finish");
    const staging = path.resolve(config.dataDir, "staging");
    await mkdir(staging, { recursive: true, mode: 0o700 });
    const disk = await statfs(staging),
      declared = Number(request.headers["content-length"] || 0);
    if (declared > 20 * 1024 ** 3 + 1024 ** 2)
      fail(413, "The maximum file size is 20 GiB");
    if (Number(disk.bavail) * Number(disk.bsize) < 3 * expectedSize + 1024 ** 3)
      fail(507, "Storage is nearly full. Contact your administrator");
    const directory = await mkdtemp(path.join(staging, "upload-")),
      target = path.join(directory, "original");
    userUploads.set(u.id, (userUploads.get(u.id) || 0) + 1);
    try {
      let received = 0;
      const bounded = new Transform({
        transform(chunk, encoding, callback) {
          received += chunk.length;
          if (received > expectedSize)
            callback(
              new HttpError(413, "File content exceeds its declared size"),
            );
          else callback(null, chunk);
        },
      });
      await pipeline(
        file.file,
        bounded,
        createWriteStream(target, { flags: "wx", mode: 0o600 }),
      );
      if (file.file.truncated) fail(413, "The maximum file size is 20 GiB");
      if (received !== expectedSize)
        fail(400, "File size changed during upload");
      const type = await fileTypeFromFile(target);
      const video = ["mp4", "mov", "m4v", "webm"].includes(ext);
      if (
        !type ||
        !(video
          ? type.mime.startsWith("video/")
          : type.mime.startsWith("image/"))
      )
        fail(415, "The file content does not match a supported photo or video");
      const id = await rs.upload(
        identity(u),
        name,
        await openAsBlob(target, { type: type.mime }),
        video ? 3 : 1,
      );
      store.audit(u.id, "asset.upload", String(id));
      return { id, state: 0 };
    } finally {
      userUploads.set(u.id, (userUploads.get(u.id) || 1) - 1);
      await unlink(target).catch(() => {});
      await rmdir(directory).catch(() => {});
    }
  });
  app.get("/api/collections", async (request) => ({
    collections: await rs.call(identity(who(request)), "get_user_collections"),
  }));
  app.post("/api/library/bulk-metadata", async (request) => {
    const u = mediaEditor(request);
    const input = z
      .object({
        resourceIds: z.array(z.number().int().positive()).min(1).max(100),
        fields: z
          .array(
            z.object({
              id: z.number().int().positive(),
              value: z.string().max(5000),
            }),
          )
          .min(1)
          .max(20),
      })
      .parse(request.body);
    const refs = [...new Set(input.resourceIds)];
    // Authorize the full selection before making any native writes.
    for (const id of refs) await rs.detail(identity(u), id);
    const updated: number[] = [],
      failed: number[] = [];
    for (const id of refs) {
      try {
        for (const field of input.fields)
          await rs.call(identity(u), "update_field", {
            resource: String(id),
            field: String(field.id),
            value: field.value,
          });
        updated.push(id);
        store.audit(u.id, "asset.metadata", String(id), "bulk");
      } catch {
        failed.push(id);
      }
    }
    return { updated, failed };
  });
  app.post("/api/collections", async (request) => {
    const u = who(request);
    const input = z
      .object({
        name: z.string().trim().min(1).max(100),
        resourceIds: z.array(z.number().int().positive()).max(100).default([]),
      })
      .parse(request.body);
    if (input.name.startsWith("[AIA Transfer]"))
      fail(400, "This collection name is reserved");
    for (const ref of input.resourceIds) await rs.detail(identity(u), ref);
    const id = await rs.call<number>(identity(u), "create_collection", {
      name: input.name,
    });
    if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0)
      fail(502, "The source could not create this collection");
    const failed: number[] = [];
    for (const ref of [...new Set(input.resourceIds)]) {
      try {
        const result = await rs.call(
          identity(u),
          "add_resource_to_collection",
          { resource: String(ref), collection: String(id) },
        );
        if (result !== true) failed.push(ref);
      } catch {
        failed.push(ref);
      }
    }
    store.audit(u.id, "collection.created", String(id));
    return { id, failed };
  });
  async function accessibleCollection(u: UserRow, id: number) {
    const collections = await rs.call<{ ref: number; name: string }[]>(
      identity(u),
      "get_user_collections",
    );
    const collection = collections.find((c) => Number(c.ref) === id);
    if (!collection) fail(404, "Collection not found");
    if (collection.name.startsWith("[AIA Transfer]"))
      fail(403, "Transfer-managed collections cannot be edited here");
    return collection;
  }
  app.post("/api/collections/:id", async (request) => {
    const u = who(request),
      id = nId.parse((request.params as { id: string }).id);
    const input = z
      .object({ name: z.string().trim().min(1).max(100) })
      .strict()
      .parse(request.body);
    if (input.name.startsWith("[AIA Transfer]"))
      fail(400, "This collection name is reserved");
    await accessibleCollection(u, id);
    const result = await rs.call(identity(u), "save_collection", {
      ref: String(id),
      coldata: JSON.stringify({ name: input.name }),
    });
    if (result !== true)
      fail(403, "The source did not permit this collection change");
    store.audit(u.id, "collection.renamed", String(id));
    return { ok: true };
  });
  app.post("/api/collections/:id/members", async (request) => {
    const u = who(request),
      id = nId.parse((request.params as { id: string }).id);
    const input = z
      .object({
        action: z.enum(["add", "remove"]),
        resourceIds: z.array(z.number().int().positive()).min(1).max(100),
      })
      .strict()
      .parse(request.body);
    await accessibleCollection(u, id);
    for (const resource of input.resourceIds)
      await rs.detail(identity(u), resource);
    const updated: number[] = [],
      failed: number[] = [];
    for (const resource of [...new Set(input.resourceIds)]) {
      try {
        const result = await rs.call(
          identity(u),
          input.action === "add"
            ? "add_resource_to_collection"
            : "remove_resource_from_collection",
          { resource: String(resource), collection: String(id) },
        );
        if (result !== true) throw new UpstreamError(403);
        updated.push(resource);
      } catch {
        failed.push(resource);
      }
    }
    store.audit(
      u.id,
      "collection.members-" + input.action,
      String(id),
      JSON.stringify({ updated: updated.length, failed: failed.length }),
    );
    return { updated, failed };
  });
  app.get("/api/transfers", async (request) => {
    const u = who(request);
    const rows =
      u.role === "admin"
        ? store.all<TransferRow>(
            "SELECT * FROM transfers ORDER BY created_at DESC LIMIT 200",
          )
        : store.all<TransferRow>(
            "SELECT * FROM transfers WHERE owner=? ORDER BY created_at DESC LIMIT 200",
            u.id,
          );
    return { transfers: rows.map((t) => view(t)) };
  });
  app.get("/api/transfers/:id", async (request) => {
    const { id } = idParam.parse(request.params);
    return { transfer: view(owns(request, id), true) };
  });
  app.post("/api/transfers", async (request) => {
    const u = who(request),
      input = transferInput.parse(request.body);
    if (!!input.files === !!input.resourceIds)
      fail(400, "Choose library assets or temporary files");
    const id = token(),
      created = new Date(),
      expires = new Date(created.getTime() + input.days * 86400_000),
      secret = token();
    let native: any = null;
    let files: {
      id: string;
      name: string;
      size: number;
      resourceId?: number;
    }[] = [];
    if (input.resourceIds) {
      const whoRs = identity(u);
      for (const ref of input.resourceIds) {
        const { asset } = await rs.detail(whoRs, ref);
        if (asset.state !== 0 || asset.access !== 0)
          fail(
            403,
            "Only available library assets with open access can be shared",
          );
        files.push({
          id: token(),
          name: asset.filename.toLowerCase().endsWith("." + asset.extension)
            ? asset.filename
            : asset.filename + "." + asset.extension,
          size: asset.bytes,
          resourceId: ref,
        });
      }
      native = await rs.call(whoRs, "aia_transfer_create", {
        resources: input.resourceIds.join(","),
        title: input.title,
        expires: expires.toISOString().slice(0, 10),
        password: secret,
      });
    } else
      files = input.files!.map((f) => ({
        id: token(),
        name: safeFilename(f.name),
        size: f.size,
      }));
    const passwordHash = input.password
      ? await hashPassword(input.password)
      : null;
    store.db.exec("BEGIN IMMEDIATE");
    try {
      store.run(
        "INSERT INTO transfers(id,owner,title,note,source,state,created_at,expires_at,password_hash,download_limit,source_secret,native_share) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        id,
        u.id,
        input.title,
        input.note,
        input.resourceIds ? "library" : "temporary",
        input.resourceIds ? "active" : "draft",
        created.toISOString(),
        expires.toISOString(),
        passwordHash,
        input.downloadLimit,
        box.seal(secret),
        native ? box.seal(native) : null,
      );
      for (const f of files)
        store.run(
          "INSERT INTO files(id,transfer_id,name,size,source_upload,resource_id,uploaded,complete) VALUES(?,?,?,?,?,?,?,?)",
          f.id,
          id,
          f.name,
          f.size,
          input.files ? randomUUID() : null,
          f.resourceId ?? null,
          input.resourceIds ? f.size : 0,
          input.resourceIds ? 1 : 0,
        );
      store.db.exec("COMMIT");
    } catch (e) {
      store.db.exec("ROLLBACK");
      if (native)
        try {
          await rs.call(identity(u), "aia_transfer_revoke", {
            collection: String(native.collection),
            access_key: native.accessKey,
          });
        } catch {}
      throw e;
    }
    store.audit(
      u.id,
      "transfer.created",
      id,
      input.resourceIds ? "library" : "temporary",
    );
    return { transfer: view(store.transfer(id)!, true) };
  });
  app.post(
    "/api/transfers/:id/chunk",
    {
      bodyLimit: MAX_CHUNK,
      config: { rateLimit: { max: 1000, timeWindow: "1 minute" } },
    },
    async (request) => {
      const { id } = idParam.parse(request.params),
        t = owns(request, id),
        u = who(request);
      const q = z
        .object({ fileId: z.string(), offset: z.coerce.number().int().min(0) })
        .parse(request.query);
      const f = store.get<FileRow>(
        "SELECT * FROM files WHERE id=? AND transfer_id=?",
        q.fileId,
        id,
      );
      if (
        !f ||
        t.source !== "temporary" ||
        t.state !== "draft" ||
        Date.parse(t.expires_at) <= Date.now() ||
        f.complete
      )
        fail(409, "This upload is not active");
      const bytes = request.body as Buffer;
      if (
        !Buffer.isBuffer(bytes) ||
        !bytes.length ||
        bytes.length > MAX_CHUNK ||
        q.offset !== f.uploaded ||
        q.offset + bytes.length > f.size
      )
        fail(409, "Upload offset changed. Resume from the current position");
      if (uploads.has(f.id) || (userUploads.get(u.id) || 0) >= 2)
        fail(429, "Wait for the current upload chunk");
      uploads.add(f.id);
      userUploads.set(u.id, (userUploads.get(u.id) || 0) + 1);
      try {
        await gokapi.chunk(f.source_upload!, f.size, q.offset, bytes);
        store.run(
          "UPDATE files SET uploaded=? WHERE id=?",
          q.offset + bytes.length,
          f.id,
        );
        return { uploadedBytes: q.offset + bytes.length };
      } finally {
        uploads.delete(f.id);
        userUploads.set(u.id, (userUploads.get(u.id) || 1) - 1);
      }
    },
  );
  app.post("/api/transfers/:id/complete-file", async (request) => {
    const { id } = idParam.parse(request.params),
      t = owns(request, id);
    const { fileId } = z.object({ fileId: z.string() }).parse(request.body);
    const f = store.get<FileRow>(
      "SELECT * FROM files WHERE id=? AND transfer_id=?",
      fileId,
      id,
    );
    if (
      !f ||
      t.state !== "draft" ||
      t.source !== "temporary" ||
      f.uploaded !== f.size ||
      Date.parse(t.expires_at) <= Date.now()
    )
      fail(409, "Upload is not complete");
    if (f.complete) return { ok: true };
    if (uploads.has(f.id)) fail(409, "File finalization is already running");
    uploads.add(f.id);
    try {
      const name = nativeFilename(f);
      // Durable intent prevents duplicate native completion after timeout/restart.
      if (f.finalizing) {
        const recovered = await gokapi.find(name, f.size);
        if (!recovered)
          fail(
            409,
            "Native processing is still pending. Retry shortly or revoke this transfer.",
          );
        store.run(
          "UPDATE files SET source_id=?,complete=1,finalizing=0 WHERE id=?",
          recovered.Id,
          f.id,
        );
        return { ok: true };
      }
      store.run("UPDATE files SET finalizing=1 WHERE id=?", f.id);
      const native = await gokapi.complete(
        f.source_upload!,
        f.size,
        name,
        Math.max(
          1,
          Math.ceil((Date.parse(t.expires_at) - Date.now()) / 86400_000),
        ),
        box.open<string>(t.source_secret),
      );
      store.run(
        "UPDATE files SET source_id=?,complete=1,finalizing=0 WHERE id=?",
        native.Id,
        f.id,
      );
      return { ok: true };
    } finally {
      uploads.delete(f.id);
    }
  });
  app.post("/api/transfers/:id/activate", async (request) => {
    const { id } = idParam.parse(request.params),
      t = owns(request, id);
    if (
      t.state !== "draft" ||
      store.files(id).some((f) => !f.complete) ||
      Date.parse(t.expires_at) <= Date.now()
    )
      fail(409, "Finish all files before sharing");
    store.run("UPDATE transfers SET state='active' WHERE id=?", id);
    store.audit(who(request).id, "transfer.activated", id);
    return { transfer: view(store.transfer(id)!, true) };
  });
  const stopStreams = (id: string) => {
    for (const stream of streams.get(id) || []) stream.destroy();
    streams.delete(id);
  };
  function nativeFilename(f: FileRow) {
    const ext =
      f.name
        .split(".")
        .pop()
        ?.replace(/[^a-z0-9]/gi, "")
        .slice(0, 10) || "bin";
    return `aia-${f.id}.${ext}`;
  }
  async function reconcile(t: TransferRow) {
    stopStreams(t.id);
    if (t.source === "temporary") {
      for (const f of store.files(t.id)) {
        let sourceId = f.source_id;
        if (!sourceId && f.finalizing) {
          const recovered = await gokapi.find(nativeFilename(f), f.size);
          if (!recovered) throw new UpstreamError(503);
          sourceId = recovered.Id;
          store.run(
            "UPDATE files SET source_id=?,complete=1,finalizing=0 WHERE id=?",
            sourceId,
            f.id,
          );
        }
        if (sourceId) await gokapi.remove(sourceId);
      }
    } else if (t.native_share) {
      const native = box.open<any>(t.native_share),
        u = store.user(t.owner);
      if (u?.rs_credentials)
        await rs.call(identity(u), "aia_transfer_revoke", {
          collection: String(native.collection),
          access_key: native.accessKey,
        });
    }
    store.run(
      "UPDATE transfers SET state=?,revoke_error=NULL WHERE id=?",
      Date.parse(t.expires_at) <= Date.now() ? "expired" : "revoked",
      t.id,
    );
    store.audit("system", "transfer.source-reconciled", t.id);
  }
  app.post("/api/transfers/:id/revoke", async (request) => {
    const { id } = idParam.parse(request.params),
      t = owns(request, id);
    if (["revoked", "expired"].includes(t.state)) return { ok: true };
    store.run("UPDATE transfers SET state='revoking' WHERE id=?", id);
    stopStreams(id);
    store.audit(who(request).id, "transfer.revoked", id);
    try {
      await reconcile(t);
      return { ok: true, sourceRevoked: true };
    } catch {
      store.run(
        "UPDATE transfers SET revoke_error=? WHERE id=?",
        "Source cleanup will retry",
        id,
      );
      return { ok: true, sourceRevoked: false, cleanupPending: true };
    }
  });
  function publicTransfer(id: string) {
    const t = store.transfer(id);
    if (
      !t ||
      t.state !== "active" ||
      Date.parse(t.expires_at) <= Date.now() ||
      store.user(t.owner)?.disabled
    )
      fail(410, "This transfer has expired or is no longer available");
    if (t.download_limit !== null && t.downloads >= t.download_limit)
      fail(410, "The download limit has been reached");
    return t!;
  }
  function recipient(request: FastifyRequest, t: TransferRow) {
    if (!t.password_hash) return true;
    const raw = request.cookies.aia_recipient;
    return (
      !!raw &&
      !!store.get(
        "SELECT hash FROM grants WHERE hash=? AND transfer_id=? AND expires>?",
        digest(raw),
        t.id,
        Date.now(),
      )
    );
  }
  app.get("/api/public/:id", async (request) => {
    const { id } = idParam.parse(request.params),
      t = publicTransfer(id);
    if (!recipient(request, t))
      return { locked: true, title: t.title, passwordProtected: true };
    return {
      locked: false,
      title: t.title,
      note: t.note,
      expiresAt: t.expires_at,
      source: t.source,
      downloadLimit: t.download_limit,
      downloads: t.downloads,
      files: store
        .files(id)
        .map((f) => ({ id: f.id, name: f.name, size: f.size })),
    };
  });
  app.post(
    "/api/public/:id/authorize",
    { config: { rateLimit: { max: 6, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { id } = idParam.parse(request.params),
        t = publicTransfer(id);
      const { password } = z
        .object({ password: z.string().max(128) })
        .parse(request.body);
      if (t.password_hash && !(await checkPassword(password, t.password_hash)))
        fail(403, "That transfer password is incorrect");
      const raw = token(),
        expires = Math.min(Date.parse(t.expires_at), Date.now() + 3600_000);
      store.run(
        "INSERT INTO grants(hash,transfer_id,expires) VALUES(?,?,?)",
        digest(raw),
        id,
        expires,
      );
      reply.setCookie("aia_recipient", raw, {
        ...cookieOptions,
        path: "/api/public/" + id,
        maxAge: Math.floor((expires - Date.now()) / 1000),
      });
      return { ok: true };
    },
  );
  async function originalResponse(
    t: TransferRow,
    f: FileRow,
    range?: string,
    signal?: AbortSignal,
  ) {
    let response: Response;
    if (t.source === "temporary") {
      const native = await gokapi.info(f.source_id!);
      response = await nativeDownload(
        String(native.UrlDownload || native.UrlHotlink),
        box.open<string>(t.source_secret),
        config.gokapiUrl,
        "gokapi",
        range,
        signal,
      );
    } else {
      if (!t.native_share) fail(410, "Share is unavailable");
      const native = box.open<any>(t.native_share),
        u = store.user(t.owner)!;
      const link = await rs.call<{ url: string }>(
        identity(u),
        "aia_transfer_download",
        {
          collection: String(native.collection),
          access_key: native.accessKey,
          resource: String(f.resource_id),
        },
      );
      response = await nativeDownload(
        link.url,
        box.open<string>(t.source_secret),
        config.rsUrl,
        "rs",
        range,
        signal,
      );
    }
    return response;
  }
  app.get("/api/public/:id/archive", async (request, reply) => {
    const { id } = idParam.parse(request.params),
      t = publicTransfer(id);
    if (!recipient(request, t)) fail(403, "Enter the transfer password");
    if (request.headers.range)
      fail(416, "ZIP downloads must start from the beginning");
    const files = store.files(id);
    if (!files.length || files.some((f) => !f.complete))
      fail(410, "Files are not ready");
    const controller = new AbortController();
    const disconnected = () => controller.abort();
    reply.raw.once("close", disconnected);
    let first: Response;
    try {
      first = await originalResponse(t, files[0], undefined, controller.signal);
      if (!first.body || first.status !== 200 || !store.claimDownload(id)) {
        await first.body?.cancel();
        fail(410, "This transfer is no longer available");
      }
    } catch (error) {
      reply.raw.removeListener("close", disconnected);
      controller.abort();
      throw error;
    }
    const archive = originalZip(
      files.map((file, index) => ({
        name: file.name,
        open: async () => {
          const current = store.transfer(id);
          if (
            !current ||
            current.state !== "active" ||
            Date.parse(current.expires_at) <= Date.now() ||
            store.user(current.owner)?.disabled
          )
            throw new Error("Sharing link inactive");
          return index === 0
            ? first
            : originalResponse(t, file, undefined, controller.signal);
        },
      })),
      controller.signal,
    );
    const active = streams.get(id) || new Set<Readable>();
    active.add(archive);
    streams.set(id, active);
    archive.once("close", () => {
      controller.abort();
      void first.body?.cancel().catch(() => {});
      active.delete(archive);
      if (!active.size) streams.delete(id);
      reply.raw.removeListener("close", disconnected);
    });
    reply
      .type("application/zip")
      .header(
        "Content-Disposition",
        disposition(t.title.replace(/\.zip$/i, "") + ".zip"),
      );
    store.audit(
      "recipient",
      "transfer.archive-download-started",
      id,
      String(files.length),
    );
    void archive.finalize().catch((error) => archive.destroy(error));
    return reply.send(archive);
  });
  app.get("/api/public/:id/files/:fileId", async (request, reply) => {
    const { id } = idParam.parse(request.params),
      t = publicTransfer(id);
    if (!recipient(request, t)) fail(403, "Enter the transfer password");
    const fileId = (request.params as { fileId: string }).fileId,
      f = store.get<FileRow>(
        "SELECT * FROM files WHERE id=? AND transfer_id=?",
        fileId,
        id,
      );
    if (!f || !f.complete) fail(404, "File not found");
    const range = request.headers.range;
    if (range && !/^bytes=\d*-\d*$/.test(range))
      fail(416, "Only a single byte range is supported");
    const response = await originalResponse(t, f, range);
    if (!response.body || !store.claimDownload(id)) {
      await response.body?.cancel();
      fail(410, "This transfer is no longer available");
    }
    const stream = Readable.fromWeb(response.body as any);
    const active = streams.get(id) || new Set<Readable>();
    active.add(stream);
    streams.set(id, active);
    stream.once("close", () => {
      active.delete(stream);
      if (!active.size) streams.delete(id);
    });
    reply
      .type("application/octet-stream")
      .header("Content-Disposition", disposition(f.name));
    for (const h of ["content-length", "content-range", "accept-ranges"]) {
      const v = response.headers.get(h);
      if (v) reply.header(h, v);
    }
    store.audit("recipient", "transfer.download-started", id, f.id);
    return reply.code(response.status).send(stream);
  });
  let cleaning = false;
  const cleanup = async () => {
    store.run(
      "DELETE FROM invitations WHERE (hash IS NOT NULL AND expires<=?) OR (hash IS NULL AND setup_expires<=?)",
      Date.now(),
      Date.now(),
    );
    if (cleaning) return;
    cleaning = true;
    try {
      store.run("DELETE FROM sessions WHERE expires<?", Date.now());
      store.run("DELETE FROM grants WHERE expires<?", Date.now());
      for (const [id, e] of enrollments)
        if (e.expires < Date.now()) enrollments.delete(id);
      store.run(
        "UPDATE transfers SET state='revoking' WHERE state IN ('active','draft') AND expires_at<=?",
        new Date().toISOString(),
      );
      for (const f of store.all<FileRow>(
        "SELECT * FROM files WHERE finalizing=1 AND complete=0 LIMIT 25",
      )) {
        if (uploads.has(f.id)) continue;
        try {
          const native = await gokapi.find(nativeFilename(f), f.size);
          if (native)
            store.run(
              "UPDATE files SET source_id=?,complete=1,finalizing=0 WHERE id=?",
              native.Id,
              f.id,
            );
        } catch {
          /* Durable intent remains for the next retry. */
        }
      }
      for (const t of store.all<TransferRow>(
        "SELECT * FROM transfers WHERE state='revoking' LIMIT 25",
      )) {
        try {
          await reconcile(t);
        } catch {
          store.run(
            "UPDATE transfers SET revoke_error=? WHERE id=?",
            "Source cleanup will retry",
            t.id,
          );
        }
      }
      for (const u of store.all<UserRow>(
        "SELECT * FROM users WHERE disabled=1 AND source_managed=1 AND source_disabled=0",
      )) {
        if (
          store.get(
            "SELECT id FROM transfers WHERE owner=? AND state='revoking'",
            u.id,
          )
        )
          continue;
        try {
          if (!config.rsProvisionIdentity) continue;
          await rs.call(config.rsProvisionIdentity, "aia_staff_set_enabled", {
            username: identity(u).user,
            enabled: "0",
          });
          store.run("UPDATE users SET source_disabled=1 WHERE id=?", u.id);
          store.audit("system", "user.source-disabled", u.id);
        } catch {
          app.log.warn("Source account offboarding will retry");
        }
      }
      store.run(
        "DELETE FROM audit WHERE at<?",
        new Date(Date.now() - 180 * 86400_000).toISOString(),
      );
    } finally {
      cleaning = false;
    }
  };
  app.get("/api/admin/status", async (request) => {
    admin(request);
    let freeBytes: number | null = null;
    try {
      const disk = await statfs(config.dataDir);
      freeBytes = Number(disk.bavail) * Number(disk.bsize);
    } catch {}
    return {
      freeBytes,
      pendingCleanup: store.get<{ count: number }>(
        "SELECT COUNT(*) count FROM transfers WHERE state='revoking'",
      )?.count,
      pendingFinalizations: store.get<{ count: number }>(
        "SELECT COUNT(*) count FROM files WHERE finalizing=1",
      )?.count,
      staffCount: store.get<{ count: number }>(
        "SELECT COUNT(*) count FROM users WHERE disabled=0",
      )?.count,
      version: "0.1.0",
    };
  });
  const timer = setInterval(() => {
    void cleanup().catch(() =>
      app.log.error("Lifecycle reconciliation failed"),
    );
  }, 30_000);
  timer.unref();
  app.addHook("onClose", async () => {
    clearInterval(timer);
    challenges.clear();
    for (const id of streams.keys()) stopStreams(id);
    store.close();
  });
  return { app, store, box, cleanup };
}
