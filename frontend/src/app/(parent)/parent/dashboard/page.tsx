import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db } from "@/db";
import {
  students,
  classes,
  sections,
  studentAttendance,
  feeInvoices,
  studentBusPasses,
  routes,
  routeStops,
  vehicles,
  gpsPings,
  reportCards,
  exams,
} from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
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

export default async function ParentDashboardPage({
  searchParams,
}: {
  searchParams?: { tab?: string };
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

  // 1. Fetch child enrolled in the school
  let student = await db.query.students.findFirst({
    where: and(
      eq(students.primaryParentUserId, userId),
      eq(students.schoolId, schoolId),
      eq(students.isActive, true)
    ),
  });

  // Fallback for school administrators testing parent view
  if (!student) {
    student = await db.query.students.findFirst({
      where: and(eq(students.schoolId, schoolId), eq(students.isActive, true)),
    });
  }

  if (!student) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center space-y-3">
        <Users className="w-10 h-10 text-slate-500 mx-auto" />
        <h2 className="text-lg font-bold text-white">
          No Student Ward Linked
        </h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          No active student enrollment was found linked to your parent account. Please contact your school administration to verify your mobile number and parent linkage.
        </p>
      </div>
    );
  }

  const [currentClass, currentSection] = await Promise.all([
    student.currentClassId
      ? db.query.classes.findFirst({ where: eq(classes.id, student.currentClassId) })
      : null,
    student.currentSectionId
      ? db.query.sections.findFirst({ where: eq(sections.id, student.currentSectionId) })
      : null,
  ]);

  const childName = `${decryptData(student.firstNameEncrypted)} ${decryptData(student.lastNameEncrypted)}`.trim();
  const className = currentClass?.displayName || "Standard Class";
  const sectionName = currentSection?.name || "A";

  // 2. Fetch Attendance Records for this child
  const attendanceLogs = await db.query.studentAttendance.findMany({
    where: eq(studentAttendance.studentId, student.id),
    orderBy: [desc(studentAttendance.attendanceDate)],
    limit: 60,
  });

  const totalAttendance = attendanceLogs.length;
  const presentCount = attendanceLogs.filter((a) => a.status === "PRESENT").length;
  const absentCount = attendanceLogs.filter((a) => a.status === "ABSENT").length;
  const attendanceRate = totalAttendance > 0
    ? ((presentCount / totalAttendance) * 100).toFixed(1)
    : "100.0";

  // Today's attendance
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayLog = attendanceLogs.find((a) => {
    const d = new Date(a.attendanceDate);
    return d >= today && d < tomorrow;
  });

  // 3. Fetch Fee Invoices & Balances
  const invoices = await db.query.feeInvoices.findMany({
    where: eq(feeInvoices.studentId, student.id),
    orderBy: [desc(feeInvoices.dueDate)],
    limit: 10,
  });

  let totalDue = 0;
  let totalPaid = 0;
  invoices.forEach((inv) => {
    totalDue += parseFloat(inv.balanceAmount || "0");
    totalPaid += parseFloat(inv.paidAmount || "0");
  });

  // 4. Fetch Bus Pass & Transit info
  const busPass = await db.query.studentBusPasses.findFirst({
    where: and(
      eq(studentBusPasses.studentId, student.id),
      eq(studentBusPasses.isActive, true)
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
  });

  // Latest GPS ping for assigned bus
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

  // 5. Fetch Report Cards
  const childReportCards = await db.query.reportCards.findMany({
    where: eq(reportCards.studentId, student.id),
    with: {
      exam: true,
    },
    orderBy: [desc(reportCards.createdAt)],
    limit: 5,
  });

  const activeTab = searchParams?.tab || "overview";

  return (
    <div className="space-y-5">
      {/* ─── 1. Ward Profile Hero Banner ────────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 border border-indigo-900/40 p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-black text-xl flex items-center justify-center shrink-0">
              {childName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  <Users className="w-3.5 h-3.5" /> Enrolled Ward
                </span>
                <span className="text-xs text-slate-400">
                  Adm #{student.admissionNumber}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                {childName}
              </h1>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                {className} • Section {sectionName} • Roll #{student.rollNumber || "1"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/parent/dashboard?tab=fees"
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold text-xs transition shadow-md shadow-indigo-600/30 flex items-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              Pay School Fees
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Filter Pills Bar ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
        <Link
          href="/parent/dashboard"
          className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition ${
            activeTab === "overview"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          Overview
        </Link>
        <Link
          href="/parent/dashboard?tab=attendance"
          className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition ${
            activeTab === "attendance"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          Attendance
        </Link>
        <Link
          href="/parent/dashboard?tab=fees"
          className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition ${
            activeTab === "fees"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          Fee Portal
        </Link>
        <Link
          href="/parent/dashboard?tab=bus"
          className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition ${
            activeTab === "bus"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          Bus Tracker
        </Link>
        <Link
          href="/parent/dashboard?tab=academics"
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
        <div className="space-y-5">
          {/* Metric Stat Row */}
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
                {totalDue > 0 ? "Term dues pending" : "Zero balance due"}
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

          {/* Quick Sections Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Recent Invoices Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-400" />
                  Fee Invoices
                </h3>
                <Link
                  href="/parent/dashboard?tab=fees"
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  Pay Fees <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {invoices.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No invoices generated for this academic session yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {invoices.slice(0, 3).map((inv) => (
                    <div
                      key={inv.id}
                      className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-white">
                          Invoice #{inv.invoiceNumber}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Due: {new Date(inv.dueDate).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
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
                  ))}
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
                    href="/parent/dashboard?tab=bus"
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
                    href="/parent/dashboard?tab=bus"
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
              Attendance Record &amp; History
            </h2>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {attendanceRate}% Overall
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
            <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/60">
              <div className="text-slate-400">Total Logged</div>
              <div className="text-base font-bold text-white mt-0.5">{totalAttendance}</div>
            </div>
            <div className="p-2.5 rounded-xl border border-emerald-900/40 bg-emerald-950/30">
              <div className="text-emerald-400">Present</div>
              <div className="text-base font-bold text-emerald-300 mt-0.5">{presentCount}</div>
            </div>
            <div className="p-2.5 rounded-xl border border-rose-900/40 bg-rose-950/30">
              <div className="text-rose-400">Absent</div>
              <div className="text-base font-bold text-rose-300 mt-0.5">{absentCount}</div>
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
                          {new Date(log.attendanceDate).toLocaleDateString("en-IN", {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                        {log.remarks && (
                          <div className="text-[10px] text-slate-400">{log.remarks}</div>
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
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              Fee Ledger &amp; Payments
            </h2>
            <div className="text-sm font-bold text-emerald-400">
              Due: ₹{totalDue.toLocaleString()}
            </div>
          </div>

          <div className="space-y-2.5">
            {invoices.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                No fee invoices generated yet.
              </p>
            ) : (
              invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-white text-sm">
                      Invoice #{inv.invoiceNumber}
                    </div>
                    <div className="text-slate-400 mt-0.5">
                      Due: {new Date(inv.dueDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-white text-base">
                      ₹{parseFloat(inv.netAmount).toLocaleString()}
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
              ))
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
                Live Transit Tracking • {busPass?.route?.vehicle?.busNumber || "School Bus"}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Stop: <strong className="text-slate-200">{busPass?.stop?.stopName || "Main Gate"}</strong> (ETA: {busPass?.stop?.estimatedArrivalTime || "07:45 AM"})
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 self-start sm:self-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Route Satellite Active
            </span>
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
              No active bus pass allocated to this student.
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: REPORT CARDS ─────────────────────────────────────────────── */}
      {activeTab === "academics" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-5 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-purple-400" />
            Scholastic Progress &amp; Report Cards
          </h2>

          {childReportCards.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-slate-950/60 text-slate-400 text-xs space-y-1">
              <Award className="w-8 h-8 text-slate-500 mx-auto mb-1" />
              <p>Term evaluations currently in progress.</p>
              <p className="text-[11px] text-slate-500">
                Official report cards will be published here upon completion of examination cycles.
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
                    <div className="font-bold text-white">{rc.exam?.name || "Term Exam"}</div>
                    <div className="text-[11px] text-slate-400">
                      Grade: {rc.overallGrade || "A"} {rc.rank ? `• Rank #${rc.rank}` : ""}
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
