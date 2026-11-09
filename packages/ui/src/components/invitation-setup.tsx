"use client";
import { NewPassword } from "./new-password";
import { useEffect, useRef, useState } from "react";
import { PASSWORD_HINT, PASSWORD_PATTERN, passwordInput } from "@aia/contracts";
import { QRCodeSVG } from "qrcode.react";
import CodeSlots, { type CodeSlotsStatus } from "./react-bits/CodeSlots";
import { SignInBackground } from "./sign-in-background";
import { AccountSuccess } from "./account-success";
import { api, post, ApiError } from "../lib/api";
function InvitationFlow() {
  const [person, setPerson] = useState<{
      name: string;
      username: string;
    } | null>(null),
    [setup, setSetup] = useState<{
      uri: string;
      secret: string;
      expiresAt: string;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [photo, setPhoto] = useState<File | null>(null),
    [done, setDone] = useState(false),
    [code, setCode] = useState(""),
    [status, setStatus] = useState<CodeSlotsStatus>("idle"),
    [inactive, setInactive] = useState(false);
  const token = useRef(""),
    request = useRef<Promise<any> | null>(null),
    pending = useRef(false),
    alive = useRef(true),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    alive.current = true;
    if (!request.current) {
      token.current = window.location.hash.slice(1);
      window.history.replaceState(null, "", window.location.pathname);
      request.current = post("/auth/invitation/read", { token: token.current });
    }
    request.current
      .then((value) => {
        if (alive.current) {
          setPerson(value);
          if (value.setup) setSetup(value.setup);
        }
      })
      .catch((e) => {
        if (alive.current) {
          setInactive(true);
          setError(
            e instanceof ApiError
              ? e.message
              : "Unable to open the invitation. Check your connection and reopen your original link.",
          );
        }
      });
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    if (!setup) return;
    const id = setTimeout(
      () => setInactive(true),
      Math.max(0, Date.parse(setup.expiresAt) - Date.now()),
    );
    return () => clearTimeout(id);
  }, [setup]);
  async function verify(value: string) {
    if (pending.current || inactive || !/^\d{6}$/.test(value)) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setStatus("idle");
    try {
      await post("/auth/invitation/complete", { code: value });
      if (!alive.current) return;
      setStatus("success");
      timer.current = setTimeout(() => {
        setSetup(null);
        setDone(true);
      }, 550);
    } catch (e) {
      if (!alive.current) return;
      setStatus("error");
      setError(
        e instanceof ApiError
          ? e.message
          : "Connection interrupted. Try the code again.",
      );
      if (e instanceof ApiError && e.status === 410) setInactive(true);
      timer.current = setTimeout(() => {
        setCode("");
        setStatus("idle");
        pending.current = false;
        setBusy(false);
      }, 450);
    }
  }
  return (
    <main className="join-page">
      <SignInBackground />
      <div className={"join-card" + (done ? " is-success" : "")}>
        <img
          className="join-logo"
          src="/aia-logo.png"
          alt="Autódromo Internacional do Algarve"
        />
        {done && person ? (
          <AccountSuccess
            name={person.name}
            photo={photo}
            onContinue={() => window.location.assign("/")}
          />
        ) : inactive ? (
          <>
            <h1>This invitation is inactive</h1>
            <p role="alert">
              {error ||
                "Setup has expired. Ask your administrator for a new invitation link."}
            </p>
            <a className="button secondary" href="/">
              Return to sign in
            </a>
          </>
        ) : !person ? (
          <p role="status">Opening your invitation…</p>
        ) : setup ? (
          <>
            <span className="section-label">STEP 2 OF 2</span>
            <h1>Set up your authenticator</h1>
            <p>
              Scan this QR code in your authenticator app, then enter its
              six-digit code.
            </p>
            <div className="enrol-qr">
              <QRCodeSVG value={setup.uri} size={176} />
            </div>
            <details>
              <summary>Enter a setup key instead</summary>
              <code className="setup-key">{setup.secret}</code>
              <p className="helper">
                Account: {person.username} · Time-based · Six digits
              </p>
            </details>
            <CodeSlots
              value={code}
              length={6}
              status={status}
              onChange={setCode}
              onComplete={verify}
              autoFocus
              disabled={busy || inactive}
              slotSize={42}
              gap={7}
              accentColor="#3f3f46"
              inkColor="#fff"
              slotColor="#303034"
              digitColor="#ffffff"
            />
            {busy && (
              <p role="status">
                {status === "success" ? "Account ready" : "Verifying…"}
              </p>
            )}
            <p className="helper">
              Keep access to your authenticator. Contact your AIA administrator
              if you later lose it.
            </p>
          </>
        ) : (
          <>
            <span className="section-label">STEP 1 OF 2</span>
            <h1>Welcome, {person.name}</h1>
            <p>
              Create your password for <strong>{person.username}</strong>. Next,
              secure your account with an authenticator.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (pending.current) return;
                const form = e.currentTarget,
                  f = new FormData(form);
                if (f.get("password") !== f.get("confirm")) {
                  setError("The passwords do not match.");
                  return;
                }
                if (!photo) {
                  setError("A profile photo is required.");
                  return;
                }
                const validated = passwordInput.safeParse(f.get("password"));
                if (!validated.success) {
                  setError(PASSWORD_HINT);
                  return;
                }
                pending.current = true;
                setBusy(true);
                setError("");
                try {
                  const upload = new FormData();
                  upload.append("photo", photo);
                  await api("/auth/invitation/photo", {
                    method: "POST",
                    headers: { "X-AIA-Invitation": token.current },
                    body: upload,
                  });
                  const result = await post("/auth/invitation/start", {
                    token: token.current,
                    password: f.get("password"),
                  });
                  form.reset();
                  token.current = "";
                  setSetup(result);
                } catch (e) {
                  setError(
                    e instanceof ApiError
                      ? e.message
                      : "Connection interrupted. Try again.",
                  );
                  if (e instanceof ApiError && e.status === 410)
                    setInactive(true);
                } finally {
                  pending.current = false;
                  setBusy(false);
                }
              }}
            >
              <NewPassword
                label="Choose a password"
                name="password"
                required
                autoFocus
              />
              <label>
                Confirm password
                <input
                  name="confirm"
                  type="password"
                  required
                  minLength={8}
                  pattern={PASSWORD_PATTERN}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </label>
              <label>
                Profile photo
                <input
                  name="photo"
                  aria-label="Profile photo"
                  type="file"
                  required
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (
                      file &&
                      (!["image/jpeg", "image/png", "image/webp"].includes(
                        file.type,
                      ) ||
                        file.size > 5 * 1024 ** 2)
                    ) {
                      setError("Choose a JPEG, PNG or WebP photo up to 5 MB.");
                      e.target.value = "";
                      setPhoto(null);
                    } else {
                      setPhoto(file);
                      setError("");
                    }
                  }}
                />
                <small>
                  JPEG, PNG or WebP, up to 5 MB. Saved privately to your profile
                  and used for your welcome badge.
                </small>
              </label>
              <button className="button primary full" disabled={busy}>
                {busy
                  ? "Preparing authenticator…"
                  : "Continue to authenticator"}
              </button>
            </form>
          </>
        )}
        {!done && error && !inactive && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}

export function InvitationSetup() {
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    const changed = () => setEpoch((value) => value + 1);
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  return <InvitationFlow key={epoch} />;
}
