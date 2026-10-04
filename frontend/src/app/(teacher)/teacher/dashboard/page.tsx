import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db } from "@/db";
import {
  staff,
  classes,
  sections,
  classSubjects,
  sectionSubjectTeachers,
  subjects,
  studentAttendance,
  timetablePeriods,
  exams,
  students,
  salaryComponents,
  payslips,
} from "@/db/schema";
import { eq, and, isNull, inArray, sql, desc } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import { computeSalaryBreakdown } from "@/lib/salaryCalculator";
import Link from "next/link";
import {
  BookOpen,
  CalendarCheck,
  Award,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  GraduationCap,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  Info,
  Receipt,
  Percent,
} from "lucide-react";

export const metadata = {
  title: "Teacher Workspace | SchoolMitra ERP",
  description: "Educator class dashboard for daily attendance, marks entry, and timetable.",
};

export default async function TeacherDashboardPage() {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);
  const schoolId = school.id;
  const userId = ctx.userId;

  // 1. Fetch Staff/Teacher details
  const staffMember = await db.query.staff.findFirst({
    where: and(eq(staff.userId, userId), eq(staff.schoolId, schoolId)),
  });

  const teacherName = staffMember
    ? `${decryptData(staffMember.firstNameEncrypted)} ${decryptData(staffMember.lastNameEncrypted)}`.trim()
    : ctx.role === "TEACHER"
    ? "Teacher"
    : "Administrator";

  // 2. Query Teacher's Designated Class Teacher Sections
  const classTeacherSections = await db.query.sections.findMany({
    where: and(
      eq(sections.schoolId, schoolId),
      eq(sections.classTeacherId, userId),
      eq(sections.isActive, true)
    ),
    with: {
      class: true,
    },
  });

  // 3. Query Teacher's Assigned Class-Subjects
  const assignedMappings = await db.query.classSubjects.findMany({
    where: and(
      eq(classSubjects.schoolId, schoolId),
      eq(classSubjects.assignedTeacherId, userId)
    ),
    with: {
      class: true,
      subject: true,
    },
  });

  // 4. Query Section-Subject Overrides
  const sectionSubjectAllocations = await db.query.sectionSubjectTeachers.findMany({
    where: and(
      eq(sectionSubjectTeachers.schoolId, schoolId),
      eq(sectionSubjectTeachers.teacherId, userId),
      eq(sectionSubjectTeachers.isActive, true)
    ),
    with: {
      section: {
        with: {
          class: true,
        },
      },
      classSubject: {
        with: {
          subject: true,
        },
      },
    },
  });

  // Aggregate all unique assigned section IDs
  const sectionIdSet = new Set<string>();
  classTeacherSections.forEach((s) => sectionIdSet.add(s.id));
  sectionSubjectAllocations.forEach((ssa) => {
    if (ssa.section?.id) sectionIdSet.add(ssa.section.id);
  });

  // For class-level subject mappings, also include sections of those classes
  const assignedClassIds = assignedMappings.map((m) => m.classId).filter(Boolean);
  if (assignedClassIds.length > 0) {
    const classSections = await db.query.sections.findMany({
      where: and(
        eq(sections.schoolId, schoolId),
        inArray(sections.classId, assignedClassIds),
        eq(sections.isActive, true)
      ),
    });
    classSections.forEach((s) => sectionIdSet.add(s.id));
  }

  const assignedSectionIds = Array.from(sectionIdSet);

  // Aggregate distinct class names
  const assignedClassNames = new Set<string>();
  classTeacherSections.forEach((s) => {
    if (s.class?.displayName) assignedClassNames.add(s.class.displayName);
  });
  assignedMappings.forEach((m) => {
    if (m.class?.displayName) assignedClassNames.add(m.class.displayName);
  });
  sectionSubjectAllocations.forEach((ssa) => {
    if (ssa.section?.class?.displayName) {
      assignedClassNames.add(ssa.section.class.displayName);
    }
  });

  const totalAssignedClassesCount = assignedClassNames.size;
  const totalSubjectAllocations =
    assignedMappings.length + sectionSubjectAllocations.length;

  // 5. Count Total Students in Assigned Sections ONLY (Zero if unassigned)
  let totalStudents = 0;
  if (assignedSectionIds.length > 0) {
    const studentCountRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(students)
      .where(
        and(
          eq(students.schoolId, schoolId),
          inArray(students.currentSectionId, assignedSectionIds),
          eq(students.isActive, true)
        )
      );
    totalStudents = Number(studentCountRes[0]?.count || 0);
  }

  // 6. Check Today's Attendance in Assigned Sections
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayAttendanceLogs = assignedSectionIds.length > 0
    ? await db.query.studentAttendance.findMany({
        where: and(
          eq(studentAttendance.schoolId, schoolId),
          inArray(studentAttendance.sectionId, assignedSectionIds),
          sql`${studentAttendance.attendanceDate} >= ${today} AND ${studentAttendance.attendanceDate} < ${tomorrow}`
        ),
      })
    : [];

  const isAttendanceMarkedToday = todayAttendanceLogs.length > 0;
  const presentCount = todayAttendanceLogs.filter((a) => a.status === "PRESENT").length;
  const absentCount = todayAttendanceLogs.filter((a) => a.status === "ABSENT").length;

  // 7. Query Today's Timetable Periods
  const dayNames = [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ] as const;
  const currentDayOfWeek = dayNames[new Date().getDay()] || "MONDAY";

  // Sunday is a weekend; timetable day_of_week enum only accepts MONDAY-SATURDAY
  const isSunday = currentDayOfWeek === "SUNDAY";
  const todayPeriods = isSunday || assignedSectionIds.length === 0
    ? []
    : await db.query.timetablePeriods.findMany({
        where: and(
          eq(timetablePeriods.schoolId, schoolId),
          eq(timetablePeriods.dayOfWeek, currentDayOfWeek as any),
          inArray(timetablePeriods.sectionId, assignedSectionIds),
          eq(timetablePeriods.isActive, true)
        ),
        with: {
          subject: true,
          section: {
            with: {
              class: true,
            },
          },
        },
        orderBy: [timetablePeriods.periodNumber],
        limit: 8,
      });

  // 8. Query Active / Upcoming Exams
  const activeExams = await db.query.exams.findMany({
    where: and(eq(exams.schoolId, schoolId), isNull(exams.deletedAt)),
    orderBy: [exams.startDate],
    limit: 3,
  });

  // 9. Query Staff Salary Structure & Compensation
  let salaryComponent: any = null;
  let recentPayslips: any[] = [];
  if (staffMember) {
    const [sc, ps] = await Promise.all([
      db.query.salaryComponents.findFirst({
        where: eq(salaryComponents.staffId, staffMember.id),
      }),
      db.query.payslips.findMany({
        where: eq(payslips.staffId, staffMember.id),
        orderBy: [desc(payslips.month)],
        limit: 3,
      }),
    ]);
    salaryComponent = sc;
    recentPayslips = ps;
  }

  const salaryBreakdown = salaryComponent
    ? computeSalaryBreakdown(salaryComponent)
    : null;

  const hasAllocations =
    classTeacherSections.length > 0 ||
    assignedMappings.length > 0 ||
    sectionSubjectAllocations.length > 0;

  return (
    <div className="space-y-6">
      {/* ─── 1. Header Banner ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border border-emerald-900/40 p-6 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <BookOpen className="w-3.5 h-3.5" /> Educator Workspace
              </span>
              <span className="text-xs text-emerald-300/80 font-medium">
                {currentDayOfWeek} Schedule
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Good day, {teacherName}!
            </h1>
            <p className="text-emerald-200/80 text-xs sm:text-sm mt-1 max-w-xl">
              {hasAllocations
                ? "Here is your classroom overview for today. Mark student roll calls, check timetable periods, and record scholastic grades."
                : "Welcome to your educator hub. No classes or subjects are currently allocated to your account."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/teacher/attendance"
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-semibold text-xs transition shadow-md shadow-emerald-600/30 flex items-center gap-2"
            >
              <CalendarCheck className="w-4 h-4" />
              {isAttendanceMarkedToday ? "Review Attendance" : "Take Attendance"}
            </Link>
            <Link
              href="/teacher/grading"
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition flex items-center gap-2"
            >
              <Award className="w-4 h-4 text-amber-400" />
              Enter Marks
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Unallocated Warning State (Zero Fallbacks) ───────────────────────── */}
      {!hasAllocations && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-5 text-amber-200">
          <div className="flex items-start gap-3.5">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-amber-300">
                No Classrooms or Subjects Assigned
              </h3>
              <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
                Your educator account is active, but the school administrator has not assigned you as a <strong>Class Teacher</strong> or allocated any <strong>Subject Mappings</strong>.
              </p>
              <p className="text-xs text-amber-200/70 mt-2">
                Ask your school administrator to open <strong>Academics &gt; Classrooms</strong> to designate you as a Class Teacher, or <strong>Academics &gt; Subject Mapping</strong> to allocate subjects to you.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── 2. Metric Stat Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* Assigned Classes */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Classes & Subjects
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white truncate">
            {totalAssignedClassesCount > 0
              ? Array.from(assignedClassNames).slice(0, 2).join(", ")
              : "0 Classes"}
          </div>
          <p className="text-xs text-emerald-400 mt-1">
            {totalSubjectAllocations} Subject Allocation(s)
          </p>
        </div>

        {/* Total Students */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Students
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">
            {totalStudents}
          </div>
          <p className="text-xs text-slate-400 mt-1">In your assigned sections</p>
        </div>

        {/* Roll Call Status */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Roll Call Today
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`text-xl sm:text-2xl font-bold ${
              isAttendanceMarkedToday ? "text-emerald-400" : "text-amber-400"
            }`}
          >
            {isAttendanceMarkedToday ? "Submitted" : "Pending"}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {isAttendanceMarkedToday
              ? `${presentCount} Present • ${absentCount} Absent`
              : "Daily register not yet submitted"}
          </p>
        </div>

        {/* Examinations */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Evaluations
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">
            {activeExams.length > 0 ? "Active Terms" : "Continuous"}
          </div>
          <p className="text-xs text-purple-400 mt-1">
            {activeExams.length} active exam cycle(s)
          </p>
        </div>
      </div>

      {/* ─── 2.5. Educator Compensation & Monthly Take-Home Card ──────────────── */}
      <div className="rounded-2xl border border-emerald-900/40 bg-gradient-to-r from-slate-900 via-emerald-950/30 to-slate-900 p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wide">
                  Faculty Payroll
                </span>
                <span className="text-xs text-slate-400">
                  Direct Bank Credit
                </span>
              </div>
              <h3 className="text-sm font-bold text-white mt-0.5">
                Compensation &amp; Salary Structure
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            {salaryBreakdown ? (
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-medium">
                  Net Monthly Take-Home
                </span>
                <span className="text-lg sm:text-xl font-black text-emerald-400">
                  ₹{Math.round(salaryBreakdown.netMonthlyPay).toLocaleString()}
                </span>
              </div>
            ) : (
              <span className="text-xs text-amber-400 font-semibold">
                Setup In Progress
              </span>
            )}

            <Link
              href="/teacher/payroll"
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>View Payslip</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {salaryBreakdown ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-slate-800/80 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block">Basic Pay</span>
              <strong className="text-white font-bold text-sm">
                ₹{Math.round(salaryBreakdown.basicSalary).toLocaleString()}
              </strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block">
                DA ({salaryBreakdown.daPercent}%)
              </span>
              <strong className="text-emerald-400 font-bold text-sm">
                +₹{Math.round(salaryBreakdown.daAmount).toLocaleString()}
              </strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block">
                HRA ({salaryBreakdown.hraPercent}%)
              </span>
              <strong className="text-emerald-400 font-bold text-sm">
                +₹{Math.round(salaryBreakdown.hraAmount).toLocaleString()}
              </strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block">
                PF + PT + TDS
              </span>
              <strong className="text-rose-400 font-bold text-sm">
                -₹{Math.round(salaryBreakdown.deductionsTotal).toLocaleString()}
              </strong>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-400">
            No salary structure components allocated to your faculty profile yet. Contact school administration to associate your wage template.
          </div>
        )}
      </div>

      {/* ─── 3. Today's Class Schedule ────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-bold text-white">
              Today&apos;s Schedule ({currentDayOfWeek})
            </h2>
          </div>
          <Link
            href="/teacher/classes"
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
          >
            Full Timetable <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {todayPeriods.length === 0 ? (
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-6 text-center text-slate-400">
            <p className="text-xs">
              {isSunday
                ? "No active periods scheduled for Sunday. Enjoy your weekend!"
                : "No periods scheduled for your classes today."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {todayPeriods.map((period) => (
              <div
                key={period.id}
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950/60"
              >
                <div>
                  <div className="text-xs font-bold text-white">
                    Period {period.periodNumber}: {period.subject?.name || "Subject"}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {period.section?.class?.displayName || "Class"} - {period.section?.name || "Sec"} • {period.startTime} - {period.endTime}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Room {period.roomNumber || "Main"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── 4. Quick Operative Actions ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          href="/teacher/attendance"
          className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-emerald-500/50 transition group flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
              Daily Attendance
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Mark morning roll call for assigned class sections with instant present/absent counters.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-emerald-400">
            Open Sheet <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link
          href="/teacher/grading"
          className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-purple-500/50 transition group flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
              Scholastic Gradebook
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Record unit test, midterm, and formative assessment scores for your assigned subjects.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-purple-400">
            Enter Marks <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link
          href="/teacher/classes"
          className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-indigo-500/50 transition group flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <BookOpen className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
              Class Rosters
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              View student enrollments, guardian contact details, and weekly teaching timetables.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-indigo-400">
            View Rosters <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>
    </div>
  );
}
