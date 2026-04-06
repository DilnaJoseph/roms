import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { requireJwtSecretKey } from "./env";
import type { UserRole } from "./roles";
import { isUserRole } from "./roles";

export type SessionClaims = {
  sub: string;
  email: string;
  role: UserRole;
};

/** SRS 2.4: JWT expires after 8 hours. */
const EIGHT_HOURS = "8h" as const;

export async function signSessionToken(claims: SessionClaims): Promise<string> {
  const key = requireJwtSecretKey();
  return new SignJWT({
    email: claims.email,
    role: claims.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(EIGHT_HOURS)
    .sign(key);
}

export async function verifySessionToken(
  token: string,
): Promise<SessionClaims & Pick<JWTPayload, "exp" | "iat">> {
  const key = requireJwtSecretKey();
  const { payload } = await jwtVerify(token, key);
  const sub = payload.sub;
  const email = typeof payload.email === "string" ? payload.email : "";
  const role = payload.role;
  if (!sub || !email || !isUserRole(role)) {
    throw new Error("Invalid token payload");
  }
  return {
    sub,
    email,
    role,
    exp: payload.exp,
    iat: payload.iat,
  };
}
