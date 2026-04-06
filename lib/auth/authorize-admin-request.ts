import type { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/get-session-from-request";

export type AdminRequestAuth =
  | { ok: true }
  | { ok: false; status: 401 | 403; error: string };

export async function authorizeAdminRequest(
  request: NextRequest,
): Promise<AdminRequestAuth> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return {
      ok: false,
      status: 401,
      error:
        "Authentication required. Sign in as admin or send Authorization: Bearer <JWT>.",
    };
  }
  if (session.role !== "admin") {
    return {
      ok: false,
      status: 403,
      error: "Admin role required.",
    };
  }
  return { ok: true };
}
