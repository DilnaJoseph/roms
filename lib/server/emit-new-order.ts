import type { RomOrder } from "@/shared/types/orders";

/** SRS F5 / U1 step 7: push new order to kitchen display via Socket.io. */
export function emitNewOrderToKitchen(order: RomOrder): void {
  const io = globalThis.__roms_io;
  if (!io) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[ROMS] Socket.io is not bound (__roms_io missing). Run `npm run dev` (node server.mjs), not `next dev`. New orders are still saved; use GET /api/orders or polling.",
      );
    }
    return;
  }
  io.to("kitchen").emit("new_order", order);
  /** Optional alias for clients listening under a different event name. */
  io.to("kitchen").emit("update_queue", order);
}
