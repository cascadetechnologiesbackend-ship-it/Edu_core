export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
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

  // 1. Fetch all linked wards
  const allStudents = await withTenant(school.id, async (tx) => {
    if (ctx.role === "PARENT") {
      return await tx.query.students.findMany({
        where: and(
          eq(students.schoolId, school.id),
          eq(students.primaryParentUserId, ctx.userId),
          eq(students.isActive, true)
        ),
        orderBy: [asc(students.admissionNumber)],
      });
    }

    return await tx.query.students.findMany({
      where: and(eq(students.schoolId, school.id), eq(students.isActive, true)),
      limit: 5,
    });
  });

  if (allStudents.length === 0) {
    redirect("/parent/dashboard");
  }

  // Active student
  const activeStudent =
    (searchParams?.studentId
      ? allStudents.find((s) => s.id === searchParams.studentId)
      : null) || allStudents[0]!;

  // 2. Fetch Class, Attendance, Bus Pass, Fees, and Guardian
  const data = await withTenant(school.id, async (tx) => {
    // Class and Section
    let className = "Class";
    let sectionName = "Section";
    if (activeStudent.classId) {
      const cls = await tx.query.classes.findFirst({
        where: eq(classes.id, activeStudent.classId),
        columns: { displayName: true },
      });
      if (cls?.displayName) className = cls.displayName;
    }
    if (activeStudent.sectionId) {
      const sec = await tx.query.sections.findFirst({
        where: eq(sections.id, activeStudent.sectionId),
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

    const totalDays = attRows.length || 1;
    const presentDays = attRows.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
    const absentDays = attRows.filter((a) => a.status === "ABSENT").length;
    const lateDays = attRows.filter((a) => a.status === "LATE").length;
    const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 100;

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
      columns: { fullName: true, email: true, phone: true },
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
        name: guardianUser?.fullName || "Parent / Guardian",
        email: guardianUser?.email || "",
        phone: guardianUser?.phone || null,
      },
    };
  });

  return (
    <div className="py-2">
      <ChildProfileView
        student={{
          id: activeStudent.id,
          fullName: activeStudent.fullName,
          admissionNumber: activeStudent.admissionNumber,
          rollNumber: activeStudent.rollNumber,
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
          fullName: s.fullName,
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
