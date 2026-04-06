import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { getJwtSecretKey } from "@/lib/auth/env";
import { isUserRole, roleForProtectedPath } from "@/lib/auth/roles";

const LOGIN_PATH = "/login";

/**
 * RBAC gate: only `admin` may access /admin, `staff` → /staff, `kitchen` → /kitchen.
 * Customers (no cookie) are redirected to login — SRS F12.
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requiredRole = roleForProtectedPath(pathname);
  if (!requiredRole) {
    return NextResponse.next();
  }

  const key = getJwtSecretKey();
  if (!key) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.searchParams.set("error", "config");
    return NextResponse.redirect(url);
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.searchParams.set(
      "from",
      `${pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(url);
  }

  try {
    const { payload } = await jwtVerify(token, key);
    const role = payload.role;
    if (!isUserRole(role) || role !== requiredRole) {
      const url = request.nextUrl.clone();
      url.pathname = LOGIN_PATH;
      url.searchParams.set("error", "forbidden");
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  } catch {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.searchParams.set("error", "session");
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/admin/:path*", "/staff/:path*", "/kitchen/:path*"],
};
