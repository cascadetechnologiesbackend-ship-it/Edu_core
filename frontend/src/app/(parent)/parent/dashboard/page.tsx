import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";
import { db } from "@/db";
import {
  students,
  classes,
  sections,
  studentAttendance,
  feeInvoices,
  feeConcessions,
  studentFamilyMembers,
  studentBusPasses,
  routes,
  routeStops,
  vehicles,
  gpsPings,
  reportCards,
  exams,
} from "@/db/schema";
import { eq, and, desc, asc, sql, or, inArray, ne } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Users,
  CreditCard,
  Award,
  CalendarCheck,
  CheckCircle2,
  Bus,
  MapPin,
  Clock,
  ArrowRight,
  Receipt,
  AlertCircle,
  ShieldCheck,
  Loader2,
  Calendar,
  XCircle,
  Sparkles,
  Percent,
  Check,
} from "lucide-react";

// Dynamic import of LiveMap
const LiveMap = dynamic<any>(() => import("@/app/(admin)/transport/LiveMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[280px] w-full rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500 text-xs">
      <Loader2 className="w-4 h-4 animate-spin mr-2 text-indigo-400" />
      Loading Transit Tracking Map...
    </div>
  ),
});

export const metadata = {
  title: "Parent Portal Dashboard | SchoolMitra ERP",
  description: "Child academic progress, fee payments, report cards & attendance logs.",
};

const WARD_ACCENT_COLORS = [
  {
    bg: "from-indigo-950 via-slate-900 to-indigo-900",
    border: "border-indigo-900/50",
    avatarBg: "bg-indigo-600/30 border-indigo-500/40 text-indigo-300",
    badge: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    ring: "ring-indigo-500",
  },
  {
    bg: "from-emerald-950 via-slate-900 to-teal-900",
    border: "border-emerald-900/50",
    avatarBg: "bg-emerald-600/30 border-emerald-500/40 text-emerald-300",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    ring: "ring-emerald-500",
  },
  {
    bg: "from-purple-950 via-slate-900 to-violet-900",
    border: "border-purple-900/50",
    avatarBg: "bg-purple-600/30 border-purple-500/40 text-purple-300",
    badge: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    ring: "ring-purple-500",
  },
];

