/**
 * `order_id` in CS03_07 / DB Design — UUID string (RFC 4122), column `orders.order_id`.
 * Route params may be encoded or use 32-char hex; normalize before Prisma lookup.
 */

const UUID_32 = /^[0-9a-f]{32}$/i;
const UUID_DASHED =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Decode, trim, lowercase, and insert hyphens for 32-char hex UUIDs. */
export function canonicalOrderIdFromRouteParam(raw: string): string {
  const decoded = decodeURIComponent(raw).trim().toLowerCase();
  const compact = decoded.replace(/-/g, "");
  if (UUID_32.test(compact)) {
    return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
  }
  return decoded;
}

export function isCanonicalOrderUuid(s: string): boolean {
  return UUID_DASHED.test(s);
}

/**
 * Values to try against `orders.order_id` (UUID string): dashed / compact / case variants
 * for MySQL 8 `CHAR(36)` / `VARCHAR` and tooling that uppercases UUIDs.
 */
export function orderIdLookupVariants(canonical: string): string[] {
  const compact = canonical.replace(/-/g, "");
  const upper = canonical.toUpperCase();
  const compactUpper = upper.replace(/-/g, "");
  return Array.from(new Set([canonical, compact, upper, compactUpper]));
}
