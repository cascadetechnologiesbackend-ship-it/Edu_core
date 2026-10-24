import { withTenant } from "@/db";
import {
  academicYears,
  leaveRequests,
  staff,
  departments,
  designations,
  leaveTypes,
  salaryTemplates,
  payrollRuns,
  classTeacherAssignments,
  sectionSubjectTeachers,
  schools,
  sections,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { Metadata } from "next";
import { getCachedSession } from "@/lib/serverAuth";
import { redirect } from "next/navigation";
import { assertRouteAccess } from "@/lib/routeGuards";
import HRDashboardClient from "./HRDashboardClient";
import { decryptData } from "@/lib/encryption";
import { withDataPhaseTiming } from "@/lib/serverTiming";

export const metadata: Metadata = {
  title: "HR & Staff Hub | SchoolMitra ERP",
  description:
    "Universal hub for staff management, allocations, leaves, payroll, and structure",
};

/** Server-side email masker — raw value never reaches the client */
function maskEmail(raw: string | null | undefined): string {
  if (!raw) return "";
  const at = raw.indexOf("@");
  if (at <= 0) return "****";
  const local = raw.slice(0, at);
  const domain = raw.slice(at); // "@domain.com"
  return `${local[0]}***${domain}`;
}

export default async function HRPage() {
  const session = await getCachedSession();
  if (!session?.user?.schoolId) redirect("/login");

  const role = session.user.role;

  // TEACHER must never see the HR hub
  if (role === "TEACHER") {
    redirect("/dashboard");
  }

  const access = assertRouteAccess(session.user.role, "/hr", {
    id: session.user.id,
    email: session.user.email,
  });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  const schoolId = session.user.schoolId;

  const data = await withDataPhaseTiming("/hr", async () => {
    // All queries inside withTenant so PostgreSQL RLS is satisfied
    return withTenant(schoolId, async (tx) => {
      const [
        activeYear,
        school,
        allStaff,
        allDepartments,
        allDesignations,
        allLeaveTypes,
        allLeaveRequests,
        allSalaryTemplates,
        allPayrollRuns,
        classTeacherRows,
        subjectTeacherRows,
        allSections,
      ] = await Promise.all([
        tx.query.academicYears.findFirst({
          where: and(
            eq(academicYears.isActive, true),
            eq(academicYears.schoolId, schoolId),
          ),
        }),
        tx.query.schools.findFirst({
          where: eq(schools.id, schoolId),
        }),
        tx.query.staff.findMany({
          where: eq(staff.schoolId, schoolId),
          with: {
            user: true,
            department: true,
            designation: true,
          },
          orderBy: (t, { desc }) => [desc(t.createdAt)],
        }),
        tx.query.departments.findMany({
          where: eq(departments.schoolId, schoolId),
          with: {
            hod: true,
            staff: true,
            designations: true,
          },
          orderBy: (t, { asc }) => [asc(t.name)],
        }),
        tx.query.designations.findMany({
          where: eq(designations.schoolId, schoolId),
          with: {
            department: true,
            staff: true,
          },
          orderBy: (t, { asc }) => [asc(t.name)],
        }),
        tx.query.leaveTypes.findMany({
          where: eq(leaveTypes.schoolId, schoolId),
        }),
        tx.query.leaveRequests.findMany({
          where: eq(leaveRequests.schoolId, schoolId),
          with: {
            staff: true,
            leaveType: true,
          },
          orderBy: (t, { desc }) => [desc(t.createdAt)],
        }),
        tx.query.salaryTemplates.findMany({
          where: eq(salaryTemplates.schoolId, schoolId),
          orderBy: (t, { desc }) => [desc(t.createdAt)],
        }),
        tx.query.payrollRuns.findMany({
          where: eq(payrollRuns.schoolId, schoolId),
          orderBy: (t, { desc }) => [desc(t.month)],
        }),
        // S16 canonical class teacher assignments
        tx.query.classTeacherAssignments.findMany({
          where: and(
            eq(classTeacherAssignments.schoolId, schoolId),
            eq(classTeacherAssignments.isActive, true),
          ),
          with: {
            section: { with: { class: true } },
          },
        }),
        // S16 section-subject allocations
        tx.query.sectionSubjectTeachers.findMany({
          where: and(
            eq(sectionSubjectTeachers.schoolId, schoolId),
            eq(sectionSubjectTeachers.isActive, true),
          ),
        }),
        // All sections for allocation coverage calc
        tx.query.sections.findMany({
          where: and(
            eq(sections.schoolId, schoolId),
            eq(sections.isActive, true),
          ),
        }),
      ]);

      return {
        activeYear,
        school,
        allStaff,
        allDepartments,
        allDesignations,
        allLeaveTypes,
        allLeaveRequests,
        allSalaryTemplates,
        allPayrollRuns,
        classTeacherRows,
        subjectTeacherRows,
        allSections,
      };
    });
  });

  // ── Decrypt & mask staff PII server-side (C2: raw values never reach the client) ──
  const decryptField = (val: string | null | undefined) => {
    if (!val) return "";
    try {
      return decryptData(val) || "";
    } catch {
      return "";
    }
  };

  const decryptedStaff = data.allStaff.map((s) => ({
    ...s,
    firstName: decryptField(s.firstNameEncrypted),
    lastName: decryptField(s.lastNameEncrypted),
    mobile: decryptField(s.mobileEncrypted),
    // C2: email is MASKED — only raw value is stored server-side; reveal requires gated action
    email: maskEmail(decryptField(s.emailEncrypted) || s.user?.email || null),
    _emailEncrypted: s.emailEncrypted, // kept for revealStaffEmail action by staffId
  }));

  // ── Live allocation census for Overview spoke ─────────────────────────────
  const totalSections = data.allSections.length;
  const sectionsWithClassTeacher = new Set(
    data.classTeacherRows.map((r) => r.sectionId),
  ).size;
  const uniqueSubjectAllocatedTeachers = new Set(
    data.subjectTeacherRows.map((r) => r.teacherId),
  ).size;

  // Per-teacher allocation summary for Directory spoke badges
  const teacherAllocSummary: Record<
    string,
    { classTeacherOf: string[]; subjectCount: number }
  > = {};
  for (const row of data.classTeacherRows) {
    const label = row.section
      ? `${row.section.class?.displayName ?? ""} ${row.section.name ?? ""}`.trim()
      : row.sectionId;
    if (!teacherAllocSummary[row.teacherId]) {
      teacherAllocSummary[row.teacherId] = { classTeacherOf: [], subjectCount: 0 };
    }
    teacherAllocSummary[row.teacherId]!.classTeacherOf.push(label);
  }
  for (const row of data.subjectTeacherRows) {
    if (!teacherAllocSummary[row.teacherId]) {
      teacherAllocSummary[row.teacherId] = { classTeacherOf: [], subjectCount: 0 };
    }
    teacherAllocSummary[row.teacherId]!.subjectCount += 1;
  }

  const allocStats = {
    totalSections,
    sectionsWithClassTeacher,
    sectionsWithoutClassTeacher: totalSections - sectionsWithClassTeacher,
    uniqueSubjectAllocatedTeachers,
  };

  // ── Department member counts — now live from withTenant reads ─────────────
  const departmentsWithCounts = data.allDepartments.map((d) => ({
    ...d,
    staffCount: d.staff?.filter((s) => s.isActive).length ?? 0,
    totalStaffCount: d.staff?.length ?? 0,
    designationsCount: d.designations?.filter((des) => des.isActive).length ?? 0,
  }));

  const designationsWithCounts = data.allDesignations.map((d) => ({
    ...d,
    staffCount: d.staff?.filter((s) => s.isActive).length ?? 0,
  }));

  return (
    <HRDashboardClient
      session={session}
      activeYear={data.activeYear ?? null}
      school={data.school ?? null}
      staffList={decryptedStaff}
      departments={departmentsWithCounts}
      designations={designationsWithCounts}
      leaveTypes={data.allLeaveTypes}
      leaveRequests={data.allLeaveRequests}
      salaryTemplates={data.allSalaryTemplates}
      payrollRuns={data.allPayrollRuns}
      allocStats={allocStats}
      teacherAllocSummary={teacherAllocSummary}
    />
  );
}
