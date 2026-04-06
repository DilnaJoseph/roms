import type { RomOrder } from "@/shared/types/orders";

/** U6 step 4: WebSocket `status_update` to customer tracking + kitchen displays (SRS F4). */
export type StatusUpdatePayload = {
  orderId: string;
  trackingToken: string;
  status: RomOrder["status"];
  order: RomOrder;
};

export function emitOrderStatusUpdate(order: RomOrder): void {
  const io = globalThis.__roms_io;
  const payload: StatusUpdatePayload = {
    orderId: order.orderId,
    trackingToken: order.trackingToken,
    status: order.status,
    order,
  };
  if (!io && process.env.NODE_ENV === "development") {
    console.warn(
      "[ROMS] status_update not emitted — run `node server.mjs` so Socket.io is attached.",
    );
  }
  io?.to(`track:${order.trackingToken}`).emit("status_update", payload);
  io?.to("kitchen").emit("status_update", payload);
  io?.to("staff").emit("status_update", payload);
}
