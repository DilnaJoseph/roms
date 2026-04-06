/**
 * Order workflow states (F4, F6, F7) — CS03_07 SRS & Database Design Document.
 * API / DB values use lowercase enums; UI labels match SRS wording.
 */
export const ORDER_STATUSES = [
  "received",
  "preparing",
  "ready",
  "completed",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  received: "Received",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
};

/** Kitchen may advance: received → preparing → ready (F6). Staff completes (F7). */
export const KITCHEN_ALLOWED_TRANSITIONS: Record<
  OrderStatus,
  readonly OrderStatus[]
> = {
  received: ["preparing"],
  preparing: ["ready"],
  ready: [],
  completed: [],
};

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}
