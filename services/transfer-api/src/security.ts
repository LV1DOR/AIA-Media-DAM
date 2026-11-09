import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  createHash,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
const derive = (value: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(
      value,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 ** 2 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
export const token = () => randomBytes(32).toString("base64url");
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function hashPassword(value: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(value, salt);
  return `scrypt$${salt}$${key.toString("hex")}`;
}
export async function checkPassword(value: string, encoded: string) {
  try {
    const [method, salt, expected] = encoded.split("$");
    if (method !== "scrypt" || !salt || expected?.length !== 128) return false;
    const key = await derive(value, salt);
    return timingSafeEqual(key, Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
export class SecretBox {
  private key: Buffer;
  constructor(encoded: string) {
    this.key = Buffer.from(encoded, "base64");
    if (this.key.length !== 32)
      throw new Error("AIA_MASTER_KEY must encode 32 random bytes");
  }
  seal(value: unknown) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const body = Buffer.concat([
      cipher.update(JSON.stringify(value), "utf8"),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
  }
  open<T>(encoded: string): T {
    const bytes = Buffer.from(encoded, "base64");
    const cipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      bytes.subarray(0, 12),
    );
    cipher.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([
        cipher.update(bytes.subarray(28)),
        cipher.final(),
      ]).toString(),
    ) as T;
  }
}
export function safeFilename(name: string) {
  return name.replace(/[\r\n\x00-\x1f/\\]/g, "_").slice(0, 240) || "download";
}
export function disposition(name: string) {
  return `attachment; filename="${safeFilename(name).replace(/[^a-zA-Z0-9._ -]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(safeFilename(name)).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())}`;
}
