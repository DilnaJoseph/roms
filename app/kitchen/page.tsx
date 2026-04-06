"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChefHat,
  Contrast,
  Timer,
  Volume2,
  VolumeX,
} from "lucide-react";
import { io } from "socket.io-client";
import { SignOutButton } from "@/components/auth/SignOutButton";
import {
  KitchenStatusHttpError,
  KitchenStatusNetworkError,
  useOrders,
} from "@/contexts/orders-context";
import { getBrowserKitchenDisplayToken } from "@/lib/client/kitchen-display-token";
import { getSocketBaseUrl } from "@/lib/client/socket-url";
import {
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from "@/shared/constants";
import type { RomOrder } from "@/shared/types/orders";

/** Short public display for `order_id` UUID — kitchen wall legibility. */
function formatOrderDisplayId(orderId: string) {
  const compact = orderId.replace(/-/g, "");
  return compact.slice(0, 8).toUpperCase();
}

function playNewOrderChime() {
  const AC =
    typeof window !== "undefined" &&
    (window.AudioContext ||
      (
        window as unknown as {
          webkitAudioContext: typeof AudioContext;
        }
      ).webkitAudioContext);
  if (!AC) return;
  const ctx = new AC();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.35);
}

function useElapsedLabel(createdAt: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const sec = Math.max(0, Math.floor((now - createdAt) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}h ${mm}m`;
  }
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

function statusCardShell(
  status: OrderStatus,
  highContrast: boolean,
): { bar: string; card: string; badge: string } {
  if (highContrast) {
    switch (status) {
      case "received":
        return {
          bar: "bg-blue-400",
          card: "border-2 border-blue-400 bg-black text-white",
          badge: "bg-blue-600 text-white border-2 border-white",
        };
      case "preparing":
        return {
          bar: "bg-yellow-300",
          card: "border-2 border-yellow-300 bg-black text-white",
          badge: "bg-yellow-400 text-black border-2 border-white font-black",
        };
      case "ready":
        return {
          bar: "bg-lime-400",
          card: "border-2 border-lime-400 bg-black text-white",
          badge: "bg-lime-500 text-black border-2 border-white font-black",
        };
      default:
        return {
          bar: "bg-zinc-500",
          card: "border-2 border-white bg-black text-white",
          badge: "bg-zinc-700 text-white",
        };
    }
  }
  switch (status) {
    case "received":
      return {
        bar: "bg-blue-500",
        card: "border border-blue-500/40 bg-zinc-900/90 text-zinc-100",
        badge: "bg-blue-600/90 text-white",
      };
    case "preparing":
      return {
        bar: "bg-amber-400",
        card: "border border-amber-400/40 bg-zinc-900/90 text-zinc-100",
        badge: "bg-amber-500 text-zinc-900 font-semibold",
      };
    case "ready":
      return {
        bar: "bg-emerald-500",
        card: "border border-emerald-500/40 bg-zinc-900/90 text-zinc-100",
        badge: "bg-emerald-600 text-white",
      };
    default:
      return {
        bar: "bg-zinc-600",
        card: "border border-zinc-600 bg-zinc-900 text-zinc-200",
        badge: "bg-zinc-700 text-zinc-200",
      };
  }
}

type KitchenAdvanceError =
  | { kind: "network" }
  | { kind: "http"; message: string };

type KitchenAdvanceTarget = "preparing" | "ready";

function OrderCard({
  order,
  highContrast,
  pending,
  advanceError,
  onAdvance,
}: {
  order: RomOrder;
  highContrast: boolean;
  pending: boolean;
  advanceError: KitchenAdvanceError | null;
  onAdvance: (
    orderId: string,
    targetStatus: KitchenAdvanceTarget,
  ) => void | Promise<void>;
}) {
  const elapsed = useElapsedLabel(order.createdAt);
  const shell = statusCardShell(order.status, highContrast);

  const advanceLabel =
    order.status === "received"
      ? "Start Preparing"
      : order.status === "preparing"
        ? "Mark as Ready"
        : null;

  const advanceTarget: KitchenAdvanceTarget | null =
    order.status === "received"
      ? "preparing"
      : order.status === "preparing"
        ? "ready"
        : null;

  return (
    <article
      className={`relative flex min-h-[280px] flex-col overflow-hidden rounded-2xl shadow-lg ${shell.card}`}
    >
      <div className={`h-1.5 w-full ${shell.bar}`} aria-hidden />
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p
              className={`text-xs font-semibold uppercase tracking-wider ${highContrast ? "text-zinc-300" : "text-zinc-400"}`}
            >
              Order ID
            </p>
            <p
              className="font-mono text-xl font-bold tracking-tight sm:text-2xl"
              translate="no"
            >
              #{formatOrderDisplayId(order.orderId)}
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${shell.badge}`}
          >
            {ORDER_STATUS_LABELS[order.status]}
          </span>
        </div>

        <div
          className={`mt-4 flex items-center gap-2 text-sm ${highContrast ? "text-zinc-200" : "text-zinc-400"}`}
        >
          <Timer className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            Elapsed: <strong className="tabular-nums">{elapsed}</strong>
          </span>
        </div>

        <div className="mt-4 min-h-0 flex-1">
          <p
            className={`text-xs font-semibold uppercase tracking-wider ${highContrast ? "text-zinc-300" : "text-zinc-500"}`}
          >
            Items
          </p>
          <ul className="mt-2 space-y-2">
            {order.lines.map((line) => (
              <li
                key={`${order.orderId}-${line.menuItemId}`}
                className={`flex justify-between gap-3 text-sm ${highContrast ? "text-white" : "text-zinc-200"}`}
              >
                <span className="min-w-0 flex-1 leading-snug">{line.name}</span>
                <span className="shrink-0 font-semibold tabular-nums">
                  ×{line.quantity}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {advanceError && (
          <p
            className="mt-3 rounded-lg border border-red-500/50 bg-red-950/40 px-2 py-1.5 text-center text-xs font-medium text-red-200"
            role="alert"
          >
            {advanceError.kind === "network"
              ? "Update failed — try again (SRS U6)."
              : advanceError.message}
          </p>
        )}

        <div className="mt-4">
          {advanceLabel ? (
            <button
              type="button"
              disabled={pending}
              onClick={(e) => {
                e.stopPropagation();
                if (advanceTarget) {
                  void onAdvance(order.orderId, advanceTarget);
                }
              }}
              className={
                highContrast
                  ? "w-full rounded-xl border-2 border-white bg-white py-3.5 text-center text-base font-black text-black shadow-none hover:bg-zinc-200 disabled:opacity-60"
                  : "w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3.5 text-center text-base font-bold text-zinc-900 shadow-md hover:from-amber-400 hover:to-orange-400 disabled:opacity-60"
              }
            >
              {pending ? "Updating…" : advanceLabel}
            </button>
          ) : (
            <p
              className={`rounded-xl py-3 text-center text-sm font-medium ${highContrast ? "border-2 border-dashed border-zinc-500 text-zinc-300" : "border border-dashed border-zinc-600 text-zinc-400"}`}
            >
              {order.status === "ready"
                ? "Ready for pickup — front-of-house marks Completed (SRS U7)."
                : "—"}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

const SOUND_KEY = "roms-kitchen-sound";
const HC_KEY = "roms-kitchen-high-contrast";
/** SRS U5 — kitchen queue refresh when WebSocket is down. */
const KITCHEN_POLL_MS = 10_000;

type StatusUpdatePayload = {
  orderId: string;
  trackingToken: string;
  status: OrderStatus;
  order: RomOrder;
};

export default function KitchenPage() {
  const {
    orders,
    advanceKitchenStatus,
    appendOrder,
    patchOrderStatus,
    syncOrdersFromServer,
  } = useOrders();
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [advanceErrorByOrder, setAdvanceErrorByOrder] = useState<{
    orderId: string;
    error: KitchenAdvanceError;
  } | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [highContrast, setHighContrast] = useState(false);
  /** U5 — true after socket dropped following a successful connection, or if socket never connects (degraded). */
  const [queuePolling, setQueuePolling] = useState(false);
  const soundOnRef = useRef(soundOn);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hadSocketConnectRef = useRef(false);

  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  const stopKitchenPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchKitchenQueue = useCallback(async () => {
    try {
      const r = await fetch("/api/orders", { cache: "no-store" });
      const d = (await r.json()) as { orders?: unknown };
      if (!r.ok || !Array.isArray(d.orders)) return;
      syncOrdersFromServer(d.orders as RomOrder[]);
    } catch {
      /* network / parse */
    }
  }, [syncOrdersFromServer]);

  const startKitchenPoll = useCallback(() => {
    if (pollRef.current) return;
    void fetchKitchenQueue();
    pollRef.current = setInterval(() => {
      void fetchKitchenQueue();
    }, KITCHEN_POLL_MS);
  }, [fetchKitchenQueue]);

  /** Initial + same source as U5 polling (in-memory store today; Prisma-backed GET when wired). */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await fetchKitchenQueue();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchKitchenQueue]);

  useEffect(() => {
    const baseUrl = getSocketBaseUrl();
    const socket = io(baseUrl, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    const onConnect = () => {
      hadSocketConnectRef.current = true;
      setQueuePolling(false);
      stopKitchenPoll();
      const kt = getBrowserKitchenDisplayToken();
      socket.emit("join_kitchen", kt ?? "");
      void fetchKitchenQueue();
    };

    const onDisconnect = () => {
      if (hadSocketConnectRef.current) {
        setQueuePolling(true);
        startKitchenPoll();
      }
    };

    const onQueueAppend = (order: RomOrder) => {
      appendOrder(order);
      if (soundOnRef.current) playNewOrderChime();
    };

    const onStatus = (payload: StatusUpdatePayload) => {
      patchOrderStatus(payload.orderId, payload.status);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("new_order", onQueueAppend);
    socket.on("update_queue", onQueueAppend);
    socket.on("status_update", onStatus);

    /** If handshake never succeeds (e.g. `next dev` without server.mjs), still refresh queue from API. */
    const degradedTimer = window.setTimeout(() => {
      if (!socket.connected) {
        setQueuePolling(true);
        startKitchenPoll();
      }
    }, 4000);

    return () => {
      window.clearTimeout(degradedTimer);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("new_order", onQueueAppend);
      socket.off("update_queue", onQueueAppend);
      socket.off("status_update", onStatus);
      socket.disconnect();
      stopKitchenPoll();
    };
  }, [
    appendOrder,
    patchOrderStatus,
    fetchKitchenQueue,
    startKitchenPoll,
    stopKitchenPoll,
  ]);

  async function handleAdvance(
    orderId: string,
    targetStatus: KitchenAdvanceTarget,
  ) {
    setPendingOrderId(orderId);
    setAdvanceErrorByOrder(null);
    try {
      await advanceKitchenStatus(orderId, targetStatus);
    } catch (e) {
      if (e instanceof KitchenStatusNetworkError) {
        setAdvanceErrorByOrder({ orderId, error: { kind: "network" } });
      } else if (e instanceof KitchenStatusHttpError) {
        setAdvanceErrorByOrder({
          orderId,
          error: { kind: "http", message: e.message },
        });
      } else {
        setAdvanceErrorByOrder({
          orderId,
          error: { kind: "http", message: "Could not update order status." },
        });
      }
    } finally {
      setPendingOrderId(null);
    }
  }

  useEffect(() => {
    try {
      const s = localStorage.getItem(SOUND_KEY);
      if (s !== null) setSoundOn(s === "1");
      const h = localStorage.getItem(HC_KEY);
      if (h !== null) setHighContrast(h === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SOUND_KEY, soundOn ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [soundOn]);

  useEffect(() => {
    try {
      localStorage.setItem(HC_KEY, highContrast ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [highContrast]);

  const queue = useMemo(() => {
    return orders
      .filter((o) => o.status !== "completed")
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [orders]);

  const shellBg = highContrast
    ? "min-h-screen bg-black text-white"
    : "min-h-screen bg-zinc-950 text-zinc-100";

  const headerBorder = highContrast ? "border-b-2 border-yellow-400" : "border-b border-zinc-800";

  return (
    <div className={shellBg}>
      <header
        className={`sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 ${headerBorder} ${highContrast ? "bg-black" : "bg-zinc-950/95 backdrop-blur-sm"}`}
      >
        <div className="flex items-center gap-2">
          <ChefHat
            className={`h-8 w-8 shrink-0 ${highContrast ? "text-yellow-400" : "text-amber-400"}`}
            aria-hidden
          />
          <div>
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">
              Kitchen display
            </h1>
            <p
              className={`text-xs ${highContrast ? "text-zinc-300" : "text-zinc-500"}`}
            >
              Live: <code className="text-zinc-400">new_order</code> /{" "}
              <code className="text-zinc-400">update_queue</code> · U5:{" "}
              {KITCHEN_POLL_MS / 1000}s API refresh if socket drops
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundOn((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
              highContrast
                ? soundOn
                  ? "border-2 border-white bg-white text-black hover:bg-zinc-200"
                  : "border-2 border-zinc-500 text-zinc-200 hover:border-white"
                : soundOn
                  ? "bg-zinc-800 text-amber-400 hover:bg-zinc-700"
                  : "bg-zinc-800/60 text-zinc-500 hover:bg-zinc-800"
            }`}
            aria-pressed={soundOn}
            title="Sound when a new order arrives (kitchen alert — SRS U5)"
          >
            {soundOn ? (
              <Volume2 className="h-5 w-5" aria-hidden />
            ) : (
              <VolumeX className="h-5 w-5" aria-hidden />
            )}
            <span className="hidden sm:inline">
              {soundOn ? "Sound on" : "Sound off"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setHighContrast((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
              highContrast
                ? "border-2 border-yellow-400 bg-yellow-400 text-black hover:bg-yellow-300"
                : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
            }`}
            aria-pressed={highContrast}
            title="High-contrast dark mode for wall-mounted displays"
          >
            <Contrast className="h-5 w-5" aria-hidden />
            <span className="hidden sm:inline">
              {highContrast ? "High contrast" : "Wall mode"}
            </span>
          </button>
          <SignOutButton
            className={
              highContrast
                ? "rounded-xl border-2 border-zinc-500 px-3 py-2 text-sm font-semibold text-zinc-200 hover:border-white"
                : "rounded-xl border border-zinc-600 px-3 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-800"
            }
          />
        </div>
      </header>

      {queuePolling && (
        <div
          className={`border-b px-4 py-2 text-center text-sm ${
            highContrast
              ? "border-yellow-400/50 bg-yellow-950/40 text-yellow-100"
              : "border-amber-500/30 bg-amber-950/30 text-amber-100"
          }`}
          role="status"
        >
          Reconnecting… refreshing queue from{" "}
          <code className="rounded bg-black/20 px-1">GET /api/orders</code> every{" "}
          {KITCHEN_POLL_MS / 1000}s (SRS U5). For live Socket.io use{" "}
          <code className="rounded bg-black/20 px-1">npm run dev</code> (node
          server.mjs), port {typeof window !== "undefined" ? window.location.port || "3000" : "3000"}.
        </div>
      )}

      <main className="px-4 py-6 sm:px-6 sm:py-8">
        {queue.length === 0 ? (
          <div
            className={`mx-auto max-w-lg rounded-2xl border p-10 text-center ${
              highContrast
                ? "border-2 border-zinc-600 bg-black"
                : "border border-zinc-800 bg-zinc-900/50"
            }`}
          >
            <p className="text-lg font-semibold">No active tickets</p>
            <p
              className={`mt-2 text-sm ${highContrast ? "text-zinc-400" : "text-zinc-500"}`}
            >
              Place an order while this server is running, or wait for the next
              U5 poll. Orders load from{" "}
              <code className="text-zinc-400">GET /api/orders</code> (same
              process as POST; Prisma when configured).
            </p>
          </div>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {queue.map((order) => (
              <li key={order.orderId}>
                <OrderCard
                  order={order}
                  highContrast={highContrast}
                  pending={pendingOrderId === order.orderId}
                  advanceError={
                    advanceErrorByOrder?.orderId === order.orderId
                      ? advanceErrorByOrder.error
                      : null
                  }
                  onAdvance={handleAdvance}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
