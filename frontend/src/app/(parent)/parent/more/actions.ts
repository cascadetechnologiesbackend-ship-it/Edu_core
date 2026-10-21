"use server";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import {
  students,
  studentLeaveRequests,
  feeQueries,
  feeInvoices,
  stopChangeRequests,
  routeStops,
  studentDocumentRequests,
  profileChangeRequests,
  ptmBookings,
  ptmSlots,
  ptmEvents,
} from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";

export type WorkflowType =
  | "leave"
  | "fee_query"
  | "stop_change"
  | "document"
  | "profile"
  | "ptm";

export type StatusCategory = "PENDING" | "APPROVED" | "REJECTED";

export interface UnifiedWorkflowItem {
  id: string;
  type: WorkflowType;
  typeName: string;
  studentId: string;
  studentName: string;
  title: string;
  description: string;
  status: string;
  statusCategory: StatusCategory;
  note?: string | null | undefined;
  createdAt: string;
  actionLabel?: string | undefined;
  actionHref?: string | undefined;
}

export interface UnifiedWorkflowsResult {
  success: boolean;
  items: UnifiedWorkflowItem[];
  wards: Array<{ id: string; name: string }>;
  error?: string | undefined;
}

/**
 * Surface P6: Workflows Hub Data Provider
 * Fetches every parent-initiated workflow request chronologically with live status chips.
 */
