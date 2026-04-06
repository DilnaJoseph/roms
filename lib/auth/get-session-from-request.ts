import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "./constants";
import { getJwtSecretKey } from "./env";
import type { SessionClaims } from "./jwt";
import { isUserRole } from "./roles";

function getBearerToken(request: NextRequest): string | null {
  const h = request.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  const t = h.slice(7).trim();
  return t || null;
}

/**
 * Kitchen PATCH and other APIs: JWT from httpOnly cookie (browser) or
 * `Authorization: Bearer <token>` (explicit header, SRS S3).
 */
export async function getSessionFromRequest(
  request: NextRequest,
): Promise<SessionClaims | null> {
  const raw =
    request.cookies.get(SESSION_COOKIE_NAME)?.value ?? getBearerToken(request);
  if (!raw) return null;
  const key = getJwtSecretKey();
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(raw, key);
    const sub = payload.sub;
    const email = typeof payload.email === "string" ? payload.email : "";
    const role = payload.role;
    if (!sub || !email || !isUserRole(role)) return null;
    return { sub, email, role };
  } catch {
    return null;
  }
}
