import type { OrderStatus } from "@/shared/constants";

/** Line item snapshot at order time — aligns with DB `ORDER_ITEMS` (unit price at order). */
export type OrderLineSnapshot = {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

/** In-memory order — maps to `ORDERS` + `ORDER_ITEMS` in the Database Design Document. */
export type RomOrder = {
  orderId: string;
  trackingToken: string;
  status: OrderStatus;
  createdAt: number;
  lines: OrderLineSnapshot[];
  orderTotal: number;
};
