"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { ACCESS_TOKEN_STORAGE_KEY } from "@/lib/auth/constants";
import type { UserRole } from "@/lib/auth/roles";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const errorParam = searchParams.get("error");
  const hint =
    errorParam === "forbidden"
      ? "That account cannot open this area. Sign in with the correct role."
      : errorParam === "session"
        ? "Your session expired. Please sign in again."
        : errorParam === "config"
          ? "Server misconfiguration: set JWT_SECRET (32+ chars) in .env.local."
          : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        role?: UserRole;
        accessToken?: string;
        error?: string;
      };
      if (!res.ok) {
        setMessage(data.error ?? "Sign-in failed.");
        return;
      }
      if (data.accessToken) {
        try {
          sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, data.accessToken);
        } catch {
          /* private mode */
        }
      }
      const role = data.role;
      if (!role) {
        setMessage("Invalid response from server.");
        return;
      }
      const from = searchParams.get("from");
      const home = `/${role}`;
      const target =
        from && (from === home || from.startsWith(`${home}/`)) ? from : home;
      router.push(target);
      router.refresh();
    } catch {
      setMessage("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-lg">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
        Staff sign in
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        Admin, front-of-house, and kitchen accounts only. Customers order from
        the home page without logging in (SRS F12).
      </p>
      {hint && (
        <p
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          role="alert"
        >
          {hint}
        </p>
      )}
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-zinc-700"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            required
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-zinc-700"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            required
          />
        </div>
        {message && (
          <p className="text-sm text-red-600" role="alert">
            {message}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-center text-xs text-zinc-500">
        Dev seed: <code className="rounded bg-zinc-100 px-1">admin@roms.local</code>,{" "}
        <code className="rounded bg-zinc-100 px-1">staff@roms.local</code>,{" "}
        <code className="rounded bg-zinc-100 px-1">kitchen@roms.local</code> — password{" "}
        <code className="rounded bg-zinc-100 px-1">RomS2026!</code>
      </p>
      <p className="mt-4 text-center">
        <Link
          href="/"
          className="text-sm font-medium text-amber-700 hover:underline"
        >
          ← Customer menu
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-12">
      <Suspense
        fallback={
          <div className="text-sm text-zinc-500">Loading sign-in…</div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
