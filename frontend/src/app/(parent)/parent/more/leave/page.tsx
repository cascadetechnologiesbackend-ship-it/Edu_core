export const dynamic = "force-dynamic";

import React from "react";
import { getCachedSession } from "@/lib/serverAuth";
import { redirect } from "next/navigation";
import { resolveParentWards } from "@/lib/parentEventEngine/resolveParentWards";
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

  const wards = await resolveParentWards(session.user, schoolId, searchParams?.studentId);

  if (wards.length === 0) {
    return (
      <div className="p-6 text-center space-y-2">
        <h2 className="text-base font-bold text-slate-100">No Student Records Found</h2>
        <p className="text-xs text-slate-400">
          No active students are linked to your guardian account. Please contact the school.
        </p>
      </div>
    );
  }

  const safeWards = wards.map((w) => ({
    id: w.id,
    name: w.fullName,
  }));

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
