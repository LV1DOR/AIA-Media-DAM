// Local review identities are separate from synthetic media and production.
import { mkdir, open, readFile, chmod, stat } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { homedir } from "node:os";

export function defaultReviewIdentityDirectory() {
  const base =
    process.platform === "win32"
      ? process.env.LOCALAPPDATA || path.join(homedir(), "AppData", "Local")
      : process.env.XDG_DATA_HOME || path.join(homedir(), ".local", "share");
  return path.resolve(base, "AIA-Media", "review-identity");
}

export async function reviewIdentity(directory: string) {
  const dataDir = path.resolve(directory);
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const keyPath = path.join(dataDir, "master-key"),
    database = path.join(dataDir, "registry.sqlite");
  let key: string;
  try {
    key = (await readFile(keyPath, "utf8")).trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    if (
      await stat(database).then(
        () => true,
        (error) => {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
          throw error;
        },
      )
    )
      throw new Error(
        "Review identity key is missing. Restore the original key; accounts were left untouched.",
      );
    key = randomBytes(32).toString("base64");
    try {
      const file = await open(keyPath, "wx", 0o600);
      try {
        await file.writeFile(key);
        await file.sync();
      } finally {
        await file.close();
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      key = (await readFile(keyPath, "utf8")).trim();
    }
  }
  if (Buffer.from(key, "base64").length !== 32)
    throw new Error(
      "Invalid review identity key. Restore the original key; do not delete the identity database.",
    );
  if (process.platform !== "win32") await chmod(keyPath, 0o600);
  return { dataDir, masterKey: key };
}
