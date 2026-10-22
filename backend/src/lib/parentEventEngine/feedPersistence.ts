import { db, parentFeedCards } from "@schoolmitra/database";
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
  first: any,
  second: any,
  third: any,
  fourth?: any,
  fifth?: any
): Promise<void> {
  let txDb: any;
  let schoolId: string;
  let studentId: string;
  let cards: DerivedFeedCard[];

  // Support both (tx, schoolId, studentId, cards, now?) and (schoolId, studentId, cards, txDb?)
  if (first && typeof first === "object" && typeof first.delete === "function") {
    txDb = first;
    schoolId = second;
    studentId = third;
    cards = fourth || [];
  } else {
    schoolId = first;
    studentId = second;
    cards = third || [];
    txDb = fourth && typeof fourth.delete === "function" ? fourth : db;
  }

  const safeCards = Array.isArray(cards) ? cards : [];
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

  if (safeCards.length === 0) {
    // If derived set is empty, clear remaining unexpired cards for this student
    await txDb
      .delete(parentFeedCards)
      .where(eq(parentFeedCards.studentId, studentId));
    return;
  }

  // 2. Fetch all current unexpired cards for this student to reconcile
  const allCurrentInDb = await txDb.query.parentFeedCards.findMany({
    where: eq(parentFeedCards.studentId, studentId),
  });

  const matchedDbCardIds = new Set<string>();

  // Helper to match a derived card to an existing row in DB
  const findMatchingDbCard = (card: DerivedFeedCard) => {
    return allCurrentInDb.find((dbCard: any) => {
      if (matchedDbCardIds.has(dbCard.id)) return false;
      if (dbCard.cardType !== card.cardType) return false;

      // Match by explicit cardId in payload if previously persisted
      if (dbCard.payload?.cardId && dbCard.payload.cardId === card.id) {
        return true;
      }

      // Match by specific entity keys
      if (card.payload?.homeworkId && dbCard.payload?.homeworkId === card.payload.homeworkId) {
        return true;
      }
      if (card.payload?.classworkId && dbCard.payload?.classworkId === card.payload.classworkId) {
        return true;
      }
      if (card.payload?.assessmentId && dbCard.payload?.assessmentId === card.payload.assessmentId) {
        return true;
      }
      if (card.payload?.invoiceId && dbCard.payload?.invoiceId === card.payload.invoiceId) {
        return true;
      }
      if (card.payload?.noticeId && dbCard.payload?.noticeId === card.payload.noticeId) {
        return true;
      }

      // Fallback for singletons per type (e.g. AttendanceCard, WeeklyDigestCard)
      if (
        !card.payload?.homeworkId &&
        !card.payload?.classworkId &&
        !card.payload?.assessmentId &&
        !card.payload?.invoiceId &&
        !card.payload?.noticeId
      ) {
        return true;
      }

      return false;
    });
  };

  for (const card of safeCards) {
    const existing = findMatchingDbCard(card);
    const enrichedPayload = { ...card.payload, cardId: card.id };

    if (existing) {
      matchedDbCardIds.add(existing.id);
      await txDb
        .update(parentFeedCards)
        .set({
          tier: card.tier,
          priority: card.priority,
          title: card.title,
          summary: card.summary,
          payload: enrichedPayload,
          activatedAt: card.activatedAt,
          expiresAt: card.expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(parentFeedCards.id, existing.id));
    } else {
      const [inserted] = await txDb
        .insert(parentFeedCards)
        .values({
          schoolId,
          studentId,
          cardType: card.cardType,
          tier: card.tier,
          priority: card.priority,
          title: card.title,
          summary: card.summary,
          payload: enrichedPayload,
          activatedAt: card.activatedAt,
          expiresAt: card.expiresAt,
        })
        .returning({ id: parentFeedCards.id });

      if (inserted?.id) {
        matchedDbCardIds.add(inserted.id);
      }
    }
  }

  // 3. Remove any cards in DB that were not matched in the current active derived set
  const idsToRemove = allCurrentInDb
    .filter((row: { id: string }) => !matchedDbCardIds.has(row.id))
    .map((row: { id: string }) => row.id);

  if (idsToRemove.length > 0) {
    await txDb
      .delete(parentFeedCards)
      .where(inArray(parentFeedCards.id, idsToRemove));
  }
}
