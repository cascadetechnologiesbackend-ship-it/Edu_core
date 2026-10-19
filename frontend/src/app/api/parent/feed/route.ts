export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCachedSession } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import { parentFeedCards, students } from "@/db/schema";
import { eq, and, gt, asc, desc, isNull, sql } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const session = await getCachedSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return NextResponse.json(
        { error: "studentId is required" },
        { status: 400 }
      );
    }

    const schoolId = session.user.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { error: "School context missing" },
        { status: 400 }
      );
    }

    // Verify access to student
    const student = await db.query.students.findFirst({
      where: and(eq(students.id, studentId), eq(students.schoolId, schoolId)),
      columns: { id: true, primaryParentUserId: true },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // RBAC: If role is PARENT, must be primary parent or guardian
    if (session.user.role === "PARENT" && student.primaryParentUserId !== session.user.id) {
      return NextResponse.json(
        { error: "Access denied to this student record" },
        { status: 403 }
      );
    }

    const now = new Date();

    // Fetch active unexpired and undismissed cards
    const activeCards = await withTenant(schoolId, async (tx) => {
      return await tx.query.parentFeedCards.findMany({
        where: and(
          eq(parentFeedCards.studentId, studentId),
          gt(parentFeedCards.expiresAt, now),
          isNull(parentFeedCards.dismissedAt)
        ),
        orderBy: [
          asc(parentFeedCards.tier),
          desc(parentFeedCards.priority),
          desc(parentFeedCards.activatedAt),
        ],
      });
    });

    return NextResponse.json({
      success: true,
      cards: activeCards,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch feed" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getCachedSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { studentId, cardId, cardType } = body;

    if (!studentId) {
      return NextResponse.json({ error: "studentId is required" }, { status: 400 });
    }

    const schoolId = session.user.schoolId;
    if (!schoolId) {
      return NextResponse.json({ error: "School context missing" }, { status: 400 });
    }

    const now = new Date();

    await withTenant(schoolId, async (tx) => {
      const condition = cardType
        ? and(eq(parentFeedCards.studentId, studentId), eq(parentFeedCards.cardType, cardType))
        : and(eq(parentFeedCards.studentId, studentId), eq(parentFeedCards.id, cardId));

      await tx
        .update(parentFeedCards)
        .set({
          dismissedAt: now,
          payload: sql`jsonb_set(COALESCE(${parentFeedCards.payload}, '{}'::jsonb), '{viewedAt}', ${JSON.stringify(now.toISOString())}::jsonb)`,
          updatedAt: now,
        })
        .where(condition);
    });

    return NextResponse.json({ success: true, timestamp: now });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update card status" },
      { status: 500 }
    );
  }
}
