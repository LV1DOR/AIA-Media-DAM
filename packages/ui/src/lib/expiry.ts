export function remainingSeconds(expiresAt: string, now = Date.now()) {
  const expiry = Date.parse(expiresAt);
  return Number.isFinite(expiry)
    ? Math.max(0, Math.ceil((expiry - now) / 1000))
    : null;
}
export function expiryParts(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  return [
    Math.floor(total / 86400),
    Math.floor(total / 3600) % 24,
    Math.floor(total / 60) % 60,
    total % 60,
  ];
}
