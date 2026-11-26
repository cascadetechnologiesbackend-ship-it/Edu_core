import { db } from "@/db";
import { teacherFeedCards } from "@/db/schema";
import { and, eq, lte, inArray } from "drizzle-orm";
import { DerivedTeacherFeedCard } from "./types";

function getCardDedupKey(cardType: string, payload: any): string {
  if (!payload || typeof payload !== "object") return cardType;
  const subKey =
    payload.noticeId ||
    payload.modelId ||
    payload.assignmentId ||
    payload.examId ||
    payload.substitutionId ||
    payload.sectionId ||
    payload.periodNumber ||
    payload.threadId ||
    "";
  return `${cardType}:${String(subKey)}`;
}

/**
 * Persists and reconciles derived teacher feed cards in the database.
 *
 * Rules:
 * - Expired cards are pruned.
 * - Cards no longer in the active derived set are deleted.
 * - Active cards are upserted with current payload, priority, and expiry.
 * - Multi-instance card types (NoticeCard, InsightCard, HomeworkDueCard, ClassworkPendingCard)
 *   are keyed by (cardType, payload identity) so they do not overwrite each other.
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

  const allCurrentInDb = await txDb.query.teacherFeedCards.findMany({
    where: eq(teacherFeedCards.teacherUserId, teacherUserId),
  });

  const existingByKey = new Map<string, any>();
  for (const row of allCurrentInDb) {
    existingByKey.set(getCardDedupKey(row.cardType, row.payload), row);
  }

  const activeKeys = new Set<string>();

  // 2. Upsert current active cards
  for (const card of cards) {
    const key = getCardDedupKey(card.cardType, card.payload);
    activeKeys.add(key);
    const existing = existingByKey.get(key);

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

  // 3. Remove any cards in DB whose (cardType, dedupKey) is not in the new derived set
  const idsToRemove = allCurrentInDb
    .filter((row: { id: string; cardType: string; payload: any }) => !activeKeys.has(getCardDedupKey(row.cardType, row.payload)))
    .map((row: { id: string }) => row.id);

  if (idsToRemove.length > 0) {
    await txDb
      .delete(teacherFeedCards)
      .where(inArray(teacherFeedCards.id, idsToRemove));
  }
}
