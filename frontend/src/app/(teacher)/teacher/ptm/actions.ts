"use server";

import { db, withTenant } from "@/db";
import {
  ptmEvents,
  ptmSlots,
  ptmBookings,
  events,
  classes,
  users,
  students,
} from "@/db/schema";
import { eq, and, desc, asc, inArray, sql } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { revalidatePath } from "next/cache";
import { decryptData } from "@/lib/encryption";

export interface PublishPTMSlotsInput {
  eventId: string;
  classId?: string;
  teacherUserId?: string; // defaults to caller if teacher
  venue?: string;
  bookingOpensAt: string; // ISO string
  bookingClosesAt: string; // ISO string
  slotMinutes?: number; // default 10
  slots: {
    startAt: string; // ISO string
    endAt: string;   // ISO string
  }[];
}

export interface TeacherPTMSlotItem {
  id: string;
  ptmEventId: string;
  startAt: string;
  endAt: string;
  status: "FREE" | "BOOKED" | "BLOCKED";
  version: number;
  booking?: {
    id: string;
    studentId: string;
    studentName: string;
    parentUserId: string;
    status: "BOOKED" | "HELD" | "CANCELLED";
    bookedAt: string;
    teacherNote?: string | null;
  } | null;
}

/**
 * Publish PTM Event slot inventory (Admin & Teacher workflow OP4)
 */
export async function publishPTMSlots(input: PublishPTMSlotsInput) {
  const ctx = await requireAuth(["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN", "PRINCIPAL"] as const);
  const school = await requireSchool(ctx);
  const teacherId = input.teacherUserId || ctx.userId;

  if (!input.eventId || !input.bookingOpensAt || !input.bookingClosesAt || !input.slots?.length) {
    return { success: false, error: "Please provide event ID, booking window, and at least one slot." };
  }

  const opensAt = new Date(input.bookingOpensAt);
  const closesAt = new Date(input.bookingClosesAt);
  const slotMinutes = input.slotMinutes ?? 10;

  if (isNaN(opensAt.getTime()) || isNaN(closesAt.getTime())) {
    return { success: false, error: "Invalid booking window date format." };
  }

  if (opensAt >= closesAt) {
    return { success: false, error: "Booking opens time must be before closes time." };
  }

  return await withTenant(school.id, async (tx) => {
    // 1. Create or update ptm_events entry
    const [ptmEvent] = await tx
      .insert(ptmEvents)
      .values({
        schoolId: school.id,
        eventId: input.eventId,
        classId: input.classId || null,
        teacherUserId: teacherId,
        venue: input.venue?.trim() || null,
        bookingOpensAt: opensAt,
        bookingClosesAt: closesAt,
        slotMinutes,
      })
      .returning({ id: ptmEvents.id });

    if (!ptmEvent) {
      return { success: false, error: "Failed to create PTM event." };
    }

    // 2. Insert slot inventory
    const slotValues = input.slots.map((s) => ({
      schoolId: school.id,
      ptmEventId: ptmEvent.id,
      teacherUserId: teacherId,
      startAt: new Date(s.startAt),
      endAt: new Date(s.endAt),
      status: "FREE" as const,
      version: 1,
    }));

    await tx.insert(ptmSlots).values(slotValues);

    revalidatePath("/parent/dashboard");
    revalidatePath("/teacher/ptm");

    return {
      success: true,
      ptmEventId: ptmEvent.id,
      slotsCreated: slotValues.length,
      message: `Published ${slotValues.length} PTM slots successfully.`,
    };
  });
}

/**
 * Fetch a teacher's PTM slots and bookings for an event (Surface p7)
 */
export async function getTeacherPTMSlots(ptmEventId: string): Promise<TeacherPTMSlotItem[]> {
  const ctx = await requireAuth(["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN", "PRINCIPAL"] as const);
  const school = await requireSchool(ctx);

  return await withTenant(school.id, async (tx) => {
    // 1. Fetch slots for event
    const slots = await tx
      .select()
      .from(ptmSlots)
      .where(and(eq(ptmSlots.ptmEventId, ptmEventId), eq(ptmSlots.schoolId, school.id)))
      .orderBy(asc(ptmSlots.startAt));

    if (slots.length === 0) return [];

    const slotIds = slots.map((s) => s.id);

    // 2. Fetch bookings for these slots
    const bookings = await tx
      .select({
        id: ptmBookings.id,
        slotId: ptmBookings.slotId,
        studentId: ptmBookings.studentId,
        parentUserId: ptmBookings.parentUserId,
        status: ptmBookings.status,
        bookedAt: ptmBookings.bookedAt,
        teacherNote: ptmBookings.teacherNote,
        studentFirstNameEncrypted: students.firstNameEncrypted,
        studentLastNameEncrypted: students.lastNameEncrypted,
      })
      .from(ptmBookings)
      .innerJoin(students, eq(ptmBookings.studentId, students.id))
      .where(
        and(
          inArray(ptmBookings.slotId, slotIds),
          eq(ptmBookings.schoolId, school.id),
          inArray(ptmBookings.status, ["BOOKED", "HELD"])
        )
      );

    const bookingBySlot = new Map<string, typeof bookings[0]>();
    for (const b of bookings) {
      bookingBySlot.set(b.slotId, b);
    }

    return slots.map((s) => {
      const b = bookingBySlot.get(s.id);
      let studentName = "Student";
      if (b) {
        const decryptedFirst = decryptData(b.studentFirstNameEncrypted) || "Student";
        const decryptedLast = b.studentLastNameEncrypted ? decryptData(b.studentLastNameEncrypted) || "" : "";
        studentName = `${decryptedFirst} ${decryptedLast}`.trim();
      }

      return {
        id: s.id,
        ptmEventId: s.ptmEventId,
        startAt: new Date(s.startAt).toISOString(),
        endAt: new Date(s.endAt).toISOString(),
        status: s.status as "FREE" | "BOOKED" | "BLOCKED",
        version: s.version,
        booking: b
          ? {
              id: b.id,
              studentId: b.studentId,
              studentName,
              parentUserId: b.parentUserId,
              status: b.status as "BOOKED" | "HELD",
              bookedAt: new Date(b.bookedAt).toISOString(),
              teacherNote: b.teacherNote,
            }
          : null,
      };
    });
  });
}

/**
 * Mark a PTM slot as HELD with optional meeting notes (Teacher workflow OP4)
 */
export async function markPTMSlotHeld(bookingId: string, teacherNote?: string) {
  const ctx = await requireAuth(["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN", "PRINCIPAL"] as const);
  const school = await requireSchool(ctx);

  return await withTenant(school.id, async (tx) => {
    const [booking] = await tx
      .select()
      .from(ptmBookings)
      .where(and(eq(ptmBookings.id, bookingId), eq(ptmBookings.schoolId, school.id)))
      .limit(1);

    if (!booking) {
      return { success: false, error: "Booking not found." };
    }

    if (booking.status !== "BOOKED") {
      return { success: false, error: "Only active booked slots can be marked held." };
    }

    await tx
      .update(ptmBookings)
      .set({
        status: "HELD",
        teacherNote: teacherNote?.trim() || null,
      })
      .where(and(eq(ptmBookings.id, bookingId), eq(ptmBookings.schoolId, school.id)));

    revalidatePath("/parent/dashboard");
    revalidatePath("/teacher/ptm");

    return {
      success: true,
      message: "PTM meeting marked as completed.",
    };
  });
}
