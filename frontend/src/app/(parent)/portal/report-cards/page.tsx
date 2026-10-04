import { db } from "@/db";
import { students, reportCards, exams, auditLogs } from "@/db/schema";
import { eq, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { decryptData } from "@/lib/encryption";
import Link from "next/link";
import { Award, Download, FileText, ChevronRight } from "lucide-react";

export default async function ParentReportCardsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-center text-xs text-slate-400">
        Please log in to view report cards.
      </div>
    );
  }

  const parentUserId = session.user.id;
  const isAdmin = ["ADMIN", "SUPER_ADMIN", "PRINCIPAL", "TEACHER"].includes(
    session.user.role as string
  );

  // Find students linked to this parent (primary_parent_user_id)
  let myStudents = await db.query.students.findMany({
    where: eq(students.primaryParentUserId, parentUserId),
  });

  // If Admin and no students, fetch a demo student for preview
  if (myStudents.length === 0 && isAdmin) {
    const demoStudent = await db.query.students.findFirst({
      where: isNotNull(students.primaryParentUserId),
    });
    if (demoStudent) myStudents = [demoStudent];
  }

  if (myStudents.length === 0) {
    return (
      <div className="rounded-2xl border border-rose-900/40 bg-rose-950/20 p-6 text-center space-y-2">
        <h2 className="text-base font-bold text-rose-400">Access Restricted</h2>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          No students linked to your parent account. If you are a parent, please contact the school administration.
        </p>
      </div>
    );
  }

  // Fetch report cards for all linked students
  const studentsReportCards: Array<{
    student: typeof students.$inferSelect;
    cards: Array<
      typeof reportCards.$inferSelect & {
        exam?: typeof exams.$inferSelect | null;
      }
    >;
  }> = [];

  for (const student of myStudents) {
    // DPDP AUDIT LOGGING
    await db.insert(auditLogs).values({
      schoolId: student.schoolId,
      userId: parentUserId,
      userEmail: session.user.email || "unknown@parent",
      userRole: "PARENT",
      action: "READ",
      tableName: "report_cards",
      recordId: student.id,
      ipAddress: "127.0.0.1",
      userAgent: "ParentPortal",
      metadata: { note: "Parent viewed student report cards list" },
    });

    const cards = await db.query.reportCards.findMany({
      where: eq(reportCards.studentId, student.id),
      with: { exam: true },
      orderBy: (t, { desc }) => [desc(t.generatedAt)],
    });

    studentsReportCards.push({
      student,
      cards,
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
            View and download term progress reports and official academic marksheets.
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
            href="/portal/consent"
            className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
          >
            Consent Center
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
      <div className="space-y-5">
        {studentsReportCards.map(({ student, cards }) => {
          const studentName = `${decryptData(student.firstNameEncrypted)} ${decryptData(student.lastNameEncrypted)}`.trim();
          return (
            <div
              key={student.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-sm p-4 sm:p-5 shadow-md space-y-4"
            >
              <div className="border-b border-slate-800/80 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">
                    {studentName}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Admission No: <strong className="text-slate-300">{student.admissionNumber}</strong>
                  </p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                  Enrolled Ward
                </span>
              </div>

              {cards.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-950/60 text-slate-400 text-xs space-y-1">
                  <Award className="w-8 h-8 text-slate-600 mx-auto mb-1" />
                  <p>Term evaluations currently in progress.</p>
                  <p className="text-[11px] text-slate-500">
                    Official report cards will be published here upon completion of evaluation cycles.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {cards.map((card) => (
                    <div
                      key={card.id}
                      className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-white text-sm">
                          {card.exam?.name ?? "Examination"}
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
