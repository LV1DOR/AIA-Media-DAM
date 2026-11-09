"use client";
import { useRef, useState } from "react";
import { post } from "../lib/api";
export function AccountCreation({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [invitation, setInvitation] = useState<{
      invitationUrl: string;
      expiresAt: string;
      user: { name: string };
    } | null>(null),
    [copied, setCopied] = useState(false);
  const pending = useRef(false);
  return (
    <section className="creation-scene">
      <div className="creation-card">
        {invitation ? (
          <>
            <span className="section-label">READY TO SHARE</span>
            <h2>Invitation created</h2>
            <p>
              Send this private link to {invitation.user.name}. They will choose
              a password and set up their authenticator.
            </p>
            <label>
              Invitation link
              <input
                readOnly
                value={invitation.invitationUrl}
                onFocus={(e) => e.target.select()}
              />
            </label>
            <p className="helper">
              Single use. Expires{" "}
              {new Date(invitation.expiresAt).toLocaleString()}. Creating a
              replacement invalidates the previous link.
            </p>
            <button
              className="button primary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(invitation.invitationUrl);
                  setCopied(true);
                } catch {
                  setError("Select and copy the invitation link above.");
                }
              }}
            >
              {copied ? "Copied" : "Copy invitation link"}
            </button>
            <button className="text-button" onClick={onDone}>
              Done
            </button>
          </>
        ) : (
          <>
            <span className="section-label">GROW YOUR TEAM</span>
            <h2>Invite a staff member</h2>
            <p>
              They set their own password and authenticator before gaining
              access.
            </p>
            <form
              className="new-user-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (pending.current) return;
                pending.current = true;
                setBusy(true);
                setError("");
                const form = e.currentTarget,
                  f = new FormData(form);
                try {
                  const result = await post("/admin/users", {
                    name: f.get("name"),
                    username: f.get("username"),
                    role: f.get("role"),
                    libraryAccess: f.get("library") === "on",
                  });
                  form.reset();
                  setInvitation(result);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  pending.current = false;
                  setBusy(false);
                }
              }}
            >
              <div className="form-grid">
                <label>
                  Full name
                  <input name="name" required maxLength={80} autoFocus />
                </label>
                <label>
                  Username
                  <input
                    name="username"
                    required
                    pattern="[a-zA-Z0-9._\-]{3,40}"
                    minLength={3}
                    maxLength={40}
                    autoComplete="off"
                  />
                </label>
                <label>
                  Role
                  <select name="role">
                    <option value="marketer">Marketing user</option>
                    <option value="reviewer">Media editor</option>
                    <option value="admin">Administrator</option>
                  </select>
                </label>
              </div>
              <label className="check-label">
                <input type="checkbox" name="library" defaultChecked />
                Create corresponding library access
              </label>
              <button className="button primary" disabled={busy}>
                {busy ? "Creating invitation…" : "Create invitation"}
              </button>
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={onDone}
              >
                Cancel
              </button>
            </form>
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
