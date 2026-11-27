import { NextResponse } from "next/server";
import { db } from "@/db";
import { schools, users, userRoles, roles } from "@/db/schema/core";
import { eq, sql } from "drizzle-orm";
import { withAuthContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const demoSchools = await db
      .select({
        id: schools.id,
        name: schools.name,
        slug: schools.slug,
        board: schools.board,
        featureFlags: schools.featureFlags,
      })
      .from(schools)
      .where(sql`(${schools.featureFlags}->>'demo_tenant')::boolean = true`);

    const result = [];

    for (const s of demoSchools) {
      const roleRows = await withAuthContext(async (tx) => {
        return await tx
          .select({
            email: users.email,
            roleName: roles.name,
          })
          .from(users)
          .innerJoin(userRoles, eq(userRoles.userId, users.id))
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(eq(users.schoolId, s.id));
      });

      const personas: Record<string, string> = {};
      for (const row of roleRows) {
        if (!personas[row.roleName]) {
          personas[row.roleName] = row.email;
        } else if (s.slug === "demo-cbse" && !row.email.includes(".cbse@") && !row.email.includes(".")) {
          // Prefer primary flagship alias if present
          personas[row.roleName] = row.email;
        }
      }

      result.push({
        id: s.id,
        name: s.name,
        slug: s.slug,
        board: s.board,
        personas,
      });
    }

    const flagship = result.find((s) => s.slug === "demo-cbse") || result[0];
    return NextResponse.json({
      schools: result,
      personas: flagship?.personas || {},
    });
  } catch (err) {
    console.error("[DEMO PERSONAS ERROR]", err);
    return NextResponse.json({ schools: [] }, { status: 500 });
  }
}
