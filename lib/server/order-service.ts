import { Prisma, type OrderStatus as PrismaOrderStatus } from "@prisma/client";
import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import {
  canonicalOrderIdFromRouteParam,
  orderIdLookupVariants,
} from "@/lib/server/order-id";
import type { OrderLineSnapshot } from "@/shared/types/orders";
import type { RomOrder } from "@/shared/types/orders";
import type { KitchenAdvanceTargetStatus } from "@/lib/server/orders-store";
import {
  advanceKitchenOrderInMemory,
  completeStaffOrderInMemory,
  findOrderByTrackingToken as findInMemory,
  listOrders as listInMemory,
  saveOrder as saveInMemory,
} from "@/lib/server/orders-store";

export type { KitchenAdvanceTargetStatus };

function prismaOrderToRom(row: {
  orderId: string;
  trackingToken: string;
  orderStatus: PrismaOrderStatus;
  orderTotal: { toString(): string };
  createdAt: Date;
  items: {
    menuItemId: string;
    name: string;
    quantity: number;
    unitPrice: { toString(): string };
  }[];
}): RomOrder {
  return {
    orderId: row.orderId,
    trackingToken: row.trackingToken,
    status: row.orderStatus as RomOrder["status"],
    createdAt: row.createdAt.getTime(),
    orderTotal: Number(row.orderTotal.toString()),
    lines: row.items.map((i) => ({
      menuItemId: i.menuItemId,
      name: i.name,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice.toString()),
    })),
  };
}

export async function createOrderService(
  lines: OrderLineSnapshot[],
  orderTotal: number,
  orderId: string,
  trackingToken: string,
): Promise<RomOrder> {
  const order: RomOrder = {
    orderId,
    trackingToken,
    status: "received",
    createdAt: Date.now(),
    lines,
    orderTotal,
  };

  if (!isDatabaseConfigured()) {
    saveInMemory(order);
    return order;
  }

  /** Appendix A: `order_id` (UUID), `tracking_token` (64 hex), line items in `order_items`. */
  const created = await prisma.$transaction(async (tx) => {
    await tx.order.create({
      data: {
        orderId,
        trackingToken,
        orderStatus: "received",
        orderTotal,
        items: {
          create: lines.map((l) => ({
            menuItemId: l.menuItemId,
            name: l.name,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          })),
        },
      },
    });
    const full = await tx.order.findUniqueOrThrow({
      where: { orderId },
      include: { items: true },
    });
    return full;
  });

  return prismaOrderToRom(created);
}

