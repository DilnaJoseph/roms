import { NextRequest, NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/auth/authorize-admin-request";
import { isDatabaseConfigured } from "@/lib/prisma";
import {
  getAdminDashboardData,
  getEmptyAdminDashboard,
} from "@/lib/server/admin-dashboard-service";

export const runtime = "nodejs";

export type AdminDashboardApiResponse = Awaited<
  ReturnType<typeof getAdminDashboardData>
> & {
  mysqlConfigured: boolean;
  mysqlReachable: boolean;
  error?: string;
};

/**
 * SRS §3.2 style polling source — admin KPIs, status groupBy, recent orders (MySQL / Prisma).
 */
export async function GET(request: NextRequest) {
  const auth = await authorizeAdminRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isDatabaseConfigured()) {
    const empty = getEmptyAdminDashboard();
    return NextResponse.json({
      ...empty,
      mysqlConfigured: false,
      mysqlReachable: false,
      error:
        "DATABASE_URL is not set. Configure MySQL in roms/.env.local for live admin analytics.",
    } satisfies AdminDashboardApiResponse);
  }

  try {
    const data = await getAdminDashboardData();
    return NextResponse.json({
      ...data,
      mysqlConfigured: true,
      mysqlReachable: true,
    } satisfies AdminDashboardApiResponse);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database query failed.";
    return NextResponse.json(
      {
        ...getEmptyAdminDashboard(),
        mysqlConfigured: true,
        mysqlReachable: false,
        error: message,
      } satisfies AdminDashboardApiResponse,
      { status: 503 },
    );
  }
}
