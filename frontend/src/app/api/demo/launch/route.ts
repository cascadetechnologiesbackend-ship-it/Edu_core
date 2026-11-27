import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { schools, users, userRoles, roles } from "@/db/schema/core";
import { and, eq, sql } from "drizzle-orm";
import { withTenant } from "@/lib/tenant";
import { signDemoLaunchToken } from "@/lib/auth/demoToken";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const board = typeof body?.board === "string" ? body.board.trim().toUpperCase() : "CBSE";
    const targetRole = typeof body?.role === "string" ? body.role.trim().toUpperCase() : "SCHOOL_ADMIN";

    // 1. Resolve demo school from PostgreSQL
    const demoSchools = await db
      .select({
        id: schools.id,
        name: schools.name,
        board: schools.board,
        slug: schools.slug,
        featureFlags: schools.featureFlags,
      })
      .from(schools)
      .where(sql`(${schools.featureFlags}->>'demo_tenant')::boolean = true AND ${schools.isActive} = true`);

    const school =
      demoSchools.find((s) => s.board?.toUpperCase() === board) ||
      demoSchools.find((s) => s.slug === "demo-cbse") ||
      demoSchools[0];

    if (!school) {
      return NextResponse.json(
        { error: "No active demo school found in database." },
        { status: 404 },
      );
    }

    // 2. Resolve active user for requested role from PostgreSQL inside tenant context
    const demoUser = await withTenant(school.id, async (tx) => {
      const rows = await tx
        .select({
          id: users.id,
          email: users.email,
          roleName: roles.name,
        })
        .from(users)
        .innerJoin(userRoles, eq(userRoles.userId, users.id))
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(
          and(
            eq(users.schoolId, school.id),
            eq(users.isActive, true),
            eq(roles.name, targetRole as any),
          ),
        )
        .orderBy(users.email)
        .limit(10);

      // Prefer primary canonical demo account (no dot/suffix in local-part) if multiple exist
      return (
        rows.find((r) => /^[^.@]+@/.test(r.email)) ||
        rows.find((r) => !/\.\d+@/.test(r.email)) ||
        rows[0] ||
        null
      );
    });

    if (!demoUser) {
      return NextResponse.json(
        { error: `No active demo user found for role ${targetRole}.` },
        { status: 404 },
      );
    }

    const demoToken = signDemoLaunchToken(demoUser.id, school.id, demoUser.email);

    return NextResponse.json({
      email: demoUser.email,
      schoolId: school.id,
      schoolName: school.name,
      role: demoUser.roleName,
      demoToken,
    });
  } catch (err) {
    console.error("[DEMO LAUNCH API ERROR]", err);
    return NextResponse.json(
      { error: "Failed to resolve demo persona from database." },
      { status: 500 },
    );
  }
}
