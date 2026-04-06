/**
 * Custom HTTP server: Next.js HTTP handler + Socket.io (SRS F5).
 * REST lives in `app/api/**` — e.g. POST `app/api/orders/route.ts` (place order → Prisma/MySQL),
 * PATCH `app/api/orders/[orderId]/status/route.ts` (U6). This file does not define HTTP routes.
 * Run: `npm run dev` / `npm start` (not plain `next dev` / `next start`).
 *
 * Loads `.env` then `.env.local` so `DATABASE_URL` / `JWT_SECRET` match Prisma + API routes
 * (MySQL 8.x via `DATABASE_URL="mysql://user:pass@host:3306/dbname"`).
 */
import { createServer } from "http";
import { parse } from "url";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { timingSafeEqual } from "crypto";
import dotenv from "dotenv";
import next from "next";
import { Server } from "socket.io";

const rootDir = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(rootDir, ".env") });
dotenv.config({ path: resolve(rootDir, ".env.local"), override: true });

function kitchenTokensMatch(provided, expected) {
  if (typeof provided !== "string" || !provided.trim()) return false;
  try {
    const a = Buffer.from(provided.trim());
    const b = Buffer.from(expected.trim());
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url ?? "", true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Request handler error", req.url, err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  const io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
  });

  globalThis.__roms_io = io;

  const kitchenSharedToken = process.env.ROMS_KITCHEN_TOKEN?.trim();

  io.on("connection", (socket) => {
    /** U5 — optional shared token (same as `X-ROMS-Kitchen-Token` on PATCH). */
    socket.on("join_kitchen", (clientToken) => {
      if (kitchenSharedToken) {
        if (!kitchenTokensMatch(clientToken, kitchenSharedToken)) {
          return;
        }
      }
      socket.join("kitchen");
    });
    /** U2 — customer tracking page joins room `track:{token}` (64-char hex). */
    socket.on("join_tracking", (rawToken) => {
      if (typeof rawToken !== "string" || !/^[a-f0-9]{64}$/i.test(rawToken)) {
        return;
      }
      socket.join(`track:${rawToken}`);
    });
    /** U7 — front-of-house dashboard: live `status_update` (ready → completed, etc.). */
    socket.on("join_staff", () => {
      socket.join("staff");
    });
  });

  httpServer.listen(port, () => {
    console.log(`> ROMS ready at http://${hostname}:${port} (Socket.io enabled)`);
    const db = process.env.DATABASE_URL?.trim();
    if (db) {
      try {
        const normalized = db.replace(/^mysql:\/\//i, "http://");
        const u = new URL(normalized);
        const dbName = (u.pathname || "").replace(/^\//, "") || "(no database in URL)";
        console.log(
          `[ROMS] DATABASE_URL → MySQL host=${u.hostname} port=${u.port || "3306"} database=${dbName}`,
        );
      } catch {
        console.log("[ROMS] DATABASE_URL is set (Prisma/MySQL 8.x) — URL parse skipped.");
      }
    } else {
      console.log(
        "[ROMS] DATABASE_URL not set — orders use in-memory store only (set DATABASE_URL in .env.local for MySQL).",
      );
    }
  });
});
