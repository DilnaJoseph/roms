import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Verifies Prisma can reach MySQL and reports `SELECT DATABASE()` — same connection as order CRUD.
 * Use to confirm `.env.local` `DATABASE_URL` matches the Database Design Document target.
 */
export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({
      configured: false,
      message: "DATABASE_URL is not set — orders use the in-memory store only.",
    });
  }

  try {
    const rows = await prisma.$queryRaw<{ db: string | null }[]>`
      SELECT DATABASE() AS db
    `;
    const name = rows[0]?.db ?? null;
    return NextResponse.json({
      configured: true,
      connected: true,
      database: name,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Connection failed";
    return NextResponse.json(
      {
        configured: true,
        connected: false,
        error: message,
      },
      { status: 503 },
    );
  }
}
