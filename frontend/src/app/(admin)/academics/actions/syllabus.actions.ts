"use server";

import { db } from "@/db";
import {
  syllabusUnits,
  syllabusChapters,
  syllabusTopics,
  lessonPlans,
  classSubjects,
} from "@/db/schema";
import { eq, and, asc, isNull, inArray, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  checkAuth,
  verifyTeacherAccessToClassSubject,
  calculateSyllabusProgress,
} from "./auth-helper";

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {}
}

// ─── 1. Syllabus Units ────────────────────────────────────────────────────────

export async function getSyllabusUnits(classSubjectId: string) {
  const session = await checkAuth();
  await verifyTeacherAccessToClassSubject(session, classSubjectId);

  return await db.query.syllabusUnits.findMany({
    where: and(
      eq(syllabusUnits.schoolId, session.user.schoolId),
      eq(syllabusUnits.classSubjectId, classSubjectId),
      eq(syllabusUnits.isActive, true),
      isNull(syllabusUnits.deletedAt),
    ),
    with: {
      term: { columns: { id: true, name: true } },
      chapters: {
        where: and(
          eq(syllabusChapters.isActive, true),
          isNull(syllabusChapters.deletedAt),
        ),
        orderBy: [asc(syllabusChapters.sortOrder)],
        with: {
          topics: {
            where: and(
              eq(syllabusTopics.isActive, true),
              isNull(syllabusTopics.deletedAt),
            ),
            orderBy: [asc(syllabusTopics.sortOrder)],
          },
        },
      },
    },
    orderBy: [asc(syllabusUnits.sortOrder)],
  });
}

export async function saveSyllabusUnit(data: {
  id?: string;
  classSubjectId: string;
  academicTermId?: string | null;
  name: string;
  description?: string | null;
  sortOrder?: number;
}) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"]);
  await verifyTeacherAccessToClassSubject(session, data.classSubjectId);

  const academicTermIdVal = data.academicTermId || null;
  const descriptionVal = data.description || null;

  if (data.id) {
    await db
      .update(syllabusUnits)
      .set({
        name: data.name,
        academicTermId: academicTermIdVal,
        description: descriptionVal,
        sortOrder: data.sortOrder ?? 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(syllabusUnits.id, data.id),
          eq(syllabusUnits.schoolId, session.user.schoolId),
        ),
      );
  } else {
    await db.insert(syllabusUnits).values({
      schoolId: session.user.schoolId,
      classSubjectId: data.classSubjectId,
      academicTermId: academicTermIdVal,
      name: data.name,
      description: descriptionVal,
      sortOrder: data.sortOrder ?? 1,
    });
  }

  safeRevalidate("/academics");
  return { success: true };
}

export async function archiveSyllabusUnit(id: string, force = false) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"]);

  const unit = await db.query.syllabusUnits.findFirst({
    where: and(
      eq(syllabusUnits.id, id),
      eq(syllabusUnits.schoolId, session.user.schoolId),
    ),
    with: {
      chapters: {
        with: { topics: true },
      },
    },
  });
  if (!unit) throw new Error("Syllabus unit not found");

  await verifyTeacherAccessToClassSubject(session, unit.classSubjectId);

  // Collect all topic IDs in this unit
  const topicIds = unit.chapters.flatMap((c) => c.topics.map((t) => t.id));
  if (topicIds.length > 0) {
    const linkedPlans = await db
      .select({ c: count() })
      .from(lessonPlans)
      .where(inArray(lessonPlans.syllabusTopicId, topicIds));
    const refCount = Number(linkedPlans[0]?.c ?? 0);

    if (refCount > 0 && !force) {
      return {
        success: false,
        referenced: true,
        count: refCount,
        message: `This unit has ${refCount} linked lesson plan(s). Confirm archiving to proceed.`,
      };
    }
  }

  // Soft delete unit, chapters, and topics
  const now = new Date();
  await db.transaction(async (tx) => {
    if (topicIds.length > 0) {
      await tx
        .update(syllabusTopics)
        .set({ isActive: false, deletedAt: now, updatedAt: now })
        .where(inArray(syllabusTopics.id, topicIds));
    }
    const chapterIds = unit.chapters.map((c) => c.id);
    if (chapterIds.length > 0) {
      await tx
        .update(syllabusChapters)
        .set({ isActive: false, deletedAt: now, updatedAt: now })
        .where(inArray(syllabusChapters.id, chapterIds));
    }
    await tx
      .update(syllabusUnits)
      .set({ isActive: false, deletedAt: now, updatedAt: now })
      .where(eq(syllabusUnits.id, id));
  });

  safeRevalidate("/academics");
  return { success: true, referenced: false };
}

