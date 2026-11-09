"use client";
import { useEffect, useRef, useState } from "react";
import CodeSlots, { type CodeSlotsStatus } from "./react-bits/CodeSlots";
import { post, ApiError } from "../lib/api";
export function MfaChallenge({
  expiresAt,
  onBack,
  onSuccess,
}: {
  expiresAt: string;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState(""),
    [status, setStatus] = useState<CodeSlotsStatus>("idle"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [expired, setExpired] = useState(false);
  const checking = useRef(false),
    alive = useRef(true),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    alive.current = true;
    const timeout = setTimeout(
      () => setExpired(true),
      Math.max(0, Date.parse(expiresAt) - Date.now()),
    );
    return () => {
      alive.current = false;
      clearTimeout(timeout);
      clearTimeout(timer.current);
    };
  }, [expiresAt]);
  async function verify(value: string) {
    if (checking.current || expired || !/^\d{6}$/.test(value)) return;
    checking.current = true;
    setBusy(true);
    setError("");
    setStatus("idle");
    try {
      await post("/auth/verify", { code: value });
      if (!alive.current) return;
      setStatus("success");
      timer.current = setTimeout(onSuccess, 550);
    } catch (e) {
      if (!alive.current) return;
      setStatus("error");
      setError(
        e instanceof ApiError
          ? e.message
          : "Connection interrupted. Try the code again.",
      );
      if (e instanceof ApiError && e.status === 410) setExpired(true);
      timer.current = setTimeout(() => {
        setCode("");
        setStatus("idle");
        checking.current = false;
        setBusy(false);
      }, 450);
    }
  }
  return (
    <div className="mfa-step">
      <span className="section-label">SECURE SIGN-IN</span>
      <h2>Two-factor authentication</h2>
      <p>Enter the six-digit code from your authenticator app.</p>
      <CodeSlots
        value={code}
        length={6}
        status={status}
        onChange={setCode}
        onComplete={verify}
        autoFocus
        disabled={busy || expired}
        slotSize={42}
        gap={7}
        accentColor="#3f3f46"
        inkColor="#fff"
        slotColor="#303034"
        digitColor="#ffffff"
      />
      {busy && status !== "success" && <p role="status">Verifying…</p>}
      {expired ? (
        <p role="alert">
          This sign-in challenge has expired. Return to sign in.
        </p>
      ) : (
        error && (
          <p className="error" role="alert">
            {error}
          </p>
        )
      )}
      <button
        className="text-button"
        disabled={busy && status === "success"}
        onClick={onBack}
      >
        Back to sign in
      </button>
      <p className="helper">
        Lost access to your authenticator? Contact your AIA administrator.
      </p>
    </div>
  );
}
