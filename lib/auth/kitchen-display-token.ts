import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { KITCHEN_DISPLAY_TOKEN_HEADER } from "@/lib/auth/kitchen-display-constants";

export function getKitchenDisplayTokenFromRequest(
  request: NextRequest,
): string | null {
  const primary = request.headers.get(KITCHEN_DISPLAY_TOKEN_HEADER);
  const legacy = request.headers.get("x-kitchen-token");
  const t = (primary ?? legacy)?.trim();
  return t || null;
}

export function kitchenDisplaySharedSecretConfigured(): boolean {
  return Boolean(process.env.ROMS_KITCHEN_TOKEN?.trim());
}

export function isValidKitchenDisplayToken(provided: string | null): boolean {
  const expected = process.env.ROMS_KITCHEN_TOKEN?.trim();
  if (!expected || !provided) return false;
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
