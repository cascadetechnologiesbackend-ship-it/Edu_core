import { db } from "@/db";
import {
  students,
  resultSnapshots,
  reportCardSetups,
  resultSettings,
  resultHolds,
  feeInvoices,
  classes,
  auditLogs,
  reportCards,
  exams,
} from "@/db/schema";
import { eq, and, isNull, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { decryptData } from "@/lib/encryption";
import Link from "next/link";
import {
  Award,
  Download,
  FileText,
  AlertTriangle,
  Lock,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  CreditCard,
} from "lucide-react";

export default async function ParentReportCardsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-center text-xs text-slate-400">
        Please log in to view report cards.
      </div>
    );
  }

  const userId = session.user.id;
  const userRole = (session.user.role as string) || "PARENT";
  const isPrivileged = [
    "ADMIN",
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ].includes(userRole);

  // 1. Identify students linked to this parent/student
  let myStudents = await db.query.students.findMany({
    where: eq(students.primaryParentUserId, userId),
  });

  if (myStudents.length === 0 && userRole === "STUDENT") {
    myStudents = await db.query.students.findMany({
      where: eq(students.userId, userId),
    });
  }

  // Admin preview fallback
  if (myStudents.length === 0 && isPrivileged) {
    const demoStudent = await db.query.students.findFirst({
      where: eq(students.isActive, true),
    });
    if (demoStudent) myStudents = [demoStudent];
  }

  if (myStudents.length === 0) {
    return (
      <div className="rounded-2xl border border-rose-900/40 bg-rose-950/20 p-6 text-center space-y-2">
        <h2 className="text-base font-bold text-rose-400">Access Restricted</h2>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          No students linked to your account. If you are a parent or student, please contact school administration.
        </p>
      </div>
    );
  }

  const now = new Date();

  // 2. Build report card datasets for all linked students
  const studentReports: Array<{
    student: typeof students.$inferSelect;
    className: string;
    dueAmount: number;
    snapshots: Array<{
      id: string;
      version: number;
      frozenAt: Date;
      setupName: string;
      payload: any;
      gateStatus: {
        isAllowed: boolean;
        isWithheld: boolean;
        isScheduled: boolean;
        releaseAt: Date | null;
        isHold: boolean;
        holdReason: string | null;
        isHardFeeBlocked: boolean;
        isSoftFeeWarning: boolean;
      };
    }>;
    legacyCards: Array<
      typeof reportCards.$inferSelect & {
        exam?: typeof exams.$inferSelect | null;
      }
    >;
  }> = [];

  for (const st of myStudents) {
    // DPDP AUDIT LOGGING
    await db.insert(auditLogs).values({
      schoolId: st.schoolId,
      userId,
      userEmail: session.user.email || "unknown@portal",
      userRole,
      action: "READ",
      tableName: "result_snapshots",
      recordId: st.id,
      ipAddress: "127.0.0.1",
      userAgent: "PortalReportCard",
      metadata: { note: "Parent/Student accessed report card portal" },
    });

    // Class display name
    let className = "Standard / Class";
    if (st.currentClassId) {
      const cls = await db.query.classes.findFirst({
        where: eq(classes.id, st.currentClassId),
      });
      if (cls) className = cls.displayName;
    }

    // Unpaid fee dues
    const invoices = await db.query.feeInvoices.findMany({
      where: and(
        eq(feeInvoices.schoolId, st.schoolId),
        eq(feeInvoices.studentId, st.id),
        isNull(feeInvoices.deletedAt),
      ),
      columns: { balanceAmount: true },
    });

    let dueAmount = 0;
    for (const inv of invoices) {
      const bal = parseFloat(inv.balanceAmount || "0");
      if (bal > 0) dueAmount += bal;
    }

    // Query S8 result snapshots
    const rawSnapshots = await db.query.resultSnapshots.findMany({
      where: and(
        eq(resultSnapshots.schoolId, st.schoolId),
        eq(resultSnapshots.studentId, st.id),
        eq(resultSnapshots.isCurrent, true),
      ),
      with: { setup: true },
      orderBy: (t, { desc }) => [desc(t.frozenAt)],
    });

    const evaluatedSnapshots = await Promise.all(
      rawSnapshots.map(async (snap) => {
        const [settings, hold] = await Promise.all([
          db.query.resultSettings.findFirst({
            where: and(
              eq(resultSettings.schoolId, st.schoolId),
              eq(resultSettings.setupId, snap.setupId),
            ),
          }),
          db.query.resultHolds.findFirst({
            where: and(
              eq(resultHolds.schoolId, st.schoolId),
              eq(resultHolds.setupId, snap.setupId),
              eq(resultHolds.studentId, st.id),
            ),
          }),
        ]);

        const isWithheld = settings?.withholdAll ?? false;
        const releaseAt = settings?.releaseAt ?? null;
        const isScheduled = Boolean(releaseAt && new Date(releaseAt) > now);
        const isHold = Boolean(hold);
        const holdReason = hold?.reason ?? null;

        const feeThreshold = parseFloat(settings?.feeLockThresholdAmount || "0");
        const isHardFeeBlocked =
          settings?.feeLockMode === "HARD" && dueAmount > feeThreshold;
        const isSoftFeeWarning =
          settings?.feeLockMode === "SOFT" && dueAmount > feeThreshold;

        const isAllowed =
          !isWithheld && !isScheduled && !isHold && !isHardFeeBlocked;

        return {
          id: snap.id,
          version: snap.version,
          frozenAt: snap.frozenAt,
          setupName: snap.setup?.name || "Term Evaluation",
          payload: snap.payload,
          gateStatus: {
            isAllowed,
            isWithheld,
            isScheduled,
            releaseAt,
            isHold,
            holdReason,
            isHardFeeBlocked,
            isSoftFeeWarning,
          },
        };
      }),
    );

    // Query legacy reportCards
    const legacyCards = await db.query.reportCards.findMany({
      where: eq(reportCards.studentId, st.id),
      with: { exam: true },
      orderBy: (t, { desc }) => [desc(t.generatedAt)],
    });

    studentReports.push({
      student: st,
      className,
      dueAmount,
      snapshots: evaluatedSnapshots,
      legacyCards,
    });
  }

  return (
    <div className="space-y-6">
      {/* ─── 1. Header & Navigation Tabs ──────────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Scholastic Report Cards
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            View immutable term report cards, verified grades, and official academic marksheets.
          </p>
        </div>

        {/* Dedicated Horizontal Pill Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          <Link
            href="/portal"
            className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
          >
            Fees &amp; Dues
          </Link>
          <span className="px-3.5 py-2 rounded-xl font-bold bg-indigo-600 text-white shadow-md shadow-indigo-600/30 whitespace-nowrap">
            Report Cards
          </span>
          <Link
            href="/portal/admit-cards"
            className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
          >
            Admit Cards
          </Link>
          <Link
            href="/portal/consent"
            className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
          >
            Consent Center
          </Link>
          <Link
            href="/parent/documents"
            className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
          >
            Documents
          </Link>
          <Link
            href="/portal/rights"
            className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
          >
            Subject Rights
          </Link>
        </div>
      </div>

      {/* ─── 2. Student Cards ─────────────────────────────────────────────────── */}
      <div className="space-y-6">
        {studentReports.map(({ student, className, dueAmount, snapshots, legacyCards }) => {
          const studentName = `${decryptData(student.firstNameEncrypted) || ""} ${
            decryptData(student.lastNameEncrypted) || ""
          }`.trim() || "Student";

          return (
            <div
              key={student.id}
              className="rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur-sm p-5 md:p-6 shadow-xl space-y-5"
            >
              {/* Student Header */}
              <div className="border-b border-slate-800/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">{studentName}</h2>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span>
                      Admission No:{" "}
                      <strong className="text-slate-200">{student.admissionNumber}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Standard: <strong className="text-slate-200">{className}</strong>
                    </span>
                    {student.rollNumber && (
                      <>
                        <span>•</span>
                        <span>
                          Roll: <strong className="text-slate-200">{student.rollNumber}</strong>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 self-start sm:self-center">
                  Enrolled Ward
                </span>
              </div>

              {/* No Report Cards Yet */}
              {snapshots.length === 0 && legacyCards.length === 0 && (
                <div className="p-8 text-center rounded-2xl bg-slate-950/60 border border-slate-800/80 text-slate-400 text-xs space-y-2">
                  <Award className="w-8 h-8 text-slate-600 mx-auto mb-1" />
                  <p className="font-semibold text-white">Evaluation Cycles in Progress</p>
                  <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                    Official term report cards will appear here upon completion of grading and administrative verification.
                  </p>
                </div>
              )}

              {/* S8 Result Snapshots */}
              {snapshots.map((snap) => {
                const { gateStatus } = snap;
                const payload = snap.payload as any;
                const summary = payload?.summary || {};
                const subjects = (payload?.subjects as any[]) || [];

                // Blocked Gate Scenarios
                if (!gateStatus.isAllowed) {
                  return (
                    <div
                      key={snap.id}
                      className="p-5 rounded-2xl border border-slate-800 bg-slate-950/80 space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                        <span className="font-bold text-white text-sm">
                          {snap.setupName}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Verified v{snap.version}
                        </span>
                      </div>

                      {/* Withheld */}
                      {gateStatus.isWithheld && (
                        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                          <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <strong className="block">Results Withheld by Administration</strong>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Term results are currently undergoing final administrative verification. They will be unlocked shortly.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Scheduled in future */}
                      {gateStatus.isScheduled && (
                        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                          <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <strong className="block">Scheduled Release</strong>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Results for this term will be officially published on{" "}
                              <strong className="text-white">
                                {gateStatus.releaseAt
                                  ? new Date(gateStatus.releaseAt).toLocaleString("en-IN")
                                  : "upcoming date"}
                              </strong>
                              .
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Individual Hold */}
                      {gateStatus.isHold && (
                        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <strong className="block">Result Placed on Administrative Hold</strong>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Reason: {gateStatus.holdReason || "Administrative verification pending"}. Please contact the school office.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Hard Fee Defaulter Gate */}
                      {gateStatus.isHardFeeBlocked && (
                        <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/40 text-xs space-y-3">
                          <div className="flex items-start gap-3 text-rose-300">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <div>
                              <strong className="block">Tuition Fee Clearance Required</strong>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                An outstanding fee balance of{" "}
                                <strong className="text-rose-400">
                                  ₹{dueAmount.toLocaleString("en-IN")}
                                </strong>{" "}
                                is pending for this student profile. Per school policy, clearance of dues is required to view official report cards.
                              </p>
                            </div>
                          </div>
                          <Link
                            href="/portal"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-md shadow-rose-600/20"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Pay Fees Online</span>
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                }

                // Allowed Gate - Display Full Academic Report Card
                return (
                  <div
                    key={snap.id}
                    className="p-5 md:p-6 rounded-2xl border border-slate-800 bg-slate-950/80 space-y-5"
                  >
                    {/* Top Row: Title, Date, Download */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-base">
                            {snap.setupName}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            v{snap.version} Verified
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Published: {new Date(snap.frozenAt).toLocaleDateString("en-IN")}
                        </p>
                      </div>

                      <a
                        href={`/api/report-cards/${snap.id}/download`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 self-start sm:self-center"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Official PDF</span>
                      </a>
                    </div>

                    {/* Soft Warning Banner (if dues exist but mode is SOFT) */}
                    {gateStatus.isSoftFeeWarning && (
                      <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>
                            Notice: Outstanding fee balance of{" "}
                            <strong>₹{dueAmount.toLocaleString("en-IN")}</strong>. Please clear at your earliest convenience.
                          </span>
                        </div>
                        <Link
                          href="/portal"
                          className="text-[11px] font-bold underline hover:text-white shrink-0"
                        >
                          Pay Dues
                        </Link>
                      </div>
                    )}

                    {/* Summary KPI Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Total Marks
                        </span>
                        <span className="text-lg font-black text-white">
                          {summary.totalMarks ?? 0}
                          <span className="text-xs text-slate-500 font-normal">
                            {" "}
                            / {summary.totalMax ?? 0}
                          </span>
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Percentage
                        </span>
                        <span className="text-lg font-black text-indigo-400">
                          {summary.percentage ?? 0}%
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Overall Grade
                        </span>
                        <span className="text-lg font-black text-emerald-400">
                          {summary.overallGrade ?? "—"}
                          {summary.division && (
                            <span className="text-[10px] text-slate-400 font-normal ml-1">
                              ({summary.division})
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Result Status
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              summary.resultStatus === "PASSED"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            }`}
                          >
                            {summary.resultStatus ?? "EVALUATED"}
                          </span>
                          {summary.rank && (
                            <span className="text-xs font-bold text-amber-400 flex items-center gap-0.5">
                              <Award className="w-3.5 h-3.5" />
                              Rank #{summary.rank}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Scholastic Subject Breakdown */}
                    {subjects.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                          Subject Evaluation Breakdown
                        </h4>
                        <div className="overflow-x-auto rounded-xl border border-slate-800">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                              <tr>
                                <th className="p-3">Subject</th>
                                <th className="p-3 text-right">Marks Obtained</th>
                                <th className="p-3 text-right">Maximum</th>
                                <th className="p-3 text-right">Percentage</th>
                                <th className="p-3 text-center">Grade</th>
                                <th className="p-3 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                              {subjects.map((sub: any, idx: number) => (
                                <tr key={sub.subjectId || idx} className="hover:bg-slate-900/30">
                                  <td className="p-3 font-medium text-white">
                                    {sub.subjectName}
                                  </td>
                                  <td className="p-3 text-right font-bold text-white">
                                    {sub.totalObtained}
                                  </td>
                                  <td className="p-3 text-right text-slate-400">
                                    {sub.totalMax}
                                  </td>
                                  <td className="p-3 text-right text-indigo-400 font-medium">
                                    {sub.percent}%
                                  </td>
                                  <td className="p-3 text-center">
                                    <span className="px-2 py-0.5 rounded font-bold bg-slate-800 text-slate-200">
                                      {sub.grade}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center">
                                    <span
                                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                        sub.isPassed
                                          ? "text-emerald-400 bg-emerald-500/10"
                                          : "text-rose-400 bg-rose-500/10"
                                      }`}
                                    >
                                      {sub.isPassed ? "PASS" : "FAIL"}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Legacy Report Cards Archive */}
              {legacyCards.length > 0 && (
                <div className="pt-2 border-t border-slate-800/60 space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Archived Term Records
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {legacyCards.map((card) => (
                      <div
                        key={card.id}
                        className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-bold text-white text-sm">
                            {card.exam?.name ?? "Examination Archive"}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Generated:{" "}
                            {card.generatedAt
                              ? new Date(card.generatedAt).toLocaleDateString("en-IN")
                              : "—"}
                          </div>
                          <div className="text-xs text-indigo-400 mt-1 font-semibold">
                            Grade: {card.overallGrade ?? "—"}{" "}
                            {card.rank ? `• Rank #${card.rank}` : ""}
                          </div>
                        </div>

                        <a
                          href={`/api/report-cards/${card.id}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-bold text-xs transition flex items-center justify-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" /> Download PDF
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