export default async function ParentDashboardPage({
  searchParams,
}: {
  searchParams?: { tab?: string; studentId?: string; view?: string };
}) {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "PARENT",
  ] as const);
  const school = await requireSchool(ctx);
  const schoolId = school.id;
  const userId = ctx.userId;

  // 1. Fetch ALL active wards linked to this parent (multi-ward / siblings support)
  const famLinks = await db.query.studentFamilyMembers.findMany({
    where: and(
      eq(studentFamilyMembers.userId, userId),
      eq(studentFamilyMembers.schoolId, schoolId),
    ),
  });
  const linkedStudentIds = famLinks.map((f) => f.studentId);

  let wards = await db.query.students.findMany({
    where: and(
      eq(students.schoolId, schoolId),
      eq(students.isActive, true),
      or(
        eq(students.primaryParentUserId, userId),
        linkedStudentIds.length > 0
          ? inArray(students.id, linkedStudentIds)
          : sql`false`,
      ),
    ),
    orderBy: [asc(students.admissionNumber)],
  });

  // Fallback for school administrators testing parent portal
  if (
    wards.length === 0 &&
    ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(ctx.role)
  ) {
    wards = await db.query.students.findMany({
      where: and(eq(students.schoolId, schoolId), eq(students.isActive, true)),
      limit: 3,
    });
  }

  if (wards.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center space-y-3">
        <Users className="w-10 h-10 text-slate-500 mx-auto" />
        <h2 className="text-lg font-bold text-white">No Student Ward Linked</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          No active student enrollment was found linked to your parent account.
          Please contact your school administration to verify your mobile number
          and parent linkage.
        </p>
      </div>
    );
  }

  // Determine active student
  const firstWard = wards[0]!;
  const matchedStudent = searchParams?.studentId
    ? wards.find((w) => w.id === searchParams.studentId)
    : null;
  const activeStudent = matchedStudent || firstWard;

  const activeWardIndex = Math.max(
    0,
    wards.findIndex((w) => w.id === activeStudent.id),
  );
  const accentTheme =
    WARD_ACCENT_COLORS[activeWardIndex % WARD_ACCENT_COLORS.length] ||
    WARD_ACCENT_COLORS[0]!;

  // Fetch sibling wards in school
  const siblingWards = wards.filter((w) => w.id !== activeStudent.id);
  const primarySibling = siblingWards.length > 0 ? siblingWards[0] : null;

  // 2. Fetch class, section, concessions, attendance, invoices, bus pass, report cards in parallel
  const {
    currentClass,
    currentSection,
    studentConcessions,
    attendanceLogs,
    invoices,
    allWardInvoices,
    busPass,
    childReportCards,
  } = await withDataPhaseTiming("/parent/dashboard", () =>
    assertQueryBudget(
      async () => {
        const [
          currentClass,
          currentSection,
          studentConcessions,
          attendanceLogs,
          invoices,
          allWardInvoices,
          busPass,
          childReportCards,
        ] = await Promise.all([
          activeStudent.currentClassId
            ? db.query.classes.findFirst({
                where: eq(classes.id, activeStudent.currentClassId),
              })
            : Promise.resolve(null),
          activeStudent.currentSectionId
            ? db.query.sections.findFirst({
                where: eq(sections.id, activeStudent.currentSectionId),
              })
            : Promise.resolve(null),
          db.query.feeConcessions.findMany({
            where: and(
              eq(feeConcessions.studentId, activeStudent.id),
              eq(feeConcessions.isActive, true),
            ),
          }),
          db.query.studentAttendance.findMany({
            where: eq(studentAttendance.studentId, activeStudent.id),
            orderBy: [desc(studentAttendance.attendanceDate)],
            limit: 60,
          }),
          db.query.feeInvoices.findMany({
            where: eq(feeInvoices.studentId, activeStudent.id),
            with: {
              feeStructure: {
                with: {
                  feeHead: true,
                },
              },
            },
            orderBy: [desc(feeInvoices.dueDate)],
            limit: 10,
          }),
          db.query.feeInvoices.findMany({
            where: inArray(
              feeInvoices.studentId,
              wards.map((w) => w.id),
            ),
          }),
          db.query.studentBusPasses.findFirst({
            where: and(
              eq(studentBusPasses.studentId, activeStudent.id),
              eq(studentBusPasses.isActive, true),
            ),
            with: {
              route: {
                with: {
                  stops: true,
                  vehicle: true,
                },
              },
              stop: true,
            },
          }),
          db.query.reportCards.findMany({
            where: eq(reportCards.studentId, activeStudent.id),
            with: {
              exam: true,
            },
            orderBy: [desc(reportCards.createdAt)],
            limit: 5,
          }),
        ]);

        return {
          currentClass,
          currentSection,
          studentConcessions,
          attendanceLogs,
          invoices,
          allWardInvoices,
          busPass,
          childReportCards,
        };
      },
      { maxQueries: 10, label: "Parent Portal Dashboard" },
    ),
  );

  const childName = `${decryptData(activeStudent.firstNameEncrypted)} ${decryptData(activeStudent.lastNameEncrypted)}`.trim();
  const className = currentClass?.displayName || "Standard Class";
  const sectionName = currentSection?.name || "A";

  const siblingConcession = studentConcessions.find(
    (c) => c.concessionType === "SIBLING",
  );

  const totalAttendance = attendanceLogs.length;
  const presentCount = attendanceLogs.filter(
    (a) => a.status === "PRESENT",
  ).length;
  const absentCount = attendanceLogs.filter((a) => a.status === "ABSENT").length;
  const attendanceRate =
    totalAttendance > 0
      ? ((presentCount / totalAttendance) * 100).toFixed(1)
      : "100.0";

  // Today's attendance log
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayLog = attendanceLogs.find((a) => {
    const d = new Date(a.attendanceDate);
    return d >= today && d < tomorrow;
  });

  let totalDue = 0;
  let totalPaid = 0;
  let totalDiscount = 0;
  invoices.forEach((inv) => {
    totalDue += parseFloat(inv.balanceAmount || "0");
    totalPaid += parseFloat(inv.paidAmount || "0");
    totalDiscount += parseFloat(inv.discountAmount || "0");
  });

  let familyTotalDue = 0;
  let familyTotalPaid = 0;
  let familyTotalDiscount = 0;
  const wardDueBreakdown: Record<string, number> = {};

  allWardInvoices.forEach((inv) => {
    const bal = parseFloat(inv.balanceAmount || "0");
    familyTotalDue += bal;
    familyTotalPaid += parseFloat(inv.paidAmount || "0");
    familyTotalDiscount += parseFloat(inv.discountAmount || "0");
    wardDueBreakdown[inv.studentId] = (wardDueBreakdown[inv.studentId] || 0) + bal;
  });

  let latestBusPing: any = null;
  if (busPass?.route?.vehicleId) {
    latestBusPing = await db.query.gpsPings.findFirst({
      where: eq(gpsPings.vehicleId, busPass.route.vehicleId),
      orderBy: [desc(gpsPings.recordedAt)],
    });
  }

  const busPosition = latestBusPing
    ? {
        lat: parseFloat(latestBusPing.latitude),
        lng: parseFloat(latestBusPing.longitude),
        speed: latestBusPing.speed ? parseFloat(latestBusPing.speed) : 0,
      }
    : busPass?.stop?.gpsLatitude && busPass?.stop?.gpsLongitude
    ? {
        lat: parseFloat(busPass.stop.gpsLatitude),
        lng: parseFloat(busPass.stop.gpsLongitude),
        speed: 0,
      }
    : null;

  const activeTab = searchParams?.tab || "overview";

  return (
    <div className="space-y-4">
      {/* ─── 0. Multi-Ward Switcher Bar (Mobile Thumb-Zone Ergonomics) ───────── */}
      {wards.length > 1 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              Family Wards ({wards.length} Siblings Enrolled)
            </span>
            <span className="text-[10px] text-indigo-400 font-semibold">
              Tap child to switch context
            </span>
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 no-scrollbar scroll-smooth">
            {wards.map((ward, idx) => {
              const isSelected = ward.id === activeStudent.id;
              const wardName = `${decryptData(ward.firstNameEncrypted)} ${decryptData(ward.lastNameEncrypted)}`.trim();
              const wardInitial = wardName.charAt(0).toUpperCase();
              const wardDue = wardDueBreakdown[ward.id] || 0;
              const color =
                WARD_ACCENT_COLORS[idx % WARD_ACCENT_COLORS.length] ||
                WARD_ACCENT_COLORS[0]!;

              return (
                <Link
                  key={ward.id}
                  href={`/parent/dashboard?tab=${activeTab}&studentId=${ward.id}`}
                  className={`flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border transition-all shrink-0 min-h-[46px] select-none ${
                    isSelected
                      ? `bg-slate-900 border-indigo-500/80 shadow-lg shadow-indigo-950/50 ring-2 ${color.ring}/40`
                      : "bg-slate-950/70 border-slate-800/80 hover:bg-slate-900/60 hover:border-slate-700 text-slate-400"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center shrink-0 border ${
                      isSelected
                        ? color.avatarBg
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                  >
                    {wardInitial}
                  </div>
                  <div className="text-left leading-tight">
                    <div
                      className={`font-extrabold text-xs flex items-center gap-1.5 ${
                        isSelected ? "text-white" : "text-slate-300"
                      }`}
                    >
                      {wardName}
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Adm #{ward.admissionNumber.replace("ADM-", "")} •{" "}
                      {wardDue > 0 ? (
                        <span className="text-amber-400 font-semibold">
                          Due: ₹{wardDue.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-semibold">
                          Fees Cleared
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 1. Active Ward Profile Hero Banner ─────────────────────────────── */}
      <div
        className={`rounded-2xl bg-gradient-to-r ${accentTheme.bg} border ${accentTheme.border} p-5 sm:p-6 text-white shadow-xl relative overflow-hidden`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-13 h-13 sm:w-14 sm:h-14 rounded-2xl ${accentTheme.avatarBg} font-black text-xl flex items-center justify-center shrink-0`}
            >
              {childName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${accentTheme.badge}`}
                >
                  <Users className="w-3.5 h-3.5" /> Enrolled Ward
                </span>

                <span className="text-xs text-slate-400">
                  Adm #{activeStudent.admissionNumber}
                </span>

                {/* Sibling Linkage Badge */}
                {primarySibling && (
                  <Link
                    href={`/parent/dashboard?tab=${activeTab}&studentId=${primarySibling.id}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-700/50 hover:bg-indigo-900 transition"
                  >
                    <span>👨‍👩‍👦 Sibling:</span>
                    <strong className="underline underline-offset-2">
                      {decryptData(primarySibling.firstNameEncrypted)}
                    </strong>
                  </Link>
                )}
              </div>

              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                {childName}
              </h1>

              <p className="text-xs text-slate-300 mt-0.5">
                {className} • Section {sectionName} • Roll #{activeStudent.rollNumber || "1"}
              </p>

              {/* Sibling Concession Callout */}
              {siblingConcession && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/60 border border-emerald-700/50 text-emerald-300 text-[11px] font-semibold mt-2">
                  <Percent className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    10% Sibling Concession Active • Saved ₹
                    {totalDiscount.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <Link
              href={`/parent/dashboard?tab=fees&studentId=${activeStudent.id}`}
              className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition shadow-md flex items-center justify-center gap-2 ${
                totalDue > 0
                  ? "bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white shadow-indigo-600/30"
                  : "bg-emerald-600/20 border border-emerald-500/40 text-emerald-300"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              {totalDue > 0
                ? `Pay Fees (₹${totalDue.toLocaleString()})`
                : "All Fees Cleared"}
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Filter Pills Bar ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
        <Link
          href={`/parent/dashboard?studentId=${activeStudent.id}`}
          className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition ${
            activeTab === "overview"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          Overview
        </Link>
        <Link
          href={`/parent/dashboard?tab=attendance&studentId=${activeStudent.id}`}
          className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition ${
            activeTab === "attendance"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          Attendance
        </Link>
        <Link
          href={`/parent/dashboard?tab=fees&studentId=${activeStudent.id}`}
          className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition ${
            activeTab === "fees"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          Fee Portal
        </Link>
        <Link
          href={`/parent/dashboard?tab=bus&studentId=${activeStudent.id}`}
          className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition ${
            activeTab === "bus"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          Bus Tracker
        </Link>
        <Link
          href={`/parent/dashboard?tab=academics&studentId=${activeStudent.id}`}
          className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition ${
            activeTab === "academics"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          Report Cards
        </Link>
      </div>

      {/* ─── TAB: OVERVIEW ─────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* Metric Stat Row (2x2 Grid) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Attendance Rate */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-4">
              <div className="flex items-center justify-between text-slate-400 mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Attendance
                </span>
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <CalendarCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-white">
                {attendanceRate}%
              </div>
              <p className="text-xs text-indigo-400 mt-0.5">
                {presentCount} of {totalAttendance} Days Present
              </p>
            </div>

            {/* Today's Status */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-4">
              <div className="flex items-center justify-between text-slate-400 mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Today&apos;s Status
                </span>
                <div
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center ${
                    todayLog?.status === "PRESENT"
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div
                className={`text-xl sm:text-2xl font-bold ${
                  todayLog?.status === "PRESENT"
                    ? "text-emerald-400"
                    : todayLog?.status === "ABSENT"
                    ? "text-rose-400"
                    : "text-amber-400"
                }`}
              >
                {todayLog?.status || "In Class"}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {todayLog ? "Marked by class teacher" : "Normal academic session"}
              </p>
            </div>

            {/* Fee Balance */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-4">
              <div className="flex items-center justify-between text-slate-400 mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Pending Fees
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <div
                className={`text-xl sm:text-2xl font-bold ${
                  totalDue > 0 ? "text-amber-400" : "text-emerald-400"
                }`}
              >
                {totalDue > 0 ? `₹${totalDue.toLocaleString()}` : "Fully Paid"}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {siblingConcession ? (
                  <span className="text-emerald-400">10% Sibling Discount</span>
                ) : (
                  "Term dues pending"
                )}
              </p>
            </div>

            {/* Transit Commute */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-4">
              <div className="flex items-center justify-between text-slate-400 mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Transit Route
                </span>
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Bus className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-bold text-white truncate">
                {busPass ? busPass.route?.routeName : "Self Commute"}
              </div>
              <p className="text-xs text-purple-400 mt-0.5 truncate">
                {busPass ? `Stop: ${busPass.stop?.stopName}` : "No bus pass opted"}
              </p>
            </div>
          </div>

          {/* Consolidated Family Balance Card (If multiple siblings enrolled) */}
          {wards.length > 1 && (
            <div className="rounded-2xl border border-indigo-900/50 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-4 sm:p-5 shadow-lg space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wide">
                      Family Account
                    </span>
                    <h3 className="text-sm font-bold text-white">
                      Consolidated Family Dues ({wards.length} Students)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Total pending balance across all enrolled siblings in Sparkids School.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-lg sm:text-xl font-black text-amber-400">
                      ₹{familyTotalDue.toLocaleString()}
                    </div>
                    {familyTotalDiscount > 0 && (
                      <div className="text-[11px] text-emerald-400 font-semibold">
                        Total Saved: ₹{familyTotalDiscount.toLocaleString()}
                      </div>
                    )}
                  </div>
                  <Link
                    href="/portal"
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 whitespace-nowrap"
                  >
                    Pay Family Total
                  </Link>
                </div>
              </div>

              {/* Child breakdown pills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                {wards.map((w) => {
                  const wName = `${decryptData(w.firstNameEncrypted)} ${decryptData(w.lastNameEncrypted)}`.trim();
                  const wBal = wardDueBreakdown[w.id] || 0;
                  const isCurrent = w.id === activeStudent.id;

                  return (
                    <Link
                      key={w.id}
                      href={`/parent/dashboard?tab=fees&studentId=${w.id}`}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition ${
                        isCurrent
                          ? "bg-indigo-950/50 border-indigo-500/40 text-white"
                          : "bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-900/60"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-400" />
                        <span className="font-semibold">{wName}</span>
                        {isCurrent && (
                          <span className="text-[10px] text-indigo-400 font-medium">
                            (Viewing)
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-amber-400">
                        ₹{wBal.toLocaleString()}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Sections Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Recent Invoices Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-400" />
                  Fee Invoices for {childName}
                </h3>
                <Link
                  href={`/parent/dashboard?tab=fees&studentId=${activeStudent.id}`}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  View All <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {invoices.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No invoices generated for this academic session yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {invoices.slice(0, 3).map((inv) => {
                    const feeHeadName =
                      inv.feeStructure?.feeHead?.name || `${inv.term} Fee`;
                    const headType = inv.feeStructure?.feeHead?.headType;
                    const discount = parseFloat(inv.discountAmount || "0");

                    return (
                      <div
                        key={inv.id}
                        className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                            <span>{feeHeadName}</span>
                            {headType && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                                {headType}
                              </span>
                            )}
                            {discount > 0 && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                -₹{discount.toLocaleString()} Disc
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                            <span className="font-mono text-slate-400">
                              #{inv.invoiceNumber}
                            </span>
                            <span>•</span>
                            <span>
                              Due: {new Date(inv.dueDate).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-bold text-white">
                            ₹{parseFloat(inv.netAmount).toLocaleString()}
                          </div>
                          <span
                            className={`inline-block px-2 py-0.2 rounded-full text-[9px] font-bold ${
                              inv.status === "PAID"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-amber-500/15 text-amber-400"
                            }`}
                          >
                            {inv.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Live Transit Snapshot */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Bus className="w-4 h-4 text-indigo-400" />
                  Transit Tracker
                </h3>
                {busPass && (
                  <Link
                    href={`/parent/dashboard?tab=bus&studentId=${activeStudent.id}`}
                    className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    Live Map <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>

              {busPass ? (
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Vehicle:</span>
                      <strong className="text-white">
                        {busPass.route?.vehicle?.busNumber || "Bus Route"}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-300 mt-1">
                      <span>Stop:</span>
                      <strong className="text-indigo-400">
                        {busPass.stop?.stopName || "School Gate"}
                      </strong>
                    </div>
                  </div>
                  <Link
                    href={`/parent/dashboard?tab=bus&studentId=${activeStudent.id}`}
                    className="block text-center py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold"
                  >
                    View Satellite Transit Map
                  </Link>
                </div>
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs">
                  Student is registered as Self Commute.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: ATTENDANCE ───────────────────────────────────────────────── */}
      {activeTab === "attendance" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-indigo-400" />
              Attendance Record for {childName}
            </h2>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {attendanceRate}% Overall
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
            <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/60">
              <div className="text-slate-400">Total Logged</div>
              <div className="text-base font-bold text-white mt-0.5">
                {totalAttendance}
              </div>
            </div>
            <div className="p-2.5 rounded-xl border border-emerald-900/40 bg-emerald-950/30">
              <div className="text-emerald-400">Present</div>
              <div className="text-base font-bold text-emerald-300 mt-0.5">
                {presentCount}
              </div>
            </div>
            <div className="p-2.5 rounded-xl border border-rose-900/40 bg-rose-950/30">
              <div className="text-rose-400">Absent</div>
              <div className="text-base font-bold text-rose-300 mt-0.5">
                {absentCount}
              </div>
            </div>
          </div>

          {attendanceLogs.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              No daily roll call records found for this academic session yet.
            </p>
          ) : (
            <div className="space-y-2">
              {attendanceLogs.map((log) => {
                const isPres = log.status === "PRESENT";
                return (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          isPres ? "bg-emerald-400" : "bg-rose-500"
                        }`}
                      />
                      <div>
                        <div className="font-bold text-white">
                          {new Date(log.attendanceDate).toLocaleDateString(
                            "en-IN",
                            {
                              weekday: "short",
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            },
                          )}
                        </div>
                        {log.remarks && (
                          <div className="text-[10px] text-slate-400">
                            {log.remarks}
                          </div>
                        )}
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isPres
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: FEES ─────────────────────────────────────────────────────── */}
      {activeTab === "fees" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                Fee Ledger &amp; Payments • {childName}
              </h2>
              {siblingConcession && (
                <p className="text-xs text-emerald-400 mt-0.5 flex items-center gap-1 font-medium">
                  <Percent className="w-3.5 h-3.5" /> 10% Sibling Concession
                  Applied to Annual Invoices
                </p>
              )}
            </div>
            <div className="text-sm font-bold text-emerald-400">
              Active Dues: ₹{totalDue.toLocaleString()}
            </div>
          </div>

          <div className="space-y-3">
            {invoices.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                No fee invoices generated yet.
              </p>
            ) : (
              invoices.map((inv) => {
                const gross = parseFloat(inv.grossAmount || "0");
                const disc = parseFloat(inv.discountAmount || "0");
                const net = parseFloat(inv.netAmount || "0");
                const bal = parseFloat(inv.balanceAmount || "0");
                const feeHeadName =
                  inv.feeStructure?.feeHead?.name || `${inv.term} School Fee`;
                const headType = inv.feeStructure?.feeHead?.headType;

                return (
                  <div
                    key={inv.id}
                    className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 text-xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-bold text-white text-base flex items-center gap-2 flex-wrap">
                          <span>{feeHeadName}</span>
                          {headType && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                              {headType}
                            </span>
                          )}
                          {disc > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              -₹{disc.toLocaleString()} Sibling Concession
                            </span>
                          )}
                        </div>
                        <div className="text-slate-400 text-xs flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-slate-300">
                            #{inv.invoiceNumber}
                          </span>
                          <span>•</span>
                          <span>
                            Due: {new Date(inv.dueDate).toLocaleDateString()}
                          </span>
                          <span>•</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800/80 text-slate-300">
                            {inv.term}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-bold text-white text-base">
                          ₹{net.toLocaleString()}
                        </div>
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold mt-1 ${
                            inv.status === "PAID"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-amber-500/20 text-amber-400"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </div>
                    </div>

                    {/* Breakdown Bar */}
                    <div className="pt-2 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center text-[11px] text-slate-400">
                      <div>
                        Gross Fee:{" "}
                        <strong className="text-slate-300">
                          ₹{gross.toLocaleString()}
                        </strong>
                      </div>
                      <div>
                        Concession:{" "}
                        <strong className="text-emerald-400">
                          -₹{disc.toLocaleString()}
                        </strong>
                      </div>
                      <div>
                        Balance Due:{" "}
                        <strong className="text-amber-400">
                          ₹{bal.toLocaleString()}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {totalDue > 0 && (
            <Link
              href="/portal"
              className="block text-center py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md shadow-emerald-600/30"
            >
              Proceed to Instant Payment Gateway (₹{totalDue.toLocaleString()})
            </Link>
          )}
        </div>
      )}

      {/* ─── TAB: BUS TRACKER ──────────────────────────────────────────────── */}
      {activeTab === "bus" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Bus className="w-4 h-4 text-indigo-400" />
                Transit Tracking • {childName}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {busPass ? (
                  <>
                    Vehicle:{" "}
                    <strong className="text-slate-200">
                      {busPass.route?.vehicle?.busNumber || "School Bus"}
                    </strong>{" "}
                    • Stop:{" "}
                    <strong className="text-indigo-400">
                      {busPass.stop?.stopName || "Main Gate"}
                    </strong>{" "}
                    (ETA: {busPass.stop?.estimatedArrivalTime || "07:45 AM"})
                  </>
                ) : (
                  "Student is registered as Self Commute"
                )}
              </p>
            </div>
            {busPass && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 self-start sm:self-auto">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Route Satellite Active
              </span>
            )}
          </div>

          {busPass ? (
            <div className="rounded-2xl overflow-hidden border border-slate-800">
              <LiveMap
                stops={busPass.route?.stops || []}
                busPosition={busPosition}
                height="320px"
                zoom={14}
              />
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              No active bus pass allocated to {childName}.
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: REPORT CARDS ─────────────────────────────────────────────── */}
      {activeTab === "academics" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-5 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-purple-400" />
            Scholastic Progress &amp; Report Cards • {childName}
          </h2>

          {childReportCards.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-slate-950/60 text-slate-400 text-xs space-y-1">
              <Award className="w-8 h-8 text-slate-500 mx-auto mb-1" />
              <p>Term evaluations currently in progress.</p>
              <p className="text-[11px] text-slate-500">
                Official report cards will be published here upon completion of
                examination cycles.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {childReportCards.map((rc) => (
                <div
                  key={rc.id}
                  className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-white">
                      {rc.exam?.name || "Term Exam"}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Grade: {rc.overallGrade || "A"}{" "}
                      {rc.rank ? `• Rank #${rc.rank}` : ""}
                    </div>
                  </div>
                  <Link
                    href={`/api/report-cards/${rc.id}/download`}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 font-semibold hover:bg-indigo-600/30 transition border border-indigo-500/30"
                  >
                    Download PDF
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
