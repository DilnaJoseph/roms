/**
 * JWT signing/verification secret (HS256).
 * Must be set in production; minimum length reduces weak-secret risk.
 */
export function getJwtSecretKey(): Uint8Array | null {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) return null;
  return new TextEncoder().encode(s);
}

export function requireJwtSecretKey(): Uint8Array {
  const key = getJwtSecretKey();
  if (!key) {
    throw new Error(
      "JWT_SECRET is missing or shorter than 32 characters. Set it in .env.local.",
    );
  }
  return key;
}
