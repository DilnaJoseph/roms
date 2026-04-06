"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ACCESS_TOKEN_STORAGE_KEY } from "@/lib/auth/constants";
import { KITCHEN_DISPLAY_TOKEN_HEADER } from "@/lib/auth/kitchen-display-constants";
import { getBrowserKitchenDisplayToken } from "@/lib/client/kitchen-display-token";
import type { OrderStatus } from "@/shared/constants";
import type { RomOrder } from "@/shared/types/orders";

/** Fetch failed before a response (offline, DNS, CORS, aborted, etc.). */
export class KitchenStatusNetworkError extends Error {
  constructor(message = "Network request failed", options?: { cause?: unknown }) {
    super(message, options);
    this.name = "KitchenStatusNetworkError";
  }
}

/** HTTP error response from PATCH /api/orders/:id/status — not a transport failure. */
export class KitchenStatusHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "KitchenStatusHttpError";
  }
}

type OrdersContextValue = {
  orders: RomOrder[];
  /** Idempotent append (e.g. POST response + Socket.io) — keyed by `order_id`. */
  appendOrder: (order: RomOrder) => void;
  /** Replace queue from GET /api/orders (U5 polling, Prisma/in-memory snapshot). */
  syncOrdersFromServer: (snapshot: RomOrder[]) => void;
  /** Apply status from Socket.io `status_update` (U6) or keep UI in sync. */
  patchOrderStatus: (orderId: string, status: OrderStatus) => void;
  /** U6 — PATCH with full `order_id` UUID + optional explicit `targetStatus` (received→preparing / preparing→ready). */
  advanceKitchenStatus: (
    orderId: string,
    targetStatus: "preparing" | "ready",
  ) => Promise<void>;
};

const OrdersContext = createContext<OrdersContextValue | null>(null);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<RomOrder[]>([]);

  const appendOrder = useCallback((order: RomOrder) => {
    setOrders((prev) => {
      if (prev.some((o) => o.orderId === order.orderId)) return prev;
      return [...prev, order];
    });
  }, []);

  const syncOrdersFromServer = useCallback((snapshot: RomOrder[]) => {
    setOrders(snapshot);
  }, []);

  const patchOrderStatus = useCallback((orderId: string, status: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.orderId === orderId ? { ...o, status } : o)),
    );
  }, []);

  const advanceKitchenStatus = useCallback(
    async (orderId: string, targetStatus: "preparing" | "ready") => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (typeof window !== "undefined") {
        const bearer = sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
        if (bearer) headers.Authorization = `Bearer ${bearer}`;
        const kitchenToken = getBrowserKitchenDisplayToken();
        if (kitchenToken) {
          headers[KITCHEN_DISPLAY_TOKEN_HEADER] = kitchenToken;
        }
      }

      const pathId = encodeURIComponent(orderId);
      let res: Response;
      try {
        res = await fetch(`/api/orders/${pathId}/status`, {
          method: "PATCH",
          credentials: "include",
          headers,
          body: JSON.stringify({ targetStatus }),
        });
      } catch (e) {
        throw new KitchenStatusNetworkError("Network request failed", {
          cause: e,
        });
      }

      let data: { order?: RomOrder; error?: string };
      try {
        data = (await res.json()) as { order?: RomOrder; error?: string };
      } catch {
        if (!res.ok) {
          throw new KitchenStatusHttpError(
            "Could not update order status.",
            res.status,
          );
        }
        throw new KitchenStatusNetworkError("Invalid response from server.");
      }

      if (!res.ok) {
        throw new KitchenStatusHttpError(
          data.error ?? "Could not update order status.",
          res.status,
        );
      }
      if (data.order) {
        patchOrderStatus(data.order.orderId, data.order.status);
      }
    },
    [patchOrderStatus],
  );

  const value = useMemo(
    () => ({
      orders,
      appendOrder,
      syncOrdersFromServer,
      patchOrderStatus,
      advanceKitchenStatus,
    }),
    [orders, appendOrder, syncOrdersFromServer, patchOrderStatus, advanceKitchenStatus],
  );

  return (
    <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>
  );
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) {
    throw new Error("useOrders must be used within OrdersProvider");
  }
  return ctx;
}
