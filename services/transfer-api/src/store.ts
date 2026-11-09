import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
export type UserRow = {
  id: string;
  username: string;
  name: string;
  role: string;
  password_hash: string;
  rs_credentials: string | null;
  totp_secret: string | null;
  disabled: number;
  session_version: number;
  source_managed: number;
  source_disabled: number;
  invitation_pending: number;
};
export type TransferRow = {
  id: string;
  owner: string;
  title: string;
  note: string;
  source: string;
  state: string;
  created_at: string;
  expires_at: string;
  password_hash: string | null;
  download_limit: number | null;
  downloads: number;
  source_secret: string;
  native_share: string | null;
  revoke_error: string | null;
};
export type FileRow = {
  id: string;
  transfer_id: string;
  name: string;
  size: number;
  uploaded: number;
  source_upload: string | null;
  source_id: string | null;
  resource_id: number | null;
  complete: number;
  finalizing: number;
};
export class Store {
  db: DatabaseSync;
  constructor(directory: string) {
    if (directory !== ":memory:")
      mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(
      directory === ":memory:"
        ? directory
        : path.join(directory, "registry.sqlite"),
    );
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS schema_version(version INTEGER NOT NULL); INSERT INTO schema_version SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM schema_version);
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE COLLATE NOCASE,name TEXT NOT NULL,role TEXT NOT NULL,password_hash TEXT NOT NULL,rs_credentials TEXT,totp_secret TEXT,disabled INTEGER NOT NULL DEFAULT 0,session_version INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL,version INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS transfers(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES users(id),title TEXT NOT NULL,note TEXT NOT NULL,source TEXT NOT NULL,state TEXT NOT NULL,created_at TEXT NOT NULL,expires_at TEXT NOT NULL,password_hash TEXT,download_limit INTEGER,downloads INTEGER NOT NULL DEFAULT 0,source_secret TEXT NOT NULL,native_share TEXT,revoke_error TEXT);
 CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY,transfer_id TEXT NOT NULL REFERENCES transfers(id),name TEXT NOT NULL,size INTEGER NOT NULL,uploaded INTEGER NOT NULL DEFAULT 0,source_upload TEXT,source_id TEXT,resource_id INTEGER,complete INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS grants(hash TEXT PRIMARY KEY,transfer_id TEXT NOT NULL REFERENCES transfers(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,at TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,subject TEXT NOT NULL,detail TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS files_transfer ON files(transfer_id); CREATE INDEX IF NOT EXISTS transfers_owner ON transfers(owner,created_at); CREATE INDEX IF NOT EXISTS grants_expiry ON grants(expires);`);
    const columns = this.db.prepare("PRAGMA table_info(users)").all() as {
      name: string;
    }[];
    for (const name of [
      "source_managed",
      "source_disabled",
      "invitation_pending",
    ])
      if (!columns.some((c) => c.name === name))
        this.db.exec(
          `ALTER TABLE users ADD COLUMN ${name} INTEGER NOT NULL DEFAULT 0`,
        );
    const fileColumns = this.db.prepare("PRAGMA table_info(files)").all() as {
      name: string;
    }[];
    if (!fileColumns.some((c) => c.name === "finalizing"))
      this.db.exec(
        "ALTER TABLE files ADD COLUMN finalizing INTEGER NOT NULL DEFAULT 0",
      );
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS invitations(user_id TEXT PRIMARY KEY REFERENCES users(id),hash TEXT UNIQUE,expires INTEGER NOT NULL,version INTEGER NOT NULL,setup_hash TEXT UNIQUE,setup_expires INTEGER,password_hash TEXT,totp_secret TEXT,attempts INTEGER NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS profile_photos(user_id TEXT PRIMARY KEY REFERENCES users(id),data BLOB NOT NULL); CREATE TABLE IF NOT EXISTS background_photos(id TEXT PRIMARY KEY,title TEXT NOT NULL,data BLOB NOT NULL,created_at TEXT NOT NULL); UPDATE schema_version SET version=5;`,
    );
    this.db
      .exec(`CREATE TABLE IF NOT EXISTS auth_metadata(name TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS totp_steps(user_id TEXT PRIMARY KEY REFERENCES users(id),step INTEGER NOT NULL);
      UPDATE schema_version SET version=6;`);
  }
  get<T>(sql: string, ...params: (string | number | null)[]) {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }
  all<T>(sql: string, ...params: (string | number | null)[]) {
    return this.db.prepare(sql).all(...params) as T[];
  }
  run(sql: string, ...params: (string | number | null | Uint8Array)[]) {
    return this.db.prepare(sql).run(...params);
  }
  user(id: string) {
    return this.get<UserRow>("SELECT * FROM users WHERE id=?", id);
  }
  transfer(id: string) {
    return this.get<TransferRow>("SELECT * FROM transfers WHERE id=?", id);
  }
  files(id: string) {
    return this.all<FileRow>(
      "SELECT * FROM files WHERE transfer_id=? ORDER BY rowid",
      id,
    );
  }
  audit(actor: string, action: string, subject: string, detail = "") {
    this.run(
      "INSERT INTO audit(at,actor,action,subject,detail) VALUES(?,?,?,?,?)",
      new Date().toISOString(),
      actor,
      action,
      subject,
      detail,
    );
  }
  claimDownload(id: string) {
    return (
      this.run(
        `UPDATE transfers SET downloads=downloads+1 WHERE id=? AND state='active' AND expires_at>? AND (download_limit IS NULL OR downloads<download_limit)`,
        id,
        new Date().toISOString(),
      ).changes === 1
    );
  }
  close() {
    this.db.close();
  }
}
