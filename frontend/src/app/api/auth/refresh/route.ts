import { NextRequest, NextResponse } from "next/server";
import { rotateRefreshSession } from "@/lib/auth/refreshToken";
import { users, userRoles, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SignJWT } from "jose";
import { withAuthContext, withTenant } from "@/lib/tenant";

import { getJwtSecret } from "@/lib/auth/jwtSecret";


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

  // Fetch user + role for new JWT inside RLS auth/tenant context
  const user = await withAuthContext(async (tx) => {
    const [u] = await tx
      .select({
        id: users.id,
        schoolId: users.schoolId,
        email: users.email,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, result.userId))
      .limit(1);
    return u;
  });
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const queryRoles = async (tx: any) =>
    await tx
      .select({ roleName: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id));

  const userRolesList = await (user.schoolId
    ? withTenant(user.schoolId, queryRoles, { actorId: user.id })
    : withAuthContext(queryRoles));

  const accessToken = await new SignJWT({
    id: user.id,
    schoolId: user.schoolId,
    role: userRolesList[0]?.roleName ?? "STUDENT",
    email: user.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .sign(getJwtSecret());

  const res = NextResponse.json({ accessToken });

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  // Rotate HttpOnly refresh cookie
  res.cookies.set("schoolmitra_refresh", result.newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60,
    path: `${basePath}/api/auth/refresh`,
  });

  return res;
}
