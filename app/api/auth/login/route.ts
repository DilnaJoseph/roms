import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { signSessionToken } from "@/lib/auth/jwt";
import { verifyPassword } from "@/lib/auth/password";
import { findUserByEmail } from "@/lib/auth/seed-users";

export const runtime = "nodejs";

/** SRS U10 login — bcrypt verify, JWT 8h (SRS 2.4), RBAC claim in token. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }

    const user = findUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 },
      );
    }

    const token = await signSessionToken({
      sub: user.userId,
      email: user.email,
      role: user.role,
    });

    const res = NextResponse.json({
      ok: true,
      role: user.role,
      email: user.email,
      /** Same value as httpOnly cookie — use as `Authorization: Bearer` if cookies are blocked. */
      accessToken: token,
    });

    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60,
    });

    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    if (message.includes("JWT_SECRET")) {
      return NextResponse.json({ error: "Server auth is not configured." }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not sign in." }, { status: 500 });
  }
}
