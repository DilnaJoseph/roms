import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import type { OrderStatus } from "@prisma/client";

export type StatusBreakdown = Record<
  "received" | "preparing" | "ready" | "completed",
  number
>;

export type AdminRecentOrderRow = {
  orderId: string;
  trackingToken: string;
  orderTotal: number;
  orderStatus: OrderStatus;
  createdAt: string;
  /** Present when `table_number` exists on Order in DB; otherwise null (UI shows —). */
  tableNumber: number | null;
};

export type AdminDashboardPayload = {
  kpis: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number | null;
    activeOrders: number;
  };
  statusBreakdown: StatusBreakdown;
  recentOrders: AdminRecentOrderRow[];
};

const EMPTY_BREAKDOWN: StatusBreakdown = {
  received: 0,
  preparing: 0,
  ready: 0,
  completed: 0,
};

export function getEmptyAdminDashboard(): AdminDashboardPayload {
  return {
    kpis: {
      totalRevenue: 0,
      totalOrders: 0,
      averageOrderValue: null,
      activeOrders: 0,
    },
    statusBreakdown: { ...EMPTY_BREAKDOWN },
    recentOrders: [],
  };
}

function breakdownFromGroup(
  rows: { orderStatus: OrderStatus; _count: { orderId: number } }[],
): StatusBreakdown {
  const b = { ...EMPTY_BREAKDOWN };
  for (const r of rows) {
    b[r.orderStatus] = r._count.orderId;
  }
  return b;
}

/**
 * Admin analytics — MySQL via Prisma. Uses `order_total` (DD column; SRS may call it total_price).
 */
export async function getAdminDashboardData(): Promise<AdminDashboardPayload> {
  if (!isDatabaseConfigured()) {
    return {
      kpis: {
        totalRevenue: 0,
        totalOrders: 0,
        averageOrderValue: null,
        activeOrders: 0,
      },
      statusBreakdown: { ...EMPTY_BREAKDOWN },
      recentOrders: [],
    };
  }

  const [aggregate, statusGroups, recentRaw, activeOrders] = await Promise.all([
    prisma.order.aggregate({
      _sum: { orderTotal: true },
      _count: { orderId: true },
    }),
    prisma.order.groupBy({
      by: ["orderStatus"],
      _count: { orderId: true },
    }),
    prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        orderId: true,
        trackingToken: true,
        orderTotal: true,
        orderStatus: true,
        createdAt: true,
      },
    }),
    prisma.order.count({
      where: { orderStatus: { not: "completed" } },
    }),
  ]);

  const totalRevenue = Number(aggregate._sum.orderTotal?.toString() ?? 0);
  const totalOrders = aggregate._count.orderId;
  const averageOrderValue =
    totalOrders > 0 ? totalRevenue / totalOrders : null;

  const recentOrders: AdminRecentOrderRow[] = recentRaw.map((o) => ({
    orderId: o.orderId,
    trackingToken: o.trackingToken,
    orderTotal: Number(o.orderTotal.toString()),
    orderStatus: o.orderStatus,
    createdAt: o.createdAt.toISOString(),
    // When your DD adds `table_number` to `orders`, extend Prisma `Order` + select here.
    tableNumber: null,
  }));

  return {
    kpis: {
      totalRevenue,
      totalOrders,
      averageOrderValue,
      activeOrders,
    },
    statusBreakdown: breakdownFromGroup(statusGroups),
    recentOrders,
  };
}
