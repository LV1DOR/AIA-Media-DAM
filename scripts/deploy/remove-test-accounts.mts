// Operator-only maintenance while the live API is stopped. Never deletes DAM media.
import { readFileSync } from "node:fs";
import { createApp } from "../../services/transfer-api/src/app.js";
import type {
  UserRow,
  TransferRow,
} from "../../services/transfer-api/src/store.js";

if (
  process.platform !== "linux" ||
  !process.argv.includes("--approved-test-account-cleanup")
)
  throw new Error("Explicit owner-approved NAS test-account cleanup required");
const input = JSON.parse(readFileSync(0, "utf8")) as {
  keep: string;
  targets: string[];
};
if (
  input.keep !== "admin" ||
  !input.targets.length ||
  input.targets.some((id) => !/^[A-Za-z0-9_-]{43}$/.test(id))
)
  throw new Error("Explicit retained administrator and target IDs required");
const { app, store, cleanup } = await createApp({
  dataDir: process.env.AIA_DATA_DIR || "/data",
  masterKey: process.env.AIA_MASTER_KEY!,
  mediaOrigin: process.env.AIA_MEDIA_ORIGIN!,
  transferOrigin: process.env.AIA_TRANSFER_ORIGIN!,
  secureCookies: true,
  rsUrl: process.env.AIA_RS_URL!,
  gokapiUrl: process.env.AIA_GOKAPI_URL!,
  gokapiKey: process.env.AIA_GOKAPI_KEY!,
  rsProvisionIdentity:
    process.env.AIA_RS_PROVISION_USER && process.env.AIA_RS_PROVISION_KEY
      ? {
          user: process.env.AIA_RS_PROVISION_USER,
          key: process.env.AIA_RS_PROVISION_KEY,
        }
      : undefined,
});
try {
  const keep = store.get<UserRow>(
    "SELECT * FROM users WHERE username=? COLLATE NOCASE",
    input.keep,
  );
  if (
    !keep ||
    keep.role !== "admin" ||
    keep.disabled ||
    keep.invitation_pending
  )
    throw new Error("Retained administrator is unavailable");
  const targets = store.all<UserRow>(
    "SELECT * FROM users WHERE id!=? ORDER BY id",
    keep.id,
  );
  if (
    JSON.stringify(targets.map((u) => u.id).sort()) !==
    JSON.stringify([...new Set(input.targets)].sort())
  )
    throw new Error("Account inventory changed; refusing cleanup");
  store.db.exec("BEGIN IMMEDIATE");
  try {
    for (const user of targets) {
      store.run(
        "UPDATE users SET disabled=1,session_version=session_version+1 WHERE id=?",
        user.id,
      );
      store.run("DELETE FROM sessions WHERE user_id=?", user.id);
      store.run(
        "UPDATE transfers SET state='revoking' WHERE owner=? AND state NOT IN ('revoked','expired')",
        user.id,
      );
    }
    store.db.exec("COMMIT");
  } catch (error) {
    store.db.exec("ROLLBACK");
    throw error;
  }
  // Use the existing native lifecycle APIs before removing local account records.
  for (let attempt = 0; attempt < 10; attempt++) {
    await cleanup();
    if (
      targets.every(
        (user) =>
          !store.get(
            "SELECT id FROM transfers WHERE owner=? AND state NOT IN ('revoked','expired')",
            user.id,
          ),
      )
    )
      break;
  }
  for (const user of targets) {
    if (
      store.get(
        "SELECT id FROM transfers WHERE owner=? AND state NOT IN ('revoked','expired')",
        user.id,
      )
    )
      throw new Error(
        "Source revocation is incomplete; accounts remain disabled for retry",
      );
    if (user.source_managed && !store.user(user.id)?.source_disabled)
      throw new Error(
        "Managed source account could not be disabled; local account retained",
      );
  }
  let removedTransfers = 0;
  store.db.exec("BEGIN IMMEDIATE");
  try {
    for (const user of targets) {
      for (const transfer of store.all<TransferRow>(
        "SELECT * FROM transfers WHERE owner=?",
        user.id,
      )) {
        store.run("DELETE FROM grants WHERE transfer_id=?", transfer.id);
        store.run("DELETE FROM files WHERE transfer_id=?", transfer.id);
        store.run("DELETE FROM transfers WHERE id=?", transfer.id);
        removedTransfers++;
      }
      for (const table of ["invitations", "profile_photos", "totp_steps"])
        store.run(`DELETE FROM ${table} WHERE user_id=?`, user.id);
      store.run("DELETE FROM users WHERE id=?", user.id);
      store.audit(
        keep.id,
        "user.test-account-removed",
        user.id,
        "Owner-approved NAS test-account cleanup",
      );
    }
    if (
      JSON.stringify(store.user(keep.id)) !== JSON.stringify(keep) ||
      store.get<{ count: number }>("SELECT count(*) count FROM users")!
        .count !== 1
    )
      throw new Error("Retained administrator or final account count differs");
    store.db.exec("COMMIT");
  } catch (error) {
    store.db.exec("ROLLBACK");
    throw error;
  }
  console.log(
    JSON.stringify({
      accountsRemoved: targets.length,
      remainingAccounts: 1,
      retainedUsername: "admin",
      retainedAdminUnchanged: true,
      retiredTransfersRemoved: removedTransfers,
      managedNativeAccountsDisabled: true,
      permanentMediaDeleted: false,
    }),
  );
} finally {
  await app.close();
}
