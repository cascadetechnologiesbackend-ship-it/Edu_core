import { db } from "@/db";
import { teacherFeedCards } from "@/db/schema";
import { and, eq, lte, inArray } from "drizzle-orm";
import { DerivedTeacherFeedCard } from "./types";

/**
 * Persists and reconciles derived teacher feed cards in the database.
 *
 * Rules:
 * - Expired cards are pruned.
 * - Cards no longer in the active derived set are deleted.
 * - Active cards are upserted with current payload, priority, and expiry.
 * - Enforces zero clutter: when cards is empty, all feed cards for the teacher are cleared.
 */
export async function syncTeacherFeedCards(
  schoolId: string,
  teacherUserId: string,
  cards: DerivedTeacherFeedCard[],
  txDb: any = db
): Promise<void> {
  const now = new Date();

  // 1. Delete expired cards for this teacher
  await txDb
    .delete(teacherFeedCards)
    .where(
      and(
        eq(teacherFeedCards.teacherUserId, teacherUserId),
        lte(teacherFeedCards.expiresAt, now)
      )
    );

  if (cards.length === 0) {
    // If derived set is empty, clear remaining unexpired cards for this teacher
    await txDb
      .delete(teacherFeedCards)
      .where(eq(teacherFeedCards.teacherUserId, teacherUserId));
    return;
  }

  // 2. Upsert current active cards
  for (const card of cards) {
    const existing = await txDb.query.teacherFeedCards.findFirst({
      where: and(
        eq(teacherFeedCards.teacherUserId, teacherUserId),
        eq(teacherFeedCards.cardType, card.cardType)
      ),
    });

    if (existing) {
      await txDb
        .update(teacherFeedCards)
        .set({
          tier: card.tier,
          priority: card.priority,
          title: card.title,
          summary: card.summary,
          payload: card.payload,
          audience: card.audience || null,
          activatedAt: card.activatedAt,
          expiresAt: card.expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(teacherFeedCards.id, existing.id));
    } else {
      await txDb.insert(teacherFeedCards).values({
        schoolId,
        teacherUserId,
        cardType: card.cardType,
        tier: card.tier,
        priority: card.priority,
        title: card.title,
        summary: card.summary,
        payload: card.payload,
        audience: card.audience || null,
        activatedAt: card.activatedAt,
        expiresAt: card.expiresAt,
      });
    }
  }

  // 3. Remove any cards in DB whose cardType is not in the new derived set
  const activeTypes = cards.map((c) => c.cardType);
  const allCurrentInDb = await txDb.query.teacherFeedCards.findMany({
    where: eq(teacherFeedCards.teacherUserId, teacherUserId),
    columns: { id: true, cardType: true },
  });

  const idsToRemove = allCurrentInDb
    .filter((row: { id: string; cardType: string }) => !activeTypes.includes(row.cardType as any))
    .map((row: { id: string }) => row.id);

  if (idsToRemove.length > 0) {
    await txDb
      .delete(teacherFeedCards)
      .where(inArray(teacherFeedCards.id, idsToRemove));
  }
}