export async function getUnifiedParentWorkflows(
  filterStudentId?: string
): Promise<UnifiedWorkflowsResult> {
  try {
    const ctx = await requireAuth([
      "PARENT",
      "SUPER_ADMIN",
      "SCHOOL_ADMIN",
      "PRINCIPAL",
    ] as const);
    const school = await requireSchool(ctx);

    return await withTenant(school.id, async (tx) => {
      // 1. Identify active wards for this parent or preview context
      const studentWhere =
        ctx.role === "PARENT"
          ? and(
              eq(students.schoolId, school.id),
              eq(students.primaryParentUserId, ctx.userId),
              eq(students.isActive, true)
            )
          : and(eq(students.schoolId, school.id), eq(students.isActive, true));

      let wardRows = await tx.query.students.findMany({
        where: studentWhere,
        ...(ctx.role !== "PARENT" ? { limit: 10 } : {}),
      });

      if (wardRows.length === 0) {
        return { success: true, items: [], wards: [] };
      }

      // Map ward names
      const wardMap = new Map<string, string>();
      const wardsList: Array<{ id: string; name: string }> = [];

      for (const w of wardRows) {
        let name = `Student ${w.admissionNumber}`;
        if (w.firstNameEncrypted) {
          try {
            const first = decryptData(w.firstNameEncrypted);
            const last = w.lastNameEncrypted ? decryptData(w.lastNameEncrypted) : "";
            name = `${first} ${last}`.trim();
          } catch {
            // fallback
          }
        }
        wardMap.set(w.id, name);
        wardsList.push({ id: w.id, name });
      }

      // Determine target student IDs
      let targetStudentIds = wardRows.map((w) => w.id);
      if (filterStudentId && filterStudentId !== "all") {
        targetStudentIds = targetStudentIds.filter((id) => id === filterStudentId);
      }

      if (targetStudentIds.length === 0) {
        return { success: true, items: [], wards: wardsList };
      }

      const items: UnifiedWorkflowItem[] = [];

      // ─── A. Leave Requests (OP1) ──────────────────────────────────────────
      const leaveRows = await tx.query.studentLeaveRequests.findMany({
        where: and(
          eq(studentLeaveRequests.schoolId, school.id),
          inArray(studentLeaveRequests.studentId, targetStudentIds)
        ),
        orderBy: [desc(studentLeaveRequests.createdAt)],
      });

      for (const lr of leaveRows) {
        const startStr = new Date(lr.startDate).toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
        });
        const endStr = new Date(lr.endDate).toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
        });

        const statusCategory: StatusCategory =
          lr.status === "APPROVED"
            ? "APPROVED"
            : lr.status === "REJECTED"
            ? "REJECTED"
            : "PENDING";

        items.push({
          id: lr.id,
          type: "leave",
          typeName: "Leave Request",
          studentId: lr.studentId,
          studentName: wardMap.get(lr.studentId) || "Student",
          title: `Leave: ${startStr} - ${endStr}`,
          description: lr.reason,
          status: lr.status,
          statusCategory,
          note: lr.decisionNote,
          createdAt: new Date(lr.createdAt).toISOString(),
          actionLabel: "View Details",
          actionHref: "/parent/more/leave",
        });
      }

      // ─── B. Fee Queries (OP2 & Phase P12) ─────────────────────────────────
      const feeQueryRows = await tx.query.feeQueries.findMany({
        where: and(
          eq(feeQueries.schoolId, school.id),
          inArray(feeQueries.studentId, targetStudentIds)
        ),
        orderBy: [desc(feeQueries.createdAt)],
      });

      for (const fq of feeQueryRows) {
        const statusCategory: StatusCategory =
          fq.status === "RESOLVED"
            ? "APPROVED"
            : fq.status === "ESCALATED"
            ? "PENDING"
            : fq.status === "ANSWERED"
            ? "APPROVED"
            : "PENDING";

        items.push({
          id: fq.id,
          type: "fee_query",
          typeName: "Fee Query",
          studentId: fq.studentId,
          studentName: wardMap.get(fq.studentId) || "Student",
          title: `Fee Query: ${fq.category}`,
          description: fq.message,
          status: fq.status,
          statusCategory,
          note: fq.answer,
          createdAt: new Date(fq.createdAt).toISOString(),
          actionLabel: "Pay & Review",
          actionHref: "/parent/fees",
        });
      }

      // ─── C. Stop Change Requests (OP5 & Phase P14) ────────────────────────
      const stopChangeRows = await tx.query.stopChangeRequests.findMany({
        where: and(
          eq(stopChangeRequests.schoolId, school.id),
          inArray(stopChangeRequests.studentId, targetStudentIds)
        ),
        orderBy: [desc(stopChangeRequests.createdAt)],
      });

      for (const scr of stopChangeRows) {
        const statusCategory: StatusCategory =
          scr.status === "APPROVED"
            ? "APPROVED"
            : scr.status === "REJECTED"
            ? "REJECTED"
            : "PENDING";

        items.push({
          id: scr.id,
          type: "stop_change",
          typeName: "Bus Stop Change",
          studentId: scr.studentId,
          studentName: wardMap.get(scr.studentId) || "Student",
          title: `Stop Change: ${scr.reason}`,
          description: scr.effectiveDate
            ? `Effective from ${new Date(scr.effectiveDate).toLocaleDateString("en-IN")}`
            : "Effective date pending",
          status: scr.status,
          statusCategory,
          note: scr.decisionNote,
          createdAt: new Date(scr.createdAt).toISOString(),
          actionLabel: "Bus Schedule",
          actionHref: "/parent/bus",
        });
      }

      // ─── D. Document Requests (OP6 & Phase P15) ───────────────────────────
      const docRows = await tx.query.studentDocumentRequests.findMany({
        where: and(
          eq(studentDocumentRequests.schoolId, school.id),
          inArray(studentDocumentRequests.studentId, targetStudentIds)
        ),
        orderBy: [desc(studentDocumentRequests.createdAt)],
      });

      for (const doc of docRows) {
        const statusCategory: StatusCategory =
          doc.status === "VERIFIED"
            ? "APPROVED"
            : doc.status === "REJECTED"
            ? "REJECTED"
            : "PENDING";

        items.push({
          id: doc.id,
          type: "document",
          typeName: "Document Submission",
          studentId: doc.studentId,
          studentName: wardMap.get(doc.studentId) || "Student",
          title: `Document: ${doc.title}`,
          description: doc.description || doc.documentType,
          status: doc.status,
          statusCategory,
          note: doc.verificationNote,
          createdAt: new Date(doc.createdAt).toISOString(),
          actionLabel: doc.status === "VERIFIED" ? "View Document" : "Upload Document",
          actionHref: "/parent/documents",
        });
      }

      // ─── E. Profile Change Requests (OP10 & Phase P15) ─────────────────────
      const profileChangeRows = await tx.query.profileChangeRequests.findMany({
        where: and(
          eq(profileChangeRequests.schoolId, school.id),
          inArray(profileChangeRequests.studentId, targetStudentIds)
        ),
        orderBy: [desc(profileChangeRequests.createdAt)],
      });

      for (const pcr of profileChangeRows) {
        const statusCategory: StatusCategory =
          pcr.status === "APPLIED"
            ? "APPROVED"
            : pcr.status === "REJECTED"
            ? "REJECTED"
            : "PENDING";

        items.push({
          id: pcr.id,
          type: "profile",
          typeName: "Profile Update",
          studentId: pcr.studentId,
          studentName: wardMap.get(pcr.studentId) || "Student",
          title: `Profile: ${pcr.field.toUpperCase()} Update`,
          description: `Requested update for student ${pcr.field} record`,
          status: pcr.status,
          statusCategory,
          note: pcr.verificationNote,
          createdAt: new Date(pcr.createdAt).toISOString(),
          actionLabel: "View Profile",
          actionHref: "/parent/profile",
        });
      }

      // ─── F. PTM Bookings (OP4 & Phase P11) ────────────────────────────────
      const ptmRows = await tx.query.ptmBookings.findMany({
        where: and(
          eq(ptmBookings.schoolId, school.id),
          inArray(ptmBookings.studentId, targetStudentIds)
        ),
        orderBy: [desc(ptmBookings.createdAt)],
      });

      for (const pb of ptmRows) {
        const statusCategory: StatusCategory =
          pb.status === "BOOKED"
            ? "APPROVED"
            : pb.status === "CANCELLED"
            ? "REJECTED"
            : "PENDING";

        items.push({
          id: pb.id,
          type: "ptm",
          typeName: "PTM Booking",
          studentId: pb.studentId,
          studentName: wardMap.get(pb.studentId) || "Student",
          title: "Parent-Teacher Meeting",
          description: pb.teacherNote || "Confirmed meeting slot",
          status: pb.status,
          statusCategory,
          createdAt: new Date(pb.createdAt).toISOString(),
          actionLabel: "View Slot",
          actionHref: "/parent/dashboard",
        });
      }

      // ─── Sort Chronologically Descending ──────────────────────────────────
      items.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return {
        success: true,
        items,
        wards: wardsList,
      };
    });
  } catch (err: any) {
    console.error("getUnifiedParentWorkflows error:", err);
    return { success: false, items: [], wards: [], error: err.message };
  }
}
