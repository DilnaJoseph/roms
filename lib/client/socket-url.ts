/**
 * Socket.io must hit the same origin (and port) as the custom server.mjs HTTP server.
 * Default: browser origin (e.g. http://localhost:3000). Override if the app is served
 * behind a different public URL.
 */
export function getSocketBaseUrl(): string {
  if (typeof window === "undefined") return "";
  const fromEnv = process.env.NEXT_PUBLIC_SOCKET_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return window.location.origin;
}
