"use server";

import { db } from "@/db";
import {
  academicTerms,
  academicCalendarEvents,
  academicYears,
} from "@/db/schema";
import { eq, and, asc, desc, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { checkAuth, getActiveAcademicYear } from "./auth-helper";

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {}
}

// ─── Academic Years ──────────────────────────────────────────────────────────

export async function getAcademicYears() {
  const session = await checkAuth();
  return await db.query.academicYears.findMany({
    where: eq(academicYears.schoolId, session.user.schoolId),
    orderBy: [desc(academicYears.startDate)],
  });
}

export async function saveAcademicYear(data: {
  id?: string;
  label: string;
  startDate: string;
  endDate: string;
  isActive?: boolean;
}) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);

  if (data.startDate > data.endDate) {
    throw new Error("Start date must be before or equal to end date");
  }

  const startDateObj = new Date(data.startDate);
  const endDateObj = new Date(data.endDate);

  if (data.id) {
    await db
      .update(academicYears)
      .set({
        label: data.label,
        startDate: startDateObj,
        endDate: endDateObj,
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(academicYears.id, data.id),
          eq(academicYears.schoolId, session.user.schoolId),
        ),
      );
    safeRevalidate("/academics");
    safeRevalidate("/academics/setup/calendar");
    return { success: true as const, id: data.id };
  } else {
    if (data.isActive) {
      await db
        .update(academicYears)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(academicYears.schoolId, session.user.schoolId));
    }

    const [created] = await db
      .insert(academicYears)
      .values({
        schoolId: session.user.schoolId,
        label: data.label,
        startDate: startDateObj,
        endDate: endDateObj,
        isActive: data.isActive ?? false,
      })
      .returning({ id: academicYears.id });

    safeRevalidate("/academics");
    safeRevalidate("/academics/setup/calendar");
    return { success: true as const, id: created!.id };
  }
}

export async function activateAcademicYear(id: string) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);

  const year = await db.query.academicYears.findFirst({
    where: and(
      eq(academicYears.id, id),
      eq(academicYears.schoolId, session.user.schoolId),
    ),
  });

  if (!year) {
    throw new Error("Academic year not found");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(academicYears)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(academicYears.schoolId, session.user.schoolId));

    await tx
      .update(academicYears)
      .set({ isActive: true, updatedAt: new Date() })
      .where(
        and(
          eq(academicYears.id, id),
          eq(academicYears.schoolId, session.user.schoolId),
        ),
      );
  });

  safeRevalidate("/academics");
  safeRevalidate("/academics/setup/calendar");
  return { success: true as const };
}

// ─── Academic Terms ──────────────────────────────────────────────────────────

export async function getAcademicTerms(academicYearId?: string) {
  const session = await checkAuth();
  const yearId = academicYearId || (await getActiveAcademicYear(session.user.schoolId)).id;

  return await db.query.academicTerms.findMany({
    where: and(
      eq(academicTerms.schoolId, session.user.schoolId),
      eq(academicTerms.academicYearId, yearId),
      eq(academicTerms.isActive, true),
      isNull(academicTerms.deletedAt),
    ),
    orderBy: [asc(academicTerms.sortOrder)],
  });
}

export async function saveAcademicTerm(data: {
  id?: string;
  name: string;
  startDate: string;
  endDate: string;
  sortOrder?: number;
  academicYearId?: string;
}) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  const activeYear = data.academicYearId
    ? { id: data.academicYearId }
    : await getActiveAcademicYear(session.user.schoolId);

  if (data.startDate > data.endDate) {
    throw new Error("Start date must be before or equal to end date");
  }

  if (data.id) {
    await db
      .update(academicTerms)
      .set({
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        sortOrder: data.sortOrder ?? 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(academicTerms.id, data.id),
          eq(academicTerms.schoolId, session.user.schoolId),
        ),
      );
  } else {
    await db.insert(academicTerms).values({
      schoolId: session.user.schoolId,
      academicYearId: activeYear.id,
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      sortOrder: data.sortOrder ?? 1,
    });
  }

  safeRevalidate("/academics/setup/calendar");
  safeRevalidate("/academics");
  return { success: true };
}

export async function deleteAcademicTerm(id: string) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);

  await db
    .update(academicTerms)
    .set({
      isActive: false,
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(academicTerms.id, id),
        eq(academicTerms.schoolId, session.user.schoolId),
      ),
    );

  safeRevalidate("/academics/setup/calendar");
  return { success: true };
}

// ─── Academic Calendar Events (AMS-only, Rule #1) ───────────────────────────

export async function getCalendarEvents(academicYearId?: string) {
  const session = await checkAuth();
  const yearId = academicYearId || (await getActiveAcademicYear(session.user.schoolId)).id;

  return await db.query.academicCalendarEvents.findMany({
    where: and(
      eq(academicCalendarEvents.schoolId, session.user.schoolId),
      eq(academicCalendarEvents.academicYearId, yearId),
      eq(academicCalendarEvents.isActive, true),
      isNull(academicCalendarEvents.deletedAt),
    ),
    with: {
      term: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [asc(academicCalendarEvents.startDate)],
  });
}

export async function saveCalendarEvent(data: {
  id?: string;
  title: string;
  eventType:
    | "HOLIDAY"
    | "EVENT"
    | "EXAM"
    | "PTM"
    | "SPORTS"
    | "CULTURAL"
    | "WORKING_SATURDAY"
    | "VACATION";
  startDate: string;
  endDate: string;
  description?: string | null;
  isWorkingDay?: boolean;
  termId?: string | null;
  academicYearId?: string;
}) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  const activeYear = data.academicYearId
    ? { id: data.academicYearId }
    : await getActiveAcademicYear(session.user.schoolId);

  if (data.startDate > data.endDate) {
    throw new Error("Start date must be before or equal to end date");
  }

  // If termId provided, verify it belongs to this school
  if (data.termId) {
    const term = await db.query.academicTerms.findFirst({
      where: and(
        eq(academicTerms.id, data.termId),
        eq(academicTerms.schoolId, session.user.schoolId),
      ),
    });
    if (!term) throw new Error("Invalid academic term selected");
  }

  const termIdVal = data.termId || null;
  const descriptionVal = data.description || null;

  if (data.id) {
    await db
      .update(academicCalendarEvents)
      .set({
        title: data.title,
        eventType: data.eventType,
        startDate: data.startDate,
        endDate: data.endDate,
        description: descriptionVal,
        isWorkingDay: data.isWorkingDay ?? false,
        termId: termIdVal,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(academicCalendarEvents.id, data.id),
          eq(academicCalendarEvents.schoolId, session.user.schoolId),
        ),
      );
  } else {
    await db.insert(academicCalendarEvents).values({
      schoolId: session.user.schoolId,
      academicYearId: activeYear.id,
      termId: termIdVal,
      title: data.title,
      eventType: data.eventType,
      startDate: data.startDate,
      endDate: data.endDate,
      description: descriptionVal,
      isWorkingDay: data.isWorkingDay ?? false,
    });
  }

  safeRevalidate("/academics/setup/calendar");
  return { success: true };
}

export async function archiveCalendarEvent(id: string) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);

  await db
    .update(academicCalendarEvents)
    .set({
      isActive: false,
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(academicCalendarEvents.id, id),
        eq(academicCalendarEvents.schoolId, session.user.schoolId),
      ),
    );

  safeRevalidate("/academics/setup/calendar");
  return { success: true };
}
