import { NextRequest, NextResponse } from "next/server";
import { rotateRefreshSession } from "@/lib/auth/refreshToken";
import { db } from "@/db";
import { users, userRoles, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.AUTH_SECRET!);

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get("schoolmitra_refresh")?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ua = req.headers.get("user-agent") ?? "unknown";

  const result = await rotateRefreshSession(refreshToken, ip, ua);
  if (!result) {
    const res = NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
    res.cookies.delete("schoolmitra_refresh");
    return res;
  }

  // Fetch user + role for new JWT
  const user = await db.query.users.findFirst({ where: eq(users.id, result.userId) });
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const userRolesList = await db.select({ roleName: roles.name })
    .from(userRoles).innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, user.id));

  const accessToken = await new SignJWT({
    id: user.id,
    schoolId: user.schoolId,
    role: userRolesList[0]?.roleName ?? "STUDENT",
    email: user.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .sign(JWT_SECRET);

  const res = NextResponse.json({ accessToken });

  // Rotate HttpOnly refresh cookie
  res.cookies.set("schoolmitra_refresh", result.newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60,
    path: "/api/auth/refresh",
  });

  return res;
}
