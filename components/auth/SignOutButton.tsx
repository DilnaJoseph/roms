"use client";

import { ACCESS_TOKEN_STORAGE_KEY } from "@/lib/auth/constants";

export function SignOutButton({ className }: { className?: string }) {
  async function signOut() {
    try {
      sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <button
      type="button"
      onClick={signOut}
      className={
        className ??
        "rounded-lg border border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
      }
    >
      Sign out
    </button>
  );
}
