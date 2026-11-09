"use client";

import { useSyncExternalStore } from "react";

const key = "aia-motion";
const changed = "aia-motion-change";
let temporaryChoice: string | undefined;
export function motionPreference() {
  try {
    const choice = localStorage.getItem(key);
    if (choice === "full" || choice === "reduced") return choice;
  } catch {
    if (temporaryChoice) return temporaryChoice;
  }
  return matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "reduced"
    : "full";
}
export function subscribeMotionPreference(listener: () => void) {
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", listener);
  window.addEventListener(changed, listener);
  window.addEventListener("storage", listener);
  return () => {
    media.removeEventListener("change", listener);
    window.removeEventListener(changed, listener);
    window.removeEventListener("storage", listener);
  };
}
export function useMotionPreference() {
  return (
    useSyncExternalStore(
      subscribeMotionPreference,
      motionPreference,
      () => "reduced",
    ) === "reduced"
  );
}
export function setReducedMotion(reduced: boolean) {
  temporaryChoice = reduced ? "reduced" : "full";
  try {
    localStorage.setItem(key, temporaryChoice);
  } catch {}
  window.dispatchEvent(new Event(changed));
}
