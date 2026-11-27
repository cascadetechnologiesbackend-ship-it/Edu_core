import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db } from "@/db";
import {
  leaveRequests,
  staff,
  timetablePeriods,
  timetableSubstitutions,
} from "@/db/schema";
import { decryptData } from "@/lib/encryption";
import {
  SubstitutionWorkbenchClient,
  type AvailableTeacherOption,
  type ExistingSubstitutionItem,
  type UncoveredPeriodItem,
} from "./SubstitutionWorkbenchClient";

export const metadata: Metadata = {
  title: "Substitution Workbench",
  description: "Assign and confirm substitute teachers for absent faculty periods.",
};

function safeDecrypt(val: string | null | undefined): string {
  if (!val) return "";
  try {
    return decryptData(val) || "";
  } catch {
    return val;
  }
}

export default async function SubstitutionsWorkbenchPage() {
  const ctx = await requireAuth();
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"].includes(ctx.role)) {
    redirect("/dashboard");
  }
  const school = await requireSchool(ctx);
  const schoolId = school.id;

  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  const todayDayOfWeek = dayNames[now.getDay()] ?? "MONDAY";

  const [allStaff, approvedLeavesToday, todayPeriods, todaySubs] = await Promise.all([
    db.query.staff.findMany({
      where: and(eq(staff.schoolId, schoolId), eq(staff.isActive, true), isNull(staff.deletedAt)),
      columns: {
        id: true,
        userId: true,
        employeeCode: true,
        firstNameEncrypted: true,
        lastNameEncrypted: true,
      },
      with: {
        designation: { columns: { isTeaching: true } },
      },
    }),
    db.query.leaveRequests.findMany({
      where: and(
        eq(leaveRequests.schoolId, schoolId),
        eq(leaveRequests.status, "HR_APPROVED"),
        lte(leaveRequests.startDate, endOfDay),
        gte(leaveRequests.endDate, startOfDay)
      ),
      columns: { id: true, staffId: true },
    }),
    db.query.timetablePeriods.findMany({
      where: and(
        eq(timetablePeriods.schoolId, schoolId),
        eq(timetablePeriods.dayOfWeek, todayDayOfWeek as any)
      ),
      with: {
        section: {
          columns: { id: true, name: true },
          with: { class: { columns: { displayName: true } } },
        },
        subject: { columns: { id: true, name: true } },
      },
    }),
    db.query.timetableSubstitutions.findMany({
      where: and(
        eq(timetableSubstitutions.schoolId, schoolId),
        eq(timetableSubstitutions.date, todayIso)
      ),
      with: {
        timetablePeriod: {
          columns: { id: true, periodNumber: true, startTime: true, endTime: true },
        },
        section: {
          columns: { id: true, name: true },
          with: { class: { columns: { displayName: true } } },
        },
        subject: { columns: { id: true, name: true } },
      },
    }),
  ]);

  const onLeaveStaffIds = new Set(approvedLeavesToday.map((l) => l.staffId).filter(Boolean));
  const staffNameByUserId = new Map<string, string>();
  const absentTeacherUserIds = new Set<string>();
  const availableTeachers: AvailableTeacherOption[] = [];

  for (const st of allStaff as any[]) {
    const fullName = `${safeDecrypt(st.firstNameEncrypted)} ${safeDecrypt(st.lastNameEncrypted)}`.trim();
    const label = fullName || st.employeeCode || "Faculty";
    if (st.userId) {
      staffNameByUserId.set(st.userId, label);
      if (onLeaveStaffIds.has(st.id)) {
        absentTeacherUserIds.add(st.userId);
      } else {
        availableTeachers.push({
          userId: st.userId,
          name: label,
          employeeCode: st.employeeCode ?? null,
        });
      }
    }
  }

  const coveredPeriodIds = new Set(
    (todaySubs as any[])
      .filter((s) => s.status !== "CANCELLED")
      .map((s) => s.timetablePeriodId)
  );

  const uncoveredPeriods: UncoveredPeriodItem[] = (todayPeriods as any[])
    .filter(
      (p) =>
        p.teacherId &&
        absentTeacherUserIds.has(p.teacherId) &&
        !coveredPeriodIds.has(p.id)
    )
    .map((p) => ({
      periodId: p.id,
      periodNumber: p.periodNumber,
      startTime: p.startTime,
      endTime: p.endTime,
      sectionId: p.sectionId,
      sectionLabel: `${p.section?.class?.displayName ?? "Class"} ${p.section?.name ?? ""}`.trim(),
      subjectId: p.subjectId ?? null,
      subjectName: p.subject?.name ?? "Subject",
      originalTeacherUserId: p.teacherId,
      originalTeacherName: staffNameByUserId.get(p.teacherId) ?? "Absent Teacher",
    }))
    .sort((a, b) => a.periodNumber - b.periodNumber);

  const existingSubstitutions: ExistingSubstitutionItem[] = (todaySubs as any[]).map((s) => ({
    id: s.id,
    date: s.date,
    timetablePeriodId: s.timetablePeriodId,
    periodLabel: s.timetablePeriod
      ? `Period ${s.timetablePeriod.periodNumber} (${s.timetablePeriod.startTime}–${s.timetablePeriod.endTime})`
      : "Period",
    sectionLabel: `${s.section?.class?.displayName ?? "Class"} ${s.section?.name ?? ""}`.trim(),
    subjectName: s.subject?.name ?? "Subject",
    originalTeacherName: staffNameByUserId.get(s.originalTeacherId) ?? "Faculty",
    substituteTeacherId: s.substituteTeacherId ?? null,
    substituteTeacherName: s.substituteTeacherId
      ? staffNameByUserId.get(s.substituteTeacherId) ?? "Faculty"
      : null,
    status: s.status,
    reason: s.reason ?? null,
  }));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Substitution Workbench
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Assign and confirm substitute teachers for {todayIso} ({todayDayOfWeek}).
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-xs font-medium text-semantic-interactive hover:underline"
        >
          ← Back to Dashboard
        </Link>
      </div>

      <SubstitutionWorkbenchClient
        todayIso={todayIso}
        uncoveredPeriods={uncoveredPeriods}
        existingSubstitutions={existingSubstitutions}
        availableTeachers={availableTeachers}
      />
    </div>
  );
}