export async function restoreSyllabusUnit(id: string) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"]);

  const unit = await db.query.syllabusUnits.findFirst({
    where: and(
      eq(syllabusUnits.id, id),
      eq(syllabusUnits.schoolId, session.user.schoolId),
    ),
  });
  if (!unit) throw new Error("Syllabus unit not found");

  await verifyTeacherAccessToClassSubject(session, unit.classSubjectId);

  await db
    .update(syllabusUnits)
    .set({ isActive: true, deletedAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(syllabusUnits.id, id),
        eq(syllabusUnits.schoolId, session.user.schoolId),
      ),
    );

  safeRevalidate("/academics");
  return { success: true };
}

// ─── 2. Syllabus Chapters ─────────────────────────────────────────────────────

export async function getSyllabusChapters(unitId: string) {
  const session = await checkAuth();

  return await db.query.syllabusChapters.findMany({
    where: and(
      eq(syllabusChapters.schoolId, session.user.schoolId),
      eq(syllabusChapters.unitId, unitId),
      eq(syllabusChapters.isActive, true),
      isNull(syllabusChapters.deletedAt),
    ),
    with: {
      topics: {
        where: and(
          eq(syllabusTopics.isActive, true),
          isNull(syllabusTopics.deletedAt),
        ),
        orderBy: [asc(syllabusTopics.sortOrder)],
      },
    },
    orderBy: [asc(syllabusChapters.sortOrder)],
  });
}

export async function saveSyllabusChapter(data: {
  id?: string;
  unitId: string;
  name: string;
  ncertReference?: string | null;
  sortOrder?: number;
}) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"]);

  const unit = await db.query.syllabusUnits.findFirst({
    where: and(
      eq(syllabusUnits.id, data.unitId),
      eq(syllabusUnits.schoolId, session.user.schoolId),
    ),
  });
  if (!unit) throw new Error("Parent syllabus unit not found");

  await verifyTeacherAccessToClassSubject(session, unit.classSubjectId);

  const ncertReferenceVal = data.ncertReference || null;

  if (data.id) {
    await db
      .update(syllabusChapters)
      .set({
        name: data.name,
        ncertReference: ncertReferenceVal,
        sortOrder: data.sortOrder ?? 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(syllabusChapters.id, data.id),
          eq(syllabusChapters.schoolId, session.user.schoolId),
        ),
      );
  } else {
    await db.insert(syllabusChapters).values({
      schoolId: session.user.schoolId,
      unitId: data.unitId,
      name: data.name,
      ncertReference: ncertReferenceVal,
      sortOrder: data.sortOrder ?? 1,
    });
  }

  safeRevalidate("/academics");
  return { success: true };
}

export async function archiveSyllabusChapter(id: string, force = false) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"]);

  const chapter = await db.query.syllabusChapters.findFirst({
    where: and(
      eq(syllabusChapters.id, id),
      eq(syllabusChapters.schoolId, session.user.schoolId),
    ),
    with: {
      topics: true,
      unit: true,
    },
  });
  if (!chapter) throw new Error("Syllabus chapter not found");

  await verifyTeacherAccessToClassSubject(session, chapter.unit.classSubjectId);

  const topicIds = chapter.topics.map((t) => t.id);
  if (topicIds.length > 0) {
    const linkedPlans = await db
      .select({ c: count() })
      .from(lessonPlans)
      .where(inArray(lessonPlans.syllabusTopicId, topicIds));
    const refCount = Number(linkedPlans[0]?.c ?? 0);

    if (refCount > 0 && !force) {
      return {
        success: false,
        referenced: true,
        count: refCount,
        message: `This chapter has ${refCount} linked lesson plan(s). Confirm archiving to proceed.`,
      };
    }
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    if (topicIds.length > 0) {
      await tx
        .update(syllabusTopics)
        .set({ isActive: false, deletedAt: now, updatedAt: now })
        .where(inArray(syllabusTopics.id, topicIds));
    }
    await tx
      .update(syllabusChapters)
      .set({ isActive: false, deletedAt: now, updatedAt: now })
      .where(eq(syllabusChapters.id, id));
  });

  safeRevalidate("/academics");
  return { success: true, referenced: false };
}

export async function restoreSyllabusChapter(id: string) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"]);

  const chapter = await db.query.syllabusChapters.findFirst({
    where: and(
      eq(syllabusChapters.id, id),
      eq(syllabusChapters.schoolId, session.user.schoolId),
    ),
    with: { unit: true },
  });
  if (!chapter) throw new Error("Syllabus chapter not found");

  await verifyTeacherAccessToClassSubject(session, chapter.unit.classSubjectId);

  const now = new Date();
  await db.transaction(async (tx) => {
    // If the parent unit is archived, safely restore it as well
    if (!chapter.unit.isActive || chapter.unit.deletedAt) {
      await tx
        .update(syllabusUnits)
        .set({ isActive: true, deletedAt: null, updatedAt: now })
        .where(eq(syllabusUnits.id, chapter.unitId));
    }
    await tx
      .update(syllabusChapters)
      .set({ isActive: true, deletedAt: null, updatedAt: now })
      .where(eq(syllabusChapters.id, id));
  });

  safeRevalidate("/academics");
  return { success: true };
}

