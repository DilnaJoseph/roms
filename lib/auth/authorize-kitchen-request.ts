import type { NextRequest } from "next/server";
import {
  getKitchenDisplayTokenFromRequest,
  isValidKitchenDisplayToken,
  kitchenDisplaySharedSecretConfigured,
} from "@/lib/auth/kitchen-display-token";
import { getSessionFromRequest } from "@/lib/auth/get-session-from-request";

export type KitchenRequestAuth =
  | { ok: true; via: "jwt" }
  | { ok: true; via: "kitchen_display_token" }
  | { ok: false; status: 401 | 403; error: string };

/**
 * U5/U6 — kitchen APIs: staff JWT (`kitchen` role) or optional shared `ROMS_KITCHEN_TOKEN` header.
 */
export async function authorizeKitchenRequest(
  request: NextRequest,
): Promise<KitchenRequestAuth> {
  const sharedOk =
    kitchenDisplaySharedSecretConfigured() &&
    isValidKitchenDisplayToken(getKitchenDisplayTokenFromRequest(request));

  if (sharedOk) {
    return { ok: true, via: "kitchen_display_token" };
  }

  const session = await getSessionFromRequest(request);
  if (!session) {
    return {
      ok: false,
      status: 401,
      error:
        "Authentication required: sign in as kitchen, send Authorization: Bearer <JWT>, or X-ROMS-Kitchen-Token when ROMS_KITCHEN_TOKEN is set (SRS U5).",
    };
  }
  if (session.role !== "kitchen") {
    return {
      ok: false,
      status: 403,
      error: "Kitchen role required.",
    };
  }
  return { ok: true, via: "jwt" };
}
