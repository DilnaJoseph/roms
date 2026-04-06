import { NextRequest, NextResponse } from "next/server";
import { authorizeStaffRequest } from "@/lib/auth/authorize-staff-request";
import { emitOrderStatusUpdate } from "@/lib/server/emit-status-update";
import {
  canonicalOrderIdFromRouteParam,
  isCanonicalOrderUuid,
} from "@/lib/server/order-id";
import { completeStaffOrderService } from "@/lib/server/order-service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orderId: string }> };

/** U7 — PATCH: mark order completed when kitchen status is `ready`. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await authorizeStaffRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { orderId: rawOrderId } = await context.params;
  if (!rawOrderId?.trim()) {
    return NextResponse.json({ error: "Missing order id." }, { status: 400 });
  }

  const canonical = canonicalOrderIdFromRouteParam(rawOrderId);
  if (!isCanonicalOrderUuid(canonical)) {
    return NextResponse.json(
      {
        error:
          "Invalid order_id: expected a UUID (orders.order_id).",
      },
      { status: 400 },
    );
  }

  const result = await completeStaffOrderService(rawOrderId);
  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    return NextResponse.json(
      {
        error: `U7: Order must be "ready" before marking completed. Current: "${result.currentStatus}".`,
        currentStatus: result.currentStatus,
      },
      { status: 409 },
    );
  }

  emitOrderStatusUpdate(result.order);

  return NextResponse.json({ order: result.order });
}
