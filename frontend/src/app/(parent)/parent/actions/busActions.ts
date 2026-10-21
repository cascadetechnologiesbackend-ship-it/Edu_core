"use server";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import {
  studentBusPasses,
  stopChangeRequests,
  routeStops,
  students,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { dispatchParentNotification } from "@/lib/parentEventEngine/notificationMatrix";

export interface RequestStopChangeInput {
  studentId: string;
  busPassId: string;
  requestedStopId: string;
  reason: string;
}

export interface StopChangeItem {
  id: string;
  studentId: string;
  busPassId: string;
  requestedStopId: string;
  requestedStopName: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  effectiveDate: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
}

/**
 * Parent Action: Requests a change of bus stop (Workflow OP5).
 */
export async function requestStopChange(
  input: RequestStopChangeInput
): Promise<{ success: boolean; requestId?: string | undefined; error?: string | undefined }> {
  try {
    const ctx = await requireAuth(["PARENT", "SCHOOL_ADMIN", "SUPER_ADMIN"] as const);
    const school = await requireSchool(ctx);

    if (!input.reason?.trim()) {
      return { success: false, error: "A reason for the stop change is required." };
    }

    return await withTenant(school.id, async () => {
      // 1. Verify student and bus pass
      const [pass] = await db
        .select()
        .from(studentBusPasses)
        .where(
          and(
            eq(studentBusPasses.id, input.busPassId),
            eq(studentBusPasses.studentId, input.studentId),
            eq(studentBusPasses.schoolId, school.id),
            eq(studentBusPasses.isActive, true)
          )
        );

      if (!pass) {
        return { success: false, error: "Active bus pass not found for student." };
      }

      // If parent, verify ownership
      if (ctx.role === "PARENT") {
        const [student] = await db
          .select({ primaryParentUserId: students.primaryParentUserId })
          .from(students)
          .where(and(eq(students.id, input.studentId), eq(students.schoolId, school.id)));

        if (!student || student.primaryParentUserId !== ctx.userId) {
          return { success: false, error: "Forbidden: Not authorized for this student." };
        }
      }

      // 2. Verify requested stop belongs to the same route
      const [newStop] = await db
        .select()
        .from(routeStops)
        .where(
          and(
            eq(routeStops.id, input.requestedStopId),
            eq(routeStops.routeId, pass.routeId),
            eq(routeStops.schoolId, school.id)
          )
        );

      if (!newStop) {
        return { success: false, error: "Requested stop does not belong to the student's assigned route." };
      }

      // 3. Insert Stop Change Request
      const [inserted] = await db
        .insert(stopChangeRequests)
        .values({
          schoolId: school.id,
          studentId: input.studentId,
          parentUserId: ctx.userId,
          busPassId: input.busPassId,
          requestedStopId: input.requestedStopId,
          reason: input.reason.trim(),
          status: "PENDING",
        })
        .returning();

      revalidatePath("/parent/dashboard");
      revalidatePath("/parent/bus");
      revalidatePath("/parent/more");

      return { success: true, requestId: inserted?.id };
    });
  } catch (error: any) {
    console.error("[requestStopChange] Error:", error);
    return { success: false, error: error?.message || "Failed to submit stop change request." };
  }
}

/**
 * Parent Action: Retrieves all stop change requests for a student.
 */
export async function getStopChangeRequests(
  studentId: string
): Promise<{ success: boolean; requests: StopChangeItem[]; error?: string }> {
  try {
    const ctx = await requireAuth(["PARENT", "SCHOOL_ADMIN", "TRANSPORT_MANAGER", "SUPER_ADMIN"] as const);
    const school = await requireSchool(ctx);

    return await withTenant(school.id, async () => {
      const rows = await db
        .select({
          req: stopChangeRequests,
          stop: routeStops,
        })
        .from(stopChangeRequests)
        .leftJoin(routeStops, eq(stopChangeRequests.requestedStopId, routeStops.id))
        .where(
          and(
            eq(stopChangeRequests.studentId, studentId),
            eq(stopChangeRequests.schoolId, school.id)
          )
        )
        .orderBy(desc(stopChangeRequests.createdAt));

      const requests: StopChangeItem[] = rows.map(({ req, stop }) => ({
        id: req.id,
        studentId: req.studentId,
        busPassId: req.busPassId,
        requestedStopId: req.requestedStopId,
        requestedStopName: stop?.stopName || "Requested Stop",
        reason: req.reason,
        status: req.status as any,
        effectiveDate: req.effectiveDate ? req.effectiveDate.toISOString() : null,
        decisionNote: req.decisionNote || null,
        decidedAt: req.decidedAt ? req.decidedAt.toISOString() : null,
        createdAt: req.createdAt.toISOString(),
      }));

      return { success: true, requests };
    });
  } catch (error: any) {
    console.error("[getStopChangeRequests] Error:", error);
    return { success: false, requests: [], error: error?.message || "Failed to load requests." };
  }
}

/**
 * Admin / Transport Manager Action: Decides a stop change request (OP5).
 */
export async function decideStopChangeRequest(input: {
  requestId: string;
  status: "APPROVED" | "REJECTED";
  effectiveDate?: string;
  decisionNote?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const ctx = await requireAuth([
      "TRANSPORT_MANAGER",
      "SCHOOL_ADMIN",
      "PRINCIPAL",
      "SUPER_ADMIN",
    ] as const);
    const school = await requireSchool(ctx);

    return await withTenant(school.id, async () => {
      const [req] = await db
        .select()
        .from(stopChangeRequests)
        .where(
          and(
            eq(stopChangeRequests.id, input.requestId),
            eq(stopChangeRequests.schoolId, school.id)
          )
        );

      if (!req) {
        return { success: false, error: "Stop change request not found." };
      }

      const now = new Date();
      const effective = input.effectiveDate ? new Date(input.effectiveDate) : now;

      // 1. Update request status
      await db
        .update(stopChangeRequests)
        .set({
          status: input.status,
          effectiveDate: input.status === "APPROVED" ? effective : null,
          decidedByUserId: ctx.userId,
          decisionNote: input.decisionNote?.trim() || null,
          decidedAt: now,
          updatedAt: now,
        })
        .where(eq(stopChangeRequests.id, req.id));

      // 2. If approved and effective immediately or today, update student's bus pass
      if (input.status === "APPROVED" && effective.getTime() <= now.getTime()) {
        await db
          .update(studentBusPasses)
          .set({
            routeStopId: req.requestedStopId,
            updatedAt: now,
          })
          .where(
            and(
              eq(studentBusPasses.id, req.busPassId),
              eq(studentBusPasses.schoolId, school.id)
            )
          );
      }

      // 3. Dispatch parent notification
      try {
        await dispatchParentNotification(
          school.id,
          {
            studentId: req.studentId,
            parentUserId: req.parentUserId,
            tier: "T2_informational",
            eventKind: "STOP_CHANGE_DECIDED",
            now,
            todayPushCountForParent: 0,
            previouslyDispatchedDedupeKeys: new Set(),
          },
          {
            title: input.status === "APPROVED" ? "Bus Stop Change Approved" : "Bus Stop Change Update",
            body: input.status === "APPROVED"
              ? `Your request to change bus stop has been approved.`
              : `Your request was not approved: ${input.decisionNote || "Please contact transport manager."}`,
          }
        );
      } catch {
        // Non-blocking notification dispatch
      }

      revalidatePath("/parent/dashboard");
      revalidatePath("/parent/bus");
      revalidatePath("/parent/more");

      return { success: true };
    });
  } catch (error: any) {
    console.error("[decideStopChangeRequest] Error:", error);
    return { success: false, error: error?.message || "Failed to decide stop change request." };
  }
}
