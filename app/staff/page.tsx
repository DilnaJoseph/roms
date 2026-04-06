"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { ACCESS_TOKEN_STORAGE_KEY } from "@/lib/auth/constants";
import { getSocketBaseUrl } from "@/lib/client/socket-url";
import { ORDER_STATUS_LABELS } from "@/shared/constants";
import type { OrderStatus } from "@/shared/constants";
import type { RomOrder } from "@/shared/types/orders";

function formatOrderDisplayId(orderId: string) {
  return orderId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

type StatusPayload = {
  orderId: string;
  trackingToken: string;
  status: OrderStatus;
  order: RomOrder;
};

const POLL_MS = 10_000;

function mergeOrderSnapshot(prev: RomOrder[], order: RomOrder): RomOrder[] {
  const i = prev.findIndex((o) => o.orderId === order.orderId);
  if (i === -1) return [...prev, order];
  const next = [...prev];
  next[i] = order;
  return next;
}

export default function StaffPage() {
  const [orders, setOrders] = useState<RomOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders", { cache: "no-store" });
      const data = (await res.json()) as { orders?: RomOrder[] };
      if (!res.ok || !Array.isArray(data.orders)) {
        setError("Could not load orders.");
        return;
      }
      setError(null);
      setOrders(data.orders);
    } catch {
      setError("Network error loading orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void fetchOrders();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [fetchOrders]);

  useEffect(() => {
    const socket = io(getSocketBaseUrl(), {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
    });

    const onConnect = () => {
      socket.emit("join_staff");
    };

    const onStatus = (payload: StatusPayload) => {
      setOrders((prev) => mergeOrderSnapshot(prev, payload.order));
    };

    socket.on("connect", onConnect);
    socket.on("status_update", onStatus);
    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("status_update", onStatus);
      socket.disconnect();
    };
  }, []);

  const { readyOrders, kitchenOrders } = useMemo(() => {
    const active = orders.filter((o) => o.status !== "completed");
    const ready = active.filter((o) => o.status === "ready");
    const kitchen = active.filter(
      (o) => o.status === "received" || o.status === "preparing",
    );
    ready.sort((a, b) => a.createdAt - b.createdAt);
    kitchen.sort((a, b) => a.createdAt - b.createdAt);
    return { readyOrders: ready, kitchenOrders: kitchen };
  }, [orders]);

  async function markCompleted(orderId: string) {
    setCompletingId(orderId);
    setError(null);
    const headers: Record<string, string> = {};
    const bearer =
      typeof window !== "undefined"
        ? sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
        : null;
    if (bearer) headers.Authorization = `Bearer ${bearer}`;

    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/complete`,
        {
          method: "PATCH",
          credentials: "include",
          headers,
        },
      );
      const data = (await res.json()) as { order?: RomOrder; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not complete order.");
        return;
      }
      if (data.order) {
        setOrders((prev) => mergeOrderSnapshot(prev, data.order!));
      }
    } catch {
      setError("Network error completing order.");
    } finally {
      setCompletingId(null);
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-4 pb-12">
      {error && (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          role="alert"
        >
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading orders…</p>
      ) : null}

      <section>
        <h2 className="text-base font-semibold text-slate-900">
          Ready for pickup — U7
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Orders the kitchen marked <strong>Ready</strong>. Mark completed when
          the guest picks up.
        </p>
        {readyOrders.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            No orders are ready yet. When the kitchen taps &quot;Mark as
            Ready&quot;, the ticket appears here automatically (live Socket.io or
            refresh every {POLL_MS / 1000}s).
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {readyOrders.map((order) => (
              <li
                key={order.orderId}
                className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Order
                    </p>
                    <p className="font-mono text-lg font-semibold text-slate-900">
                      #{formatOrderDisplayId(order.orderId)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {ORDER_STATUS_LABELS[order.status]}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={completingId === order.orderId}
                      onClick={() => void markCompleted(order.orderId)}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {completingId === order.orderId
                        ? "Saving…"
                        : "Mark completed"}
                    </button>
                  </div>
                </div>
                <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm text-slate-700">
                  {order.lines.map((line) => (
                    <li
                      key={`${order.orderId}-${line.menuItemId}`}
                      className="flex justify-between gap-2"
                    >
                      <span>{line.name}</span>
                      <span className="tabular-nums">×{line.quantity}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-base font-semibold text-slate-900">
          In kitchen — monitor (U7)
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Received / Preparing — for visibility only (kitchen advances status).
        </p>
        {kitchenOrders.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No active kitchen tickets.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {kitchenOrders.map((order) => (
              <li
                key={order.orderId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <span className="font-mono font-medium">
                  #{formatOrderDisplayId(order.orderId)}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-slate-400">
        U8 (flag/issue) can extend this view with a second action per order.
      </p>
    </main>
  );
}
