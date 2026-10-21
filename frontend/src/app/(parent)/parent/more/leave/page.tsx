export const dynamic = "force-dynamic";

import React from "react";
import { getCachedSession } from "@/lib/serverAuth";
import { redirect } from "next/navigation";
import { db, withTenant } from "@/db";
import { students } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import { getStudentLeaveRequests } from "../../actions/leaveActions";
import { ParentLeaveClient } from "./ParentLeaveClient";

export const metadata = {
  title: "Leave Requests | Parent PWA",
  description: "Apply for planned leave and view teacher approval history.",
};

interface ParentLeavePageProps {
  searchParams?: { studentId?: string };
}

export default async function ParentLeavePage({ searchParams }: ParentLeavePageProps) {
  const session = await getCachedSession();
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const schoolId = session.user.schoolId;
  if (!schoolId) {
    redirect("/auth/login");
  }

  const userId = session.user.id;
  const userRole = session.user.role || "PARENT";

  // 1. Fetch wards linked to this parent inside tenant context
  const wardRows = await withTenant(schoolId, async (tx) => {
    return await tx.query.students.findMany({
      where: and(
        eq(students.primaryParentUserId, userId),
        eq(students.schoolId, schoolId),
        eq(students.isActive, true)
      ),
      columns: {
        id: true,
        admissionNumber: true,
        firstNameEncrypted: true,
        lastNameEncrypted: true,
        currentClassId: true,
      },
    });
  });

  if (wardRows.length === 0 && userRole !== "PARENT") {
    // Admin/Teacher preview fallback
    const previewRows = await withTenant(schoolId, async (tx) => {
      return await tx.query.students.findMany({
        where: and(eq(students.schoolId, schoolId), eq(students.isActive, true)),
        limit: 5,
        columns: {
          id: true,
          admissionNumber: true,
          firstNameEncrypted: true,
          lastNameEncrypted: true,
          currentClassId: true,
        },
      });
    });
    wardRows.push(...previewRows);
  }

  if (wardRows.length === 0) {
    return (
      <div className="p-6 text-center space-y-2">
        <h2 className="text-base font-bold text-slate-100">No Student Records Found</h2>
        <p className="text-xs text-slate-400">
          No active students are linked to your guardian account. Please contact the school.
        </p>
      </div>
    );
  }

  // Decrypt names
  const safeWards = wardRows.map((w) => {
    let name = `Student ${w.admissionNumber}`;
    try {
      if (w.firstNameEncrypted) {
        const first = decryptData(w.firstNameEncrypted);
        const last = w.lastNameEncrypted ? decryptData(w.lastNameEncrypted) : "";
        name = `${first} ${last}`.trim();
      }
    } catch {
      name = `Student ${w.admissionNumber}`;
    }
    return {
      id: w.id,
      name,
    };
  });

  const selectedStudentId =
    searchParams?.studentId && safeWards.some((w) => w.id === searchParams.studentId)
      ? searchParams.studentId
      : safeWards[0]?.id || "";

  const initialRequestsRaw = selectedStudentId
    ? await getStudentLeaveRequests(selectedStudentId)
    : [];

  const initialRequests = initialRequestsRaw.map((r) => ({
    id: r.id,
    studentId: selectedStudentId,
    leaveType: r.leaveType,
    startDate: new Date(r.startDate).toISOString().slice(0, 10),
    endDate: new Date(r.endDate).toISOString().slice(0, 10),
    reason: r.reason,
    attachmentS3Key: null,
    status: r.status,
    decisionNote: r.decisionNote || null,
    decidedAt: r.decidedAt ? new Date(r.decidedAt).toISOString() : null,
    createdAt: new Date(r.createdAt).toISOString(),
  }));

  return (
    <ParentLeaveClient
      wards={safeWards}
      selectedStudentId={selectedStudentId}
      initialRequests={initialRequests}
    />
  );
}
