import { db } from "@/db";
import { parentFeedCards } from "@/db/schema";
import { and, eq, lte, inArray } from "drizzle-orm";
import { DerivedFeedCard } from "./types";

/**
 * Persists and reconciles derived parent feed cards in the database.
 *
 * Rules:
 * - Expired cards are pruned.
 * - Cards no longer in the active derived set are deleted.
 * - Active cards are upserted with current payload and expiry.
 */
export async function syncParentFeedCards(
  schoolId: string,
  studentId: string,
  cards: DerivedFeedCard[],
  txDb: any = db
): Promise<void> {
  const now = new Date();

  // 1. Delete already-expired cards for this student
  await txDb
    .delete(parentFeedCards)
    .where(
      and(
        eq(parentFeedCards.studentId, studentId),
        lte(parentFeedCards.expiresAt, now)
      )
    );

  if (cards.length === 0) {
    // If derived set is empty, clear remaining unexpired cards for this student
    await txDb
      .delete(parentFeedCards)
      .where(eq(parentFeedCards.studentId, studentId));
    return;
  }

  // 2. Upsert current active cards
  for (const card of cards) {
    const existing = await txDb.query.parentFeedCards.findFirst({
      where: and(
        eq(parentFeedCards.studentId, studentId),
        eq(parentFeedCards.cardType, card.cardType)
      ),
    });

    if (existing) {
      await txDb
        .update(parentFeedCards)
        .set({
          tier: card.tier,
          priority: card.priority,
          title: card.title,
          summary: card.summary,
          payload: card.payload,
          activatedAt: card.activatedAt,
          expiresAt: card.expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(parentFeedCards.id, existing.id));
    } else {
      await txDb.insert(parentFeedCards).values({
        schoolId,
        studentId,
        cardType: card.cardType,
        tier: card.tier,
        priority: card.priority,
        title: card.title,
        summary: card.summary,
        payload: card.payload,
        activatedAt: card.activatedAt,
        expiresAt: card.expiresAt,
      });
    }
  }

  // 3. Remove any cards in DB whose cardType is not in the new derived set
  const activeTypes = cards.map((c) => c.cardType);
  const allCurrentInDb = await txDb.query.parentFeedCards.findMany({
    where: eq(parentFeedCards.studentId, studentId),
    columns: { id: true, cardType: true },
  });

  const idsToRemove = allCurrentInDb
    .filter((row: { id: string; cardType: string }) => !activeTypes.includes(row.cardType as any))
    .map((row: { id: string }) => row.id);

  if (idsToRemove.length > 0) {
    await txDb
      .delete(parentFeedCards)
      .where(inArray(parentFeedCards.id, idsToRemove));
  }
}
