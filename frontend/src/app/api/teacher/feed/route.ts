export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCachedSession } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import { teacherFeedCards } from "@/db/schema";
import { eq, and, gt, asc, desc, isNull, sql } from "drizzle-orm";
import { assembleTeacherSnapshot } from "@/lib/teacherEventEngine/snapshotAssembler";
import { deriveTeacherFeed } from "@/lib/teacherEventEngine/deriveTeacherFeed";
import { syncTeacherFeedCards } from "@/lib/teacherEventEngine/feedPersistence";

export async function GET(req: Request) {
  try {
    const session = await getCachedSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const schoolId = session.user.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { error: "School context missing" },
        { status: 400 }
      );
    }

    const allowed = ["TEACHER", "SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];
    if (!allowed.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const teacherUserId = session.user.id;

    // Assemble snapshot, derive cards, and sync in database inside withTenant
    const result = await withTenant(schoolId, async (tx) => {
      const snapshot = await assembleTeacherSnapshot(schoolId, teacherUserId, now, tx);
      const derivedCards = deriveTeacherFeed(teacherUserId, now, snapshot);
      await syncTeacherFeedCards(schoolId, teacherUserId, derivedCards, tx);

      const activeCards = await tx.query.teacherFeedCards.findMany({
        where: and(
          eq(teacherFeedCards.teacherUserId, teacherUserId),
          gt(teacherFeedCards.expiresAt, now),
          isNull(teacherFeedCards.dismissedAt)
        ),
        orderBy: [
          desc(teacherFeedCards.priority),
          desc(teacherFeedCards.activatedAt),
        ],
      });

      return {
        cards: activeCards,
        snapshot,
      };
    });

    return NextResponse.json({
      success: true,
      cards: result.cards,
      snapshot: result.snapshot,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch teacher feed" },
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

    const schoolId = session.user.schoolId;
    if (!schoolId) {
      return NextResponse.json({ error: "School context missing" }, { status: 400 });
    }

    const body = await req.json();
    const { cardId, cardType } = body;

    const now = new Date();
    const teacherUserId = session.user.id;

    await withTenant(schoolId, async (tx) => {
      const condition = cardType
        ? and(eq(teacherFeedCards.teacherUserId, teacherUserId), eq(teacherFeedCards.cardType, cardType))
        : and(eq(teacherFeedCards.teacherUserId, teacherUserId), eq(teacherFeedCards.id, cardId));

      await tx
        .update(teacherFeedCards)
        .set({
          dismissedAt: now,
          payload: sql`jsonb_set(COALESCE(${teacherFeedCards.payload}, '{}'::jsonb), '{viewedAt}', ${JSON.stringify(now.toISOString())}::jsonb)`,
          updatedAt: now,
        })
        .where(condition);
    });

    return NextResponse.json({ success: true, timestamp: now });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to dismiss card" },
      { status: 500 }
    );
  }
}
