import { canonicalOrderIdFromRouteParam } from "@/lib/server/order-id";
import type { RomOrder } from "@/shared/types/orders";

/** Process-local store until MySQL is connected (SRS ORDERS table). */
const orders: RomOrder[] = [];

export function saveOrder(order: RomOrder): void {
  orders.push(order);
}

export function listOrders(): RomOrder[] {
  return [...orders];
}

export function findOrderByTrackingToken(token: string): RomOrder | undefined {
  return orders.find((o) => o.trackingToken === token);
}

export type AdvanceInMemoryResult =
  | { ok: true; order: RomOrder }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "cannot_advance"; currentStatus: RomOrder["status"] };

export type KitchenAdvanceTargetStatus = "preparing" | "ready";

/**
 * U6: received → preparing → ready. If `targetStatus` is set, that transition must match the button (SRS U6).
 */
export function advanceKitchenOrderInMemory(
  canonicalOrderId: string,
  options?: { targetStatus?: KitchenAdvanceTargetStatus },
): AdvanceInMemoryResult {
  const want = canonicalOrderIdFromRouteParam(canonicalOrderId);
  const i = orders.findIndex(
    (o) => canonicalOrderIdFromRouteParam(o.orderId) === want,
  );
  if (i === -1) return { ok: false, reason: "not_found" };
  const o = orders[i]!;

  const target = options?.targetStatus;
  if (target === "preparing") {
    if (o.status !== "received") {
      return {
        ok: false,
        reason: "cannot_advance",
        currentStatus: o.status,
      };
    }
    const updated = { ...o, status: "preparing" as const };
    orders[i] = updated;
    return { ok: true, order: updated };
  }
  if (target === "ready") {
    if (o.status !== "preparing") {
      return {
        ok: false,
        reason: "cannot_advance",
        currentStatus: o.status,
      };
    }
    const updated = { ...o, status: "ready" as const };
    orders[i] = updated;
    return { ok: true, order: updated };
  }

  if (o.status === "received") {
    const updated = { ...o, status: "preparing" as const };
    orders[i] = updated;
    return { ok: true, order: updated };
  }
  if (o.status === "preparing") {
    const updated = { ...o, status: "ready" as const };
    orders[i] = updated;
    return { ok: true, order: updated };
  }
  return {
    ok: false,
    reason: "cannot_advance",
    currentStatus: o.status,
  };
}

export type CompleteStaffInMemoryResult =
  | { ok: true; order: RomOrder }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "not_ready"; currentStatus: RomOrder["status"] };

/** U7 — front-of-house marks order completed only when kitchen status is `ready`. */
export function completeStaffOrderInMemory(
  canonicalOrderId: string,
): CompleteStaffInMemoryResult {
  const want = canonicalOrderIdFromRouteParam(canonicalOrderId);
  const i = orders.findIndex(
    (o) => canonicalOrderIdFromRouteParam(o.orderId) === want,
  );
  if (i === -1) return { ok: false, reason: "not_found" };
  const o = orders[i]!;
  if (o.status !== "ready") {
    return {
      ok: false,
      reason: "not_ready",
      currentStatus: o.status,
    };
  }
  const updated = { ...o, status: "completed" as const };
  orders[i] = updated;
  return { ok: true, order: updated };
}
