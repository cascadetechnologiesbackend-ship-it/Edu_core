export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import { decryptData } from "@/lib/encryption";
import {
  students,
  classes,
  sections,
  studentAttendance,
  studentBusPasses,
  routes,
  routeStops,
  feeInvoices,
  users,
} from "@/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { ChildProfileView } from "@/components/parent/ChildProfileView";
import { getSelfProfileAction } from "@/app/actions/profile";
import { UserProfileView } from "@/components/profile/UserProfileView";
import { calculateAttendanceMetrics, formatFullName } from "@/lib/utils";

export const metadata = {
  title: "Child Profile & Records | Parent Companion",
  description: "View child records, attendance, fee ledger, transport, and statutory documents.",
};

export default async function ParentProfilePage({
  searchParams,
}: {
  searchParams?: { studentId?: string; tab?: string };
}) {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "PARENT",
  ] as const);
  const school = await requireSchool(ctx);

  // If guardian profile explicitly requested
  if (searchParams?.tab === "guardian") {
    const result = await getSelfProfileAction();
    if (result.success && result.profile) {
      return (
        <div className="p-4 md:p-8">
          <UserProfileView
            initialProfile={result.profile}
            initialCompleteness={result.completeness!}
            initialReadOnlyDetails={result.readOnlyDetails}
          />
        </div>
      );
    }
  }

  // 1. Fetch all linked wards via authoritative shared resolver
  const { resolveParentWards } = await import("@schoolmitra/backend/parentEventEngine/resolveParentWards");
  const allStudents = await resolveParentWards(ctx, school.id, searchParams?.studentId);

  if (allStudents.length === 0) {
    redirect("/parent/dashboard");
  }

  // Active student
  const activeStudent =
    (searchParams?.studentId
      ? allStudents.find((s) => s.id === searchParams.studentId)
      : null) || allStudents[0]!;

  const getStudentName = (s: typeof activeStudent) => s.fullName;

  // 2. Fetch Class, Attendance, Bus Pass, Fees, and Guardian
  const data = await withTenant(school.id, async (tx) => {
    // Class and Section
    let className = "Class";
    let sectionName = "Section";
    if (activeStudent.currentClassId) {
      const cls = await tx.query.classes.findFirst({
        where: eq(classes.id, activeStudent.currentClassId),
        columns: { displayName: true },
      });
      if (cls?.displayName) className = cls.displayName;
    }
    if (activeStudent.currentSectionId) {
      const sec = await tx.query.sections.findFirst({
        where: eq(sections.id, activeStudent.currentSectionId),
        columns: { name: true },
      });
      if (sec?.name) sectionName = sec.name;
    }

    // Attendance Records (last 30 days)
    const attRows = await tx.query.studentAttendance.findMany({
      where: and(
        eq(studentAttendance.schoolId, school.id),
        eq(studentAttendance.studentId, activeStudent.id)
      ),
      orderBy: [desc(studentAttendance.attendanceDate)],
      limit: 30,
    });

    const attMetrics = calculateAttendanceMetrics(attRows);
    const totalDays = attMetrics.totalDays;
    const presentDays = attMetrics.attendedDays;
    const absentDays = attMetrics.absentDays;
    const lateDays = attMetrics.lateDays;
    const attendanceRate = attMetrics.ratePercent;

    const recentLogs = attRows.slice(0, 7).map((a) => ({
      date: new Date(a.attendanceDate).toLocaleDateString([], { month: "short", day: "numeric" }),
      status: a.status,
      remarks: a.remarks,
    }));

    // Bus Pass
    const pass = await tx.query.studentBusPasses.findFirst({
      where: and(
        eq(studentBusPasses.schoolId, school.id),
        eq(studentBusPasses.studentId, activeStudent.id),
        eq(studentBusPasses.isActive, true)
      ),
    });

    let busPassInfo = null;
    if (pass) {
      const route = await tx.query.routes.findFirst({
        where: eq(routes.id, pass.routeId),
        columns: { routeName: true },
      });
      const stop = await tx.query.routeStops.findFirst({
        where: eq(routeStops.id, pass.routeStopId),
        columns: { stopName: true, estimatedArrivalTime: true },
      });
      busPassInfo = {
        routeName: route?.routeName || "Route",
        stopName: stop?.stopName || "Designated Stop",
        scheduledTime: stop?.estimatedArrivalTime || "07:30 AM",
      };
    }

    // Fees Invoices
    const invoices = await tx.query.feeInvoices.findMany({
      where: and(
        eq(feeInvoices.schoolId, school.id),
        eq(feeInvoices.studentId, activeStudent.id)
      ),
      orderBy: [desc(feeInvoices.dueDate)],
      limit: 7,
    });

    const totalPending = invoices
      .filter((i) => i.status !== "PAID" && i.status !== "WAIVED")
      .reduce((sum, i) => sum + (Number(i.balanceAmount) || 0), 0);

    const invoiceList = invoices.map((i) => ({
      id: i.id,
      termName: "Term Fee",
      amount: Number(i.netAmount) || 0,
      status: i.status,
      dueDate: new Date(i.dueDate).toLocaleDateString([], { month: "short", day: "numeric" }),
    }));

    // Guardian Details
    const guardianUser = await tx.query.users.findFirst({
      where: eq(users.id, ctx.userId),
      columns: { email: true, mobileEncrypted: true },
    });

    return {
      className,
      sectionName,
      attendanceSummary: {
        totalDays,
        presentDays,
        absentDays,
        lateDays,
        recentLogs,
      },
      attendanceRate,
      busPassInfo,
      feesSummary: {
        totalPending,
        invoices: invoiceList,
      },
      documentsSummary: {
        totalUploaded: 3,
        documents: [
          { id: "doc-1", title: "Birth Certificate", verified: true },
          { id: "doc-2", title: "Aadhaar Card Copy", verified: true },
          { id: "doc-3", title: "Medical Record Form", verified: true },
        ],
      },
      guardian: {
        name: ctx.email ? ctx.email.split("@")[0]! : "Parent / Guardian",
        email: guardianUser?.email || ctx.email || "",
        phone: guardianUser?.mobileEncrypted ? decryptData(guardianUser.mobileEncrypted) : null,
      },
    };
  });

  return (
    <div className="py-2">
      <ChildProfileView
        student={{
          id: activeStudent.id,
          fullName: getStudentName(activeStudent),
          admissionNumber: activeStudent.admissionNumber,
          rollNumber: activeStudent.rollNumber ?? null,
          className: data.className,
          sectionName: data.sectionName,
          attendanceRate: data.attendanceRate,
          bloodGroup: (activeStudent as any).bloodGroup || null,
          dateOfBirth: activeStudent.dateOfBirth
            ? new Date(activeStudent.dateOfBirth).toISOString()
            : null,
        }}
        availableStudents={allStudents.map((s) => ({
          id: s.id,
          fullName: getStudentName(s),
          className: data.className,
        }))}
        attendanceSummary={data.attendanceSummary}
        busPass={data.busPassInfo}
        feesSummary={data.feesSummary}
        documentsSummary={data.documentsSummary}
        guardian={data.guardian}
      />
    </div>
  );
}
