import { randomBytes, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { emitNewOrderToKitchen } from "@/lib/server/emit-new-order";
import { orderTotalFromLines } from "@/lib/server/numeric-total";
import { isDatabaseConfigured } from "@/lib/prisma";
import { createOrderService, listOrdersService } from "@/lib/server/order-service";
import type { OrderLineSnapshot } from "@/shared/types/orders";

export const runtime = "nodejs";

type PostBody = {
  lines?: OrderLineSnapshot[];
};

/**
 * POST: create order — **not** in server.mjs; this route uses `createOrderService` →
 * `prisma.order.create` when `DATABASE_URL` is set (UUID `order_id`, 64-char hex `tracking_token`).
 * Otherwise orders are in-memory only (lost on restart; Prisma Studio stays at 0).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PostBody;
    const lines = body.lines;
    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { error: "Cart must contain at least one line item." },
        { status: 400 },
      );
    }

    for (const line of lines) {
      if (
        typeof line.menuItemId !== "string" ||
        typeof line.name !== "string" ||
        typeof line.quantity !== "number" ||
        typeof line.unitPrice !== "number" ||
        line.quantity < 1 ||
        line.unitPrice <= 0
      ) {
        return NextResponse.json(
          { error: "Invalid line item payload." },
          { status: 400 },
        );
      }
    }

    const orderTotal = orderTotalFromLines(lines);
    const orderId = randomUUID();
    const trackingToken = randomBytes(32).toString("hex");

    const usingDb = isDatabaseConfigured();
    const order = await createOrderService(
      lines,
      orderTotal,
      orderId,
      trackingToken,
    );
    emitNewOrderToKitchen(order);

    if (process.env.NODE_ENV === "development" && !usingDb) {
      console.warn(
        "[ROMS] Order saved to in-memory store only. Set DATABASE_URL in .env.local and run `npx prisma migrate deploy` (or `migrate dev`) so rows appear in MySQL / Prisma Studio.",
      );
    }

    return NextResponse.json({
      order,
      /** `mysql` = persisted via Prisma; `memory` = process RAM only (DBMS submission needs mysql). */
      persistence: usingDb ? "mysql" : "memory",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not place order.";
    const configured = isDatabaseConfigured();
    const tableMissing =
      configured &&
      /does not exist|Unknown table|n'existe pas|1146|P2021|no such table/i.test(
        message,
      );
    if (tableMissing) {
      return NextResponse.json(
        {
          error:
            "MySQL tables are missing or out of date. From the `roms` folder run `npx prisma migrate deploy` (or `npx prisma migrate dev`) with DATABASE_URL pointing at your MySQL 8 instance, then place the order again.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET() {
  try {
    const orders = await listOrdersService();
    return NextResponse.json({ orders });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/sha256_password|authentication plugin|Unknown authentication plugin/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "MySQL auth plugin is not supported by Prisma/Node (e.g. sha256_password). Run: ALTER USER 'you'@'localhost' IDENTIFIED WITH mysql_native_password BY 'yourpassword'; FLUSH PRIVILEGES; — or use DATABASE_URL with ?allowPublicKeyRetrieval=true for local caching_sha2. See roms/.env.example.",
          detail: msg,
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Could not load orders.", detail: msg },
      { status: 500 },
    );
  }
}
