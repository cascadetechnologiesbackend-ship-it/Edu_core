"use server";

import { db, withTenant } from "@/db";
import { ptmEvents, ptmSlots, ptmBookings, events, classes, users, students, staff } from "@/db/schema";
import { eq, and, desc, asc, gte, lte, sql } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { revalidatePath } from "next/cache";

import { decryptData } from "@/lib/encryption";

export interface AvailablePTMSlot {
  id: string;
  startAt: string;
  endAt: string;
  status: "FREE" | "BOOKED" | "BLOCKED";
  version: number;
}

export interface PTMEventsDetails {
  id: string;
  eventId: string;
  title: string;
  venue: string | null;
  bookingOpensAt: string;
  bookingClosesAt: string;
  slotMinutes: number;
  teacherName: string;
  className?: string | null;
  isOpen: boolean;
  isUpcoming: boolean;
  isClosed: boolean;
}

/**
 * Fetch available slots and event metadata for booking (Parent workflow OP4)
 */
export async function getAvailablePTMSlots(ptmEventId: string) {
  const ctx = await requireAuth(["PARENT", "SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
  const school = await requireSchool(ctx);
  const now = new Date();

  return await withTenant(school.id, async (tx) => {
    // 1. Fetch PTM Event with master event and teacher info
    const [eventRow] = await tx
      .select({
        id: ptmEvents.id,
        eventId: ptmEvents.eventId,
        classId: ptmEvents.classId,
        teacherUserId: ptmEvents.teacherUserId,
        venue: ptmEvents.venue,
        bookingOpensAt: ptmEvents.bookingOpensAt,
        bookingClosesAt: ptmEvents.bookingClosesAt,
        slotMinutes: ptmEvents.slotMinutes,
        eventTitle: events.title,
        teacherEmail: users.email,
        teacherFirstNameEncrypted: staff.firstNameEncrypted,
        teacherLastNameEncrypted: staff.lastNameEncrypted,
      })
      .from(ptmEvents)
      .innerJoin(events, eq(ptmEvents.eventId, events.id))
      .innerJoin(users, eq(ptmEvents.teacherUserId, users.id))
      .leftJoin(staff, eq(ptmEvents.teacherUserId, staff.userId))
      .where(and(eq(ptmEvents.id, ptmEventId), eq(ptmEvents.schoolId, school.id)))
      .limit(1);

    if (!eventRow) {
      return { success: false, error: "PTM event not found." };
    }

    let resolvedTeacherName = "Class Teacher";
    if (eventRow.teacherFirstNameEncrypted) {
      try {
        const fName = decryptData(eventRow.teacherFirstNameEncrypted) || "";
        const lName = eventRow.teacherLastNameEncrypted
          ? decryptData(eventRow.teacherLastNameEncrypted) || ""
          : "";
        const full = `${fName} ${lName}`.trim();
        if (full) resolvedTeacherName = full;
      } catch {}
    } else if (eventRow.teacherEmail) {
      resolvedTeacherName = eventRow.teacherEmail.split("@")[0] || "Class Teacher";
    }

    const isOpen = now >= eventRow.bookingOpensAt && now <= eventRow.bookingClosesAt;
    const isUpcoming = now < eventRow.bookingOpensAt;
    const isClosed = now > eventRow.bookingClosesAt;

    // 2. Fetch all FREE slots for this event, ordered by start time
    const slotRows = await tx
      .select({
        id: ptmSlots.id,
        startAt: ptmSlots.startAt,
        endAt: ptmSlots.endAt,
        status: ptmSlots.status,
        version: ptmSlots.version,
      })
      .from(ptmSlots)
      .where(
        and(
          eq(ptmSlots.ptmEventId, ptmEventId),
          eq(ptmSlots.schoolId, school.id),
          eq(ptmSlots.status, "FREE")
        )
      )
      .orderBy(asc(ptmSlots.startAt));

    const eventDetails: PTMEventsDetails = {
      id: eventRow.id,
      eventId: eventRow.eventId,
      title: eventRow.eventTitle,
      venue: eventRow.venue,
      bookingOpensAt: new Date(eventRow.bookingOpensAt).toISOString(),
      bookingClosesAt: new Date(eventRow.bookingClosesAt).toISOString(),
      slotMinutes: eventRow.slotMinutes,
      teacherName: resolvedTeacherName,
      isOpen,
      isUpcoming,
      isClosed,
    };

    const slots: AvailablePTMSlot[] = slotRows.map((s) => ({
      id: s.id,
      startAt: new Date(s.startAt).toISOString(),
      endAt: new Date(s.endAt).toISOString(),
      status: s.status as "FREE",
      version: s.version,
    }));

    return {
      success: true,
      event: eventDetails,
      slots,
    };
  });
}

/**
 * Book a PTM slot with optimistic locking concurrency control (AC-P17)
 */
export async function bookPTMSlot(
  ptmEventId: string,
  slotId: string,
  studentId: string,
  expectedVersion: number
) {
  const ctx = await requireAuth(["PARENT", "SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
  const school = await requireSchool(ctx);
  const now = new Date();

  return await withTenant(school.id, async (tx) => {
    // 1. Authorization: If parent, verify student belongs to parent
    if (ctx.role === "PARENT") {
      const [studentRecord] = await tx
        .select({ id: students.id, primaryParentUserId: students.primaryParentUserId })
        .from(students)
        .where(and(eq(students.id, studentId), eq(students.schoolId, school.id)))
        .limit(1);

      if (!studentRecord || studentRecord.primaryParentUserId !== ctx.userId) {
        return { success: false, error: "You are not authorized to book for this student." };
      }
    }

    // 2. Fetch PTM event and verify booking window
    const [eventRow] = await tx
      .select()
      .from(ptmEvents)
      .where(and(eq(ptmEvents.id, ptmEventId), eq(ptmEvents.schoolId, school.id)))
      .limit(1);

    if (!eventRow) {
      return { success: false, error: "PTM event not found." };
    }

    if (now < eventRow.bookingOpensAt) {
      return { success: false, error: "Booking window is not yet open for this PTM event." };
    }

    if (now > eventRow.bookingClosesAt) {
      return { success: false, error: "Booking window is closed for this PTM event." };
    }

    // 3. Enforce single active booking invariant (AC-P17)
    // Rule: One active booking per parent per PTM event
    const [existingParentBooking] = await tx
      .select({ id: ptmBookings.id })
      .from(ptmBookings)
      .where(
        and(
          eq(ptmBookings.ptmEventId, ptmEventId),
          eq(ptmBookings.parentUserId, ctx.userId),
          eq(ptmBookings.schoolId, school.id),
          eq(ptmBookings.status, "BOOKED")
        )
      )
      .limit(1);

    if (existingParentBooking) {
      return {
        success: false,
        error: "You already have an active slot booked for this PTM event. Please cancel or reschedule your existing booking first.",
      };
    }

    // Rule: One active booking per student per PTM event
    const [existingStudentBooking] = await tx
      .select({ id: ptmBookings.id })
      .from(ptmBookings)
      .where(
        and(
          eq(ptmBookings.ptmEventId, ptmEventId),
          eq(ptmBookings.studentId, studentId),
          eq(ptmBookings.schoolId, school.id),
          eq(ptmBookings.status, "BOOKED")
        )
      )
      .limit(1);

    if (existingStudentBooking) {
      return {
        success: false,
        error: "A slot is already booked for this student.",
      };
    }

    // 4. Fetch slot to verify existence and cutoff
    const [slot] = await tx
      .select()
      .from(ptmSlots)
      .where(
        and(
          eq(ptmSlots.id, slotId),
          eq(ptmSlots.ptmEventId, ptmEventId),
          eq(ptmSlots.schoolId, school.id)
        )
      )
      .limit(1);

    if (!slot) {
      return { success: false, error: "Requested slot does not exist." };
    }

    // 12-hour booking cutoff rule: booking closes T-12h before slot start time
    const diffHours = (slot.startAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (diffHours < 12) {
      return {
        success: false,
        error: "Slots cannot be booked less than 12 hours before the meeting time.",
      };
    }

    // 5. Optimistic locking slot reservation (AC-P17)
    // Only succeeds if status is still 'FREE' and version matches expectedVersion
    const updatedSlots = await tx
      .update(ptmSlots)
      .set({
        status: "BOOKED",
        version: sql`${ptmSlots.version} + 1`,
      })
      .where(
        and(
          eq(ptmSlots.id, slotId),
          eq(ptmSlots.ptmEventId, ptmEventId),
          eq(ptmSlots.schoolId, school.id),
          eq(ptmSlots.status, "FREE"),
          eq(ptmSlots.version, expectedVersion)
        )
      )
      .returning({ id: ptmSlots.id });

    if (updatedSlots.length === 0) {
      return {
        success: false,
        conflict: true,
        error: "This slot was just booked by another parent. Please choose another time.",
      };
    }

    // 6. Insert confirmed booking record
    const [booking] = await tx
      .insert(ptmBookings)
      .values({
        schoolId: school.id,
        ptmEventId,
        slotId,
        parentUserId: ctx.userId,
        studentId,
        status: "BOOKED",
        bookedAt: now,
      })
      .returning({ id: ptmBookings.id });

    revalidatePath("/parent/dashboard");
    revalidatePath("/parent/profile");
    revalidatePath("/parent/more/ptm");

    return {
      success: true,
      bookingId: booking?.id || "",
      message: "PTM slot booked successfully.",
    };
  });
}

/**
 * Cancel an active PTM booking before T-12h cutoff (Parent workflow OP4)
 */
export async function cancelPTMBooking(bookingId: string) {
  const ctx = await requireAuth(["PARENT", "SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
  const school = await requireSchool(ctx);
  const now = new Date();

  return await withTenant(school.id, async (tx) => {
    // 1. Fetch booking with slot timing
    const [booking] = await tx
      .select({
        id: ptmBookings.id,
        slotId: ptmBookings.slotId,
        parentUserId: ptmBookings.parentUserId,
        status: ptmBookings.status,
        slotStartAt: ptmSlots.startAt,
      })
      .from(ptmBookings)
      .innerJoin(ptmSlots, eq(ptmBookings.slotId, ptmSlots.id))
      .where(and(eq(ptmBookings.id, bookingId), eq(ptmBookings.schoolId, school.id)))
      .limit(1);

    if (!booking) {
      return { success: false, error: "Booking not found." };
    }

    if (ctx.role === "PARENT" && booking.parentUserId !== ctx.userId) {
      return { success: false, error: "You are not authorized to cancel this booking." };
    }

    if (booking.status !== "BOOKED") {
      return { success: false, error: "Only active booked slots can be cancelled." };
    }

    // Cancellation window rule: parent can cancel/reschedule until T-12h
    const diffHours = (booking.slotStartAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (diffHours < 12) {
      return {
        success: false,
        error: "Bookings cannot be cancelled less than 12 hours before the meeting time.",
      };
    }

    // 2. Mark booking CANCELLED
    await tx
      .update(ptmBookings)
      .set({
        status: "CANCELLED",
        cancelledAt: now,
      })
      .where(and(eq(ptmBookings.id, bookingId), eq(ptmBookings.schoolId, school.id)));

    // 3. Return slot to inventory (status = 'FREE', bump version)
    await tx
      .update(ptmSlots)
      .set({
        status: "FREE",
        version: sql`${ptmSlots.version} + 1`,
      })
      .where(and(eq(ptmSlots.id, booking.slotId), eq(ptmSlots.schoolId, school.id)));

    revalidatePath("/parent/dashboard");
    revalidatePath("/parent/profile");
    revalidatePath("/parent/more/ptm");

    return {
      success: true,
      message: "Booking cancelled and slot returned to inventory.",
    };
  });
}
