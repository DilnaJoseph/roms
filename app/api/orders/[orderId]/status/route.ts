import { NextRequest, NextResponse } from "next/server";
import { authorizeKitchenRequest } from "@/lib/auth/authorize-kitchen-request";
import { emitOrderStatusUpdate } from "@/lib/server/emit-status-update";
import {
  canonicalOrderIdFromRouteParam,
  isCanonicalOrderUuid,
} from "@/lib/server/order-id";
import {
  advanceKitchenOrderService,
  type KitchenAdvanceTargetStatus,
} from "@/lib/server/order-service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orderId: string }> };

function parseTargetStatus(
  body: unknown,
): KitchenAdvanceTargetStatus | undefined {
  if (!body || typeof body !== "object") return undefined;
  const v = (body as { targetStatus?: unknown }).targetStatus;
  if (v === "preparing" || v === "ready") return v;
  return undefined;
}

/**
 * U6 — PATCH: full `order_id` (UUID) in path; body may include `{ targetStatus: "preparing" | "ready" }`.
 * U5 — auth: kitchen JWT or `X-ROMS-Kitchen-Token` when `ROMS_KITCHEN_TOKEN` is set.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await authorizeKitchenRequest(request);
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
          "Invalid order_id: expected a UUID (Database Design Document — orders.order_id).",
      },
      { status: 400 },
    );
  }

  let targetStatus: KitchenAdvanceTargetStatus | undefined;
  try {
    const body: unknown = await request.json();
    targetStatus = parseTargetStatus(body);
  } catch {
    targetStatus = undefined;
  }

  const result = await advanceKitchenOrderService(rawOrderId, { targetStatus });
  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json(
        {
          error:
            "Order not found for this order_id (UUID). Check: (1) DATABASE_URL in .env.local matches the MySQL 8 instance used at startup (see server console), (2) run `npx prisma migrate dev` so `orders.order_id` exists, (3) this order was created via POST /api/orders into that same database (not an in-memory-only process).",
        },
        { status: 404 },
      );
    }
    const u6PreparingBlocked =
      targetStatus === "preparing" && result.currentStatus !== "received";
    return NextResponse.json(
      {
        error: u6PreparingBlocked
          ? `U6: Start Preparing requires order_status "received" in MySQL before moving to "preparing". Current: "${result.currentStatus}".`
          : `Kitchen cannot advance from status "${result.currentStatus}". Allowed: received → preparing → ready.`,
        currentStatus: result.currentStatus,
      },
      { status: 409 },
    );
  }

  emitOrderStatusUpdate(result.order);

  return NextResponse.json({ order: result.order });
}
