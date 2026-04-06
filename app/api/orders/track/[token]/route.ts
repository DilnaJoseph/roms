import { NextResponse } from "next/server";
import { findOrderByTrackingTokenService } from "@/lib/server/order-service";

export const runtime = "nodejs";

const TOKEN_RE = /^[a-f0-9]{64}$/i;

type RouteContext = { params: Promise<{ token: string }> };

/** U2 / S5 — public tracking by opaque token only. */
export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  if (!token || !TOKEN_RE.test(token)) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const order = await findOrderByTrackingTokenService(token);
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  return NextResponse.json({ order });
}
