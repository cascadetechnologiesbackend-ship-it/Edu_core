import { Metadata } from "next";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import { ptmEvents, ptmSlots, ptmBookings, events } from "@/db/schema";
import { eq, and, desc, asc, gte } from "drizzle-orm";
import { TeacherPTMClient } from "./TeacherPTMClient";
import { getTeacherPTMSlots } from "./actions";

export const metadata: Metadata = {
  title: "PTM Slot Schedule | Educator PWA",
  description: "View booked parent slots and mark meetings completed.",
};

export default async function TeacherPTMPage() {
  const ctx = await requireAuth(["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN", "PRINCIPAL"] as const);
  const school = await requireSchool(ctx);
  const now = new Date();

  let ptmEventSummaries: any[] = [];
  let initialSlots: any[] = [];
  let firstEventId = "";

  try {
    await withTenant(school.id, async (tx) => {
      const rows = await tx
        .select({
          id: ptmEvents.id,
          eventId: ptmEvents.eventId,
          venue: ptmEvents.venue,
          bookingOpensAt: ptmEvents.bookingOpensAt,
          bookingClosesAt: ptmEvents.bookingClosesAt,
          title: events.title,
          startDate: events.startDate,
        })
        .from(ptmEvents)
        .innerJoin(events, eq(ptmEvents.eventId, events.id))
        .where(
          and(
            eq(ptmEvents.schoolId, school.id),
            ctx.role === "TEACHER" ? eq(ptmEvents.teacherUserId, ctx.userId) : undefined
          )
        )
        .orderBy(asc(events.startDate))
        .limit(5);

      ptmEventSummaries = rows.map((r) => ({
        id: r.id,
        title: r.title,
        venue: r.venue,
        startDate: r.startDate.toISOString(),
        bookingOpensAt: r.bookingOpensAt.toISOString(),
        bookingClosesAt: r.bookingClosesAt.toISOString(),
      }));

      if (rows.length > 0 && rows[0]?.id) {
        firstEventId = rows[0].id;
      }
    });

    if (firstEventId) {
      initialSlots = await getTeacherPTMSlots(firstEventId);
    }
  } catch (e) {
    // If empty or error, render empty state cleanly
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
          Parent-Teacher Meeting Schedule
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Manage individual parent appointment slots and record meeting notes.
        </p>
      </div>

      <TeacherPTMClient
        events={ptmEventSummaries}
        initialEventId={firstEventId}
        initialSlots={initialSlots}
      />
    </div>
  );
}