export async function listOrdersService(): Promise<RomOrder[]> {
  if (!isDatabaseConfigured()) {
    return listInMemory();
  }

  const rows = await prisma.order.findMany({
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(prismaOrderToRom);
}

export async function findOrderByTrackingTokenService(
  token: string,
): Promise<RomOrder | undefined> {
  if (!isDatabaseConfigured()) {
    return findInMemory(token);
  }

  const row = await prisma.order.findUnique({
    where: { trackingToken: token },
    include: { items: true },
  });
  return row ? prismaOrderToRom(row) : undefined;
}

export type AdvanceKitchenOrderResult =
  | { ok: true; order: RomOrder }
  | { ok: false; reason: "not_found" }
  | {
      ok: false;
      reason: "cannot_advance";
      currentStatus: RomOrder["status"];
    };

/**
 * U6 — look up by `orders.order_id` (UUID), advance only from `received` or `preparing`.
 * `orderId` should be the raw route segment; it is canonicalized before query.
 */
export async function advanceKitchenOrderService(
  orderIdFromRoute: string,
  options?: { targetStatus?: KitchenAdvanceTargetStatus },
): Promise<AdvanceKitchenOrderResult> {
  const canonical = canonicalOrderIdFromRouteParam(orderIdFromRoute);

  if (!isDatabaseConfigured()) {
    return advanceKitchenOrderInMemory(canonical, options);
  }

  const variants = orderIdLookupVariants(canonical);
  let row = await prisma.order.findFirst({
    where: { orderId: { in: variants } },
  });
  /** MySQL 8 `CHAR(36)` can pad `order_id`; TRIM fallback still resolves UUID PK. */
  if (!row) {
    for (const v of variants) {
      const hit = await prisma.$queryRaw<Array<{ order_id: string }>>(
        Prisma.sql`SELECT order_id FROM orders WHERE TRIM(order_id) = ${v} LIMIT 1`,
      );
      const pk = hit[0]?.order_id;
      if (pk != null && String(pk).length > 0) {
        const id = String(pk);
        row = await prisma.order.findUnique({ where: { orderId: id } });
        if (!row && id.trim() !== id) {
          row = await prisma.order.findUnique({ where: { orderId: id.trim() } });
        }
        if (row) break;
      }
    }
  }
  if (!row) {
    /** POST may have used RAM if DATABASE_URL was not visible to API routes (monorepo / wrong root). */
    const memFallback = advanceKitchenOrderInMemory(canonical, options);
    if (memFallback.ok) {
      console.warn(
        "[ROMS U6] Order was not in MySQL; advanced in-memory only. Fix: set DATABASE_URL in roms/.env.local, run `npx prisma migrate deploy`, restart `npm run dev`, then place orders again so POST and PATCH both use MySQL.",
      );
      return memFallback;
    }
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[ROMS U6] No row in `orders` for order_id (UUID) variants:",
        variants,
      );
    }
    return { ok: false, reason: "not_found" };
  }

  const dbOrderId = row.orderId;
  const target = options?.targetStatus;

  let nextStatus: PrismaOrderStatus | null = null;
  if (target === "preparing") {
    if (row.orderStatus !== "received") {
      return {
        ok: false,
        reason: "cannot_advance",
        currentStatus: row.orderStatus as RomOrder["status"],
      };
    }
    nextStatus = "preparing";
  } else if (target === "ready") {
    if (row.orderStatus !== "preparing") {
      return {
        ok: false,
        reason: "cannot_advance",
        currentStatus: row.orderStatus as RomOrder["status"],
      };
    }
    nextStatus = "ready";
  } else {
    if (row.orderStatus === "received") nextStatus = "preparing";
    else if (row.orderStatus === "preparing") nextStatus = "ready";
  }

  if (!nextStatus) {
    return {
      ok: false,
      reason: "cannot_advance",
      currentStatus: row.orderStatus as RomOrder["status"],
    };
  }

  const updated = await prisma.order.update({
    where: { orderId: dbOrderId },
    data: { orderStatus: nextStatus },
    include: { items: true },
  });
  return { ok: true, order: prismaOrderToRom(updated) };
}

export type CompleteStaffOrderResult =
  | { ok: true; order: RomOrder }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "not_ready"; currentStatus: RomOrder["status"] };

/**
 * U7 — `ready` → `completed` (front-of-house). Resolves `order_id` like kitchen U6.
 */
export async function completeStaffOrderService(
  orderIdFromRoute: string,
): Promise<CompleteStaffOrderResult> {
  const canonical = canonicalOrderIdFromRouteParam(orderIdFromRoute);

  if (!isDatabaseConfigured()) {
    return completeStaffOrderInMemory(canonical);
  }

  const variants = orderIdLookupVariants(canonical);
  let row = await prisma.order.findFirst({
    where: { orderId: { in: variants } },
  });
  if (!row) {
    for (const v of variants) {
      const hit = await prisma.$queryRaw<Array<{ order_id: string }>>(
        Prisma.sql`SELECT order_id FROM orders WHERE TRIM(order_id) = ${v} LIMIT 1`,
      );
      const pk = hit[0]?.order_id;
      if (pk != null && String(pk).length > 0) {
        const id = String(pk);
        row = await prisma.order.findUnique({ where: { orderId: id } });
        if (!row && id.trim() !== id) {
          row = await prisma.order.findUnique({ where: { orderId: id.trim() } });
        }
        if (row) break;
      }
    }
  }
  if (!row) return { ok: false, reason: "not_found" };

  if (row.orderStatus !== "ready") {
    return {
      ok: false,
      reason: "not_ready",
      currentStatus: row.orderStatus as RomOrder["status"],
    };
  }

  const updated = await prisma.order.update({
    where: { orderId: row.orderId },
    data: { orderStatus: "completed" },
    include: { items: true },
  });
  return { ok: true, order: prismaOrderToRom(updated) };
}