// ─── 3. Syllabus Topics ───────────────────────────────────────────────────────

export async function getSyllabusTopics(chapterId: string) {
  const session = await checkAuth();

  return await db.query.syllabusTopics.findMany({
    where: and(
      eq(syllabusTopics.schoolId, session.user.schoolId),
      eq(syllabusTopics.chapterId, chapterId),
      eq(syllabusTopics.isActive, true),
      isNull(syllabusTopics.deletedAt),
    ),
    orderBy: [asc(syllabusTopics.sortOrder)],
  });
}

export async function saveSyllabusTopic(data: {
  id?: string;
  chapterId: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
  estimatedPeriods?: number;
}) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"]);

  const chapter = await db.query.syllabusChapters.findFirst({
    where: and(
      eq(syllabusChapters.id, data.chapterId),
      eq(syllabusChapters.schoolId, session.user.schoolId),
    ),
    with: { unit: true },
  });
  if (!chapter) throw new Error("Parent syllabus chapter not found");

  await verifyTeacherAccessToClassSubject(session, chapter.unit.classSubjectId);

  const descriptionVal = data.description || null;

  if (data.id) {
    await db
      .update(syllabusTopics)
      .set({
        name: data.name,
        description: descriptionVal,
        sortOrder: data.sortOrder ?? 1,
        estimatedPeriods: data.estimatedPeriods ?? 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(syllabusTopics.id, data.id),
          eq(syllabusTopics.schoolId, session.user.schoolId),
        ),
      );
  } else {
    await db.insert(syllabusTopics).values({
      schoolId: session.user.schoolId,
      chapterId: data.chapterId,
      name: data.name,
      description: descriptionVal,
      sortOrder: data.sortOrder ?? 1,
      estimatedPeriods: data.estimatedPeriods ?? 1,
    });
  }

  safeRevalidate("/academics");
  return { success: true };
}

export async function archiveSyllabusTopic(id: string, force = false) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"]);

  const topic = await db.query.syllabusTopics.findFirst({
    where: and(
      eq(syllabusTopics.id, id),
      eq(syllabusTopics.schoolId, session.user.schoolId),
    ),
    with: {
      chapter: {
        with: { unit: true },
      },
    },
  });
  if (!topic) throw new Error("Syllabus topic not found");

  await verifyTeacherAccessToClassSubject(session, topic.chapter.unit.classSubjectId);

  const linkedPlans = await db
    .select({ c: count() })
    .from(lessonPlans)
    .where(eq(lessonPlans.syllabusTopicId, id));
  const refCount = Number(linkedPlans[0]?.c ?? 0);

  if (refCount > 0 && !force) {
    return {
      success: false,
      referenced: true,
      count: refCount,
      message: `This topic is linked to ${refCount} lesson plan(s). Confirm archiving to proceed.`,
    };
  }

  await db
    .update(syllabusTopics)
    .set({
      isActive: false,
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(syllabusTopics.id, id),
        eq(syllabusTopics.schoolId, session.user.schoolId),
      ),
    );

  safeRevalidate("/academics");
  return { success: true, referenced: false };
}

export async function restoreSyllabusTopic(id: string) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"]);

  const topic = await db.query.syllabusTopics.findFirst({
    where: and(
      eq(syllabusTopics.id, id),
      eq(syllabusTopics.schoolId, session.user.schoolId),
    ),
    with: {
      chapter: {
        with: { unit: true },
      },
    },
  });
  if (!topic) throw new Error("Syllabus topic not found");

  await verifyTeacherAccessToClassSubject(session, topic.chapter.unit.classSubjectId);

  const now = new Date();
  await db.transaction(async (tx) => {
    // If the parent unit is archived, safely restore it as well
    if (!topic.chapter.unit.isActive || topic.chapter.unit.deletedAt) {
      await tx
        .update(syllabusUnits)
        .set({ isActive: true, deletedAt: null, updatedAt: now })
        .where(eq(syllabusUnits.id, topic.chapter.unitId));
    }
    // If the parent chapter is archived, safely restore it as well
    if (!topic.chapter.isActive || topic.chapter.deletedAt) {
      await tx
        .update(syllabusChapters)
        .set({ isActive: true, deletedAt: null, updatedAt: now })
        .where(eq(syllabusChapters.id, topic.chapterId));
    }
    await tx
      .update(syllabusTopics)
      .set({ isActive: true, deletedAt: null, updatedAt: now })
      .where(eq(syllabusTopics.id, id));
  });

  safeRevalidate("/academics");
  return { success: true };
}
