import { digest, token } from "./security.js";
import type { UserRow } from "./store.js";

// Password verification grants only this short-lived, single-use challenge.
// It never creates a staff session or retains a plaintext password/TOTP secret.
export class MfaChallenges {
  private pending = new Map<
    string,
    { user: string; binding: string; expires: number; attempts: number }
  >();
  constructor(private now = () => Date.now()) {}
  private binding(user: UserRow) {
    return digest(
      [user.session_version, user.password_hash, user.totp_secret].join(":"),
    );
  }
  issue(user: UserRow) {
    for (const [key, value] of this.pending)
      if (value.expires <= this.now()) this.pending.delete(key);
    if (this.pending.size >= 1000) return null;
    const raw = token();
    this.pending.set(digest(raw), {
      user: user.id,
      binding: this.binding(user),
      expires: this.now() + 5 * 60_000,
      attempts: 0,
    });
    return raw;
  }
  attempt(
    raw: string | undefined,
    lookup: (id: string) => UserRow | undefined,
  ) {
    const key = digest(raw || ""),
      value = this.pending.get(key);
    if (!value) return null;
    const user = lookup(value.user);
    if (
      value.expires <= this.now() ||
      value.attempts >= 6 ||
      !user ||
      user.disabled ||
      user.invitation_pending ||
      !user.totp_secret ||
      value.binding !== this.binding(user)
    ) {
      this.pending.delete(key);
      return null;
    }
    value.attempts++;
    return user;
  }
  remove(raw: string | undefined) {
    this.pending.delete(digest(raw || ""));
  }
  clear() {
    this.pending.clear();
  }
}
