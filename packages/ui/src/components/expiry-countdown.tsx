"use client";
import { useEffect, useState } from "react";
import Counter from "./react-bits/Counter";
import { remainingSeconds, expiryParts } from "../lib/expiry";
export function useExpiry(expiresAt?: string) {
  const [seconds, setSeconds] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt) {
      setSeconds(null);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      clearTimeout(timer);
      const left = remainingSeconds(expiresAt);
      setSeconds(left);
      if (left !== null && left > 0 && !document.hidden)
        timer = setTimeout(tick, 1000);
    };
    tick();
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [expiresAt]);
  return seconds;
}
export function ExpiryCountdown({
  expiresAt,
  seconds,
}: {
  expiresAt: string;
  seconds: number | null;
}) {
  if (seconds === null) return <p>Expiry time unavailable</p>;
  return (
    <div className="expiry-status" aria-live="off">
      <span className="expiry-caption">TIME REMAINING</span>
      <div className="expiry-countdown" aria-hidden="true">
        {expiryParts(seconds).map((value, i) => (
          <div className="expiry-unit" key={i} data-value={value}>
            <Counter
              value={value}
              minDigits={2}
              format={{ useGrouping: false }}
              fontSize={28}
              fontWeight={600}
              padding={0}
              gap={0}
              intro={false}
              motionBlur={false}
              duration={0.4}
            />
            <span>{["DAYS", "HOURS", "MIN", "SEC"][i]}</span>
          </div>
        ))}
      </div>
      <time className="sr-only" dateTime={expiresAt}>
        Transfer expires{" "}
        {new Date(expiresAt).toLocaleString(undefined, {
          dateStyle: "full",
          timeStyle: "long",
        })}
      </time>
    </div>
  );
}
