import type { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/get-session-from-request";

export type StaffRequestAuth =
  | { ok: true }
  | { ok: false; status: 401 | 403; error: string };

/** U7 — front-of-house APIs: JWT with `staff` role (cookie or Authorization Bearer). */
export async function authorizeStaffRequest(
  request: NextRequest,
): Promise<StaffRequestAuth> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return {
      ok: false,
      status: 401,
      error:
        "Authentication required. Sign in as staff or send Authorization: Bearer <JWT>.",
    };
  }
  if (session.role !== "staff") {
    return {
      ok: false,
      status: 403,
      error: "Staff role required.",
    };
  }
  return { ok: true };
}
