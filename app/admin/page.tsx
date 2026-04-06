"use client";

import { useCallback, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Copy,
  Database,
  IndianRupee,
  RefreshCw,
  Scale,
  ShoppingCart,
  X,
} from "lucide-react";
import { ACCESS_TOKEN_STORAGE_KEY } from "@/lib/auth/constants";
import { ORDER_STATUS_LABELS } from "@/shared/constants";
import type { OrderStatus } from "@/shared/constants";

const REFRESH_MS = 10_000;

type DashboardJson = {
  kpis: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number | null;
    activeOrders: number;
  };
  statusBreakdown: Record<OrderStatus, number>;
  recentOrders: Array<{
    orderId: string;
    trackingToken: string;
    orderTotal: number;
    orderStatus: OrderStatus;
    createdAt: string;
    tableNumber: number | null;
  }>;
  mysqlConfigured: boolean;
  mysqlReachable: boolean;
  error?: string;
};

function formatInr(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatLocal(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusBadgeClasses(status: OrderStatus): string {
  switch (status) {
    case "received":
      return "bg-sky-500/15 text-sky-300 ring-sky-500/40";
    case "preparing":
      return "bg-amber-500/15 text-amber-300 ring-amber-500/40";
    case "ready":
      return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40";
    case "completed":
      return "bg-zinc-500/20 text-zinc-400 ring-zinc-500/35";
    default:
      return "bg-zinc-500/20 text-zinc-400 ring-zinc-500/35";
  }
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardJson | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const headers: Record<string, string> = {};
    if (typeof window !== "undefined") {
      const t = sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
      if (t) headers.Authorization = `Bearer ${t}`;
    }
    try {
      const res = await fetch("/api/admin/dashboard", {
        cache: "no-store",
        credentials: "include",
        headers,
      });
      const json = (await res.json()) as DashboardJson & { error?: string };
      if (res.status === 401 || res.status === 403) {
        setData({
          kpis: {
            totalRevenue: 0,
            totalOrders: 0,
            averageOrderValue: null,
            activeOrders: 0,
          },
          statusBreakdown: {
            received: 0,
            preparing: 0,
            ready: 0,
            completed: 0,
          },
          recentOrders: [],
          mysqlConfigured: false,
          mysqlReachable: false,
          error: json.error ?? "Not authorized as admin.",
        });
        setLastUpdated(new Date());
        return;
      }
      setData({
        kpis: json.kpis ?? {
          totalRevenue: 0,
          totalOrders: 0,
          averageOrderValue: null,
          activeOrders: 0,
        },
        statusBreakdown: json.statusBreakdown ?? {
          received: 0,
          preparing: 0,
          ready: 0,
          completed: 0,
        },
        recentOrders: Array.isArray(json.recentOrders) ? json.recentOrders : [],
        mysqlConfigured: Boolean(json.mysqlConfigured),
        mysqlReachable: Boolean(json.mysqlReachable),
        error: json.error,
      });
      setLastUpdated(new Date());
    } catch {
      setData({
        kpis: {
          totalRevenue: 0,
          totalOrders: 0,
          averageOrderValue: null,
          activeOrders: 0,
        },
        statusBreakdown: {
          received: 0,
          preparing: 0,
          ready: 0,
          completed: 0,
        },
        recentOrders: [],
        mysqlConfigured: false,
        mysqlReachable: false,
        error: "Network error loading dashboard.",
      });
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  async function copyToken() {
    if (!selectedToken) return;
    try {
      await navigator.clipboard.writeText(selectedToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const dbOk = data?.mysqlConfigured && data?.mysqlReachable;
  const dbWarn = data?.mysqlConfigured && !data?.mysqlReachable;
  const dbOff = !data?.mysqlConfigured;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-zinc-950 text-zinc-100">
      {/* Database status — SRS-style health indicator */}
      <div
        className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-sm"
        title={
          dbOk
            ? "MySQL handshake OK (Prisma)"
            : dbWarn
              ? data?.error ?? "MySQL unreachable"
              : "DATABASE_URL not configured"
        }
        role="status"
      >
        <Database className="h-3.5 w-3.5" aria-hidden />
        <span
          className={`h-2 w-2 rounded-full ${
            dbOk ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-red-500"
          }`}
        />
        <span className="text-zinc-300">
          {dbOk ? "Database online" : dbWarn ? "Database error" : "No database"}
        </span>
      </div>

      <main className="mx-auto max-w-7xl space-y-8 p-4 pb-16 pt-14 sm:p-6 sm:pt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
              Operations overview
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Live metrics · auto-refresh every {REFRESH_MS / 1000}s (SRS §3.2)
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh now
          </button>
        </div>

        {lastUpdated && (
          <p className="text-xs text-zinc-600">
            Last updated: {formatLocal(lastUpdated.toISOString())}
          </p>
        )}

        {data?.error && (dbWarn || dbOff) && (
          <p
            className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90"
            role="alert"
          >
            {data.error}
          </p>
        )}

        {/* KPI cards */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={IndianRupee}
            label="Total revenue"
            subtitle="Sum of order_total (₹)"
            value={loading ? "…" : formatInr(data?.kpis.totalRevenue ?? 0)}
            loading={loading}
          />
          <KpiCard
            icon={ShoppingCart}
            label="Total orders"
            subtitle="Count of order_id"
            value={
              loading ? "…" : String(data?.kpis.totalOrders ?? 0)
            }
            loading={loading}
          />
          <KpiCard
            icon={Scale}
            label="Average order value"
            subtitle="Revenue ÷ orders"
            value={
              loading
                ? "…"
                : data?.kpis.averageOrderValue != null
                  ? formatInr(data.kpis.averageOrderValue)
                  : "—"
            }
            loading={loading}
          />
          <KpiCard
            icon={Activity}
            label="Active orders"
            subtitle="Status ≠ completed"
            value={loading ? "…" : String(data?.kpis.activeOrders ?? 0)}
            loading={loading}
            accent="emerald"
          />
        </section>

        {/* Status breakdown */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-white">Order analytics</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Status breakdown (Prisma <code className="text-zinc-400">groupBy</code>)
          </p>
          {loading ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-xl bg-zinc-800/80"
                />
              ))}
            </div>
          ) : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  "received",
                  "preparing",
                  "ready",
                  "completed",
                ] as const
              ).map((key) => (
                <div
                  key={key}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-4"
                >
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    {ORDER_STATUS_LABELS[key]}
                  </p>
                  <p className="mt-2 text-3xl font-bold tabular-nums text-white">
                    {data?.statusBreakdown[key] ?? 0}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent orders */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-white">Recent orders</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Latest 10 by <code className="text-zinc-400">created_at</code> · click
            a row to view the 64-char tracking token. Table shows &quot;—&quot;
            until <code className="text-zinc-400">table_number</code> exists on{" "}
            <code className="text-zinc-400">orders</code> (see Prisma schema
            comment).
          </p>

          {loading ? (
            <div className="mt-6 h-48 animate-pulse rounded-xl bg-zinc-800/80" />
          ) : !data?.recentOrders?.length ? (
            <p className="mt-8 text-center text-sm text-zinc-500">
              No data found — place an order from the menu when MySQL is connected.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
                    <th className="pb-3 pr-4 font-medium">Table</th>
                    <th className="pb-3 pr-4 font-medium">Order ID (UUID)</th>
                    <th className="pb-3 pr-4 font-medium">Total (₹)</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 font-medium">Placed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {data.recentOrders.map((row) => (
                    <tr
                      key={row.orderId}
                      className="cursor-pointer transition hover:bg-zinc-800/40"
                      onClick={() => setSelectedToken(row.trackingToken)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedToken(row.trackingToken);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label="View tracking token"
                    >
                      <td className="py-3 pr-4 font-mono text-zinc-300">
                        {row.tableNumber != null ? row.tableNumber : "—"}
                      </td>
                      <td className="max-w-[200px] truncate py-3 pr-4 font-mono text-xs text-zinc-400">
                        {row.orderId}
                      </td>
                      <td className="py-3 pr-4 tabular-nums text-zinc-200">
                        {formatInr(row.orderTotal)}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${statusBadgeClasses(row.orderStatus)}`}
                        >
                          {ORDER_STATUS_LABELS[row.orderStatus]}
                        </span>
                      </td>
                      <td className="py-3 text-zinc-400">
                        {formatLocal(row.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Tracking token modal */}
      {selectedToken && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="token-dialog-title"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <h4
                id="token-dialog-title"
                className="text-lg font-semibold text-white"
              >
                Tracking token
              </h4>
              <button
                type="button"
                onClick={() => setSelectedToken(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-zinc-500">
              64-character opaque token (customer tracking link)
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Length: {selectedToken.length} characters
            </p>
            <div className="mt-4 break-all rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-emerald-400/95">
              {selectedToken}
            </div>
            <button
              type="button"
              onClick={() => void copyToken()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white"
            >
              <Copy className="h-4 w-4" aria-hidden />
              {copied ? "Copied" : "Copy to clipboard"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  subtitle,
  value,
  loading,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  subtitle: string;
  value: string;
  loading?: boolean;
  accent?: "emerald";
}) {
  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br p-5 shadow-lg ${
        accent === "emerald"
          ? "border-emerald-500/20 from-emerald-950/40 to-zinc-900"
          : "border-zinc-800 from-zinc-900/90 to-zinc-950"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {label}
          </p>
          <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl">
            {value}
          </p>
          <p className="mt-2 text-xs text-zinc-600">{subtitle}</p>
        </div>
        <div
          className={`rounded-xl p-2.5 ${
            accent === "emerald"
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-zinc-800 text-amber-400"
          }`}
        >
          <Icon className="h-6 w-6" aria-hidden />
        </div>
      </div>
      {loading && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-amber-500/50" />
        </div>
      )}
    </div>
  );
}
