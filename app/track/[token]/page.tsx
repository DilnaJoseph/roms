"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { getSocketBaseUrl } from "@/lib/client/socket-url";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/shared/constants";
import type { RomOrder } from "@/shared/types/orders";

type StatusUpdatePayload = {
  orderId: string;
  trackingToken: string;
  status: OrderStatus;
  order: RomOrder;
};

const POLL_MS = 10_000;

export default function TrackOrderPage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";

  const [order, setOrder] = useState<RomOrder | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hadConnectedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchOrder = useCallback(async () => {
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      setLoadError("Invalid tracking link.");
      setOrder(null);
      return;
    }
    const res = await fetch(`/api/orders/track/${token}`, {
      cache: "no-store",
    });
    const data = (await res.json()) as { order?: RomOrder; error?: string };
    if (!res.ok) {
      setLoadError(data.error ?? "Order not found.");
      setOrder(null);
      return;
    }
    setLoadError(null);
    if (data.order) setOrder(data.order);
  }, [token]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      void fetchOrder();
    }, POLL_MS);
  }, [fetchOrder]);

  useEffect(() => {
    void fetchOrder();
  }, [fetchOrder]);

  useEffect(() => {
    if (!/^[a-f0-9]{64}$/i.test(token)) return;

    const socket = io(getSocketBaseUrl(), {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
    });

    const onStatus = (payload: StatusUpdatePayload) => {
      if (payload.trackingToken !== token) return;
      setOrder(payload.order);
    };

    const onConnect = () => {
      hadConnectedRef.current = true;
      setReconnecting(false);
      stopPolling();
      void fetchOrder();
      socket.emit("join_tracking", token);
    };

    const onDisconnect = () => {
      if (hadConnectedRef.current) {
        setReconnecting(true);
        startPolling();
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("status_update", onStatus);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("status_update", onStatus);
      socket.disconnect();
      stopPolling();
    };
  }, [token, fetchOrder, startPolling, stopPolling]);

  if (!token) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-zinc-600">
        Missing tracking token.
      </div>
    );
  }

  if (loadError && !order) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-lg font-medium text-zinc-900">{loadError}</p>
        <Link href="/" className="mt-4 inline-block text-amber-700 hover:underline">
          ← Back to menu
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-zinc-500">
        Loading order…
      </div>
    );
  }

  const statusLabel = ORDER_STATUS_LABELS[order.status];

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <Link
          href="/"
          className="text-sm font-medium text-amber-800 hover:text-amber-900"
        >
          ← Menu
        </Link>

        {reconnecting && (
          <p
            className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            role="status"
          >
            Reconnecting… live updates paused. Refreshing every {POLL_MS / 1000}{" "}
            seconds (SRS U5 fallback).
          </p>
        )}

        <h1 className="mt-6 text-2xl font-bold text-zinc-900">
          Order status
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Live updates via WebSocket when connected (SRS U2, U6).
        </p>

        <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Status
          </p>
          <p className="mt-2 text-2xl font-bold text-zinc-900">{statusLabel}</p>

          <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Items
          </p>
          <ul className="mt-2 space-y-2">
            {order.lines.map((line) => (
              <li
                key={`${order.orderId}-${line.menuItemId}`}
                className="flex justify-between text-sm text-zinc-700"
              >
                <span>{line.name}</span>
                <span className="tabular-nums">×{line.quantity}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
