"use client";

import { OrdersProvider } from "@/contexts/orders-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return <OrdersProvider>{children}</OrdersProvider>;
}
