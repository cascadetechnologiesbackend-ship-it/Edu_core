import { db } from "@/db";
import { students, reportCards, exams, auditLogs } from "@/db/schema";
import { eq, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { decryptData } from "@/lib/encryption";
import Link from "next/link";

export default async function ParentReportCardsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return <div className="p-6">Please log in to view report cards.</div>;
  }

  const parentUserId = session.user.id;
  const isAdmin = ["ADMIN", "SUPER_ADMIN", "PRINCIPAL", "TEACHER"].includes(
    session.user.role as string,
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
      <div className="p-6">
        <h2 className="text-xl font-bold text-red-600 mb-2">
          Access Restricted
        </h2>
        <p>
          No students linked to your account. If you are a parent, please
          contact the school administration.
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
    // DPDP AUDIT LOGGING for viewing minor student academic/report card records
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
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Navigation Tabs */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Report Cards
          </h1>
          <p className="text-sm text-gray-500">
            View and download academic progress reports for your wards.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/portal"
            className="px-4 py-2 text-sm bg-white border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 dark:bg-slate-900 dark:border-slate-800 dark:text-gray-300 transition-colors"
          >
            Fees & Dues
          </Link>
          <span className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md font-semibold">
            Report Cards
          </span>
        </div>
      </div>

      <div className="space-y-6">
        {studentsReportCards.map(({ student, cards }) => {
          const studentName = `${decryptData(student.firstNameEncrypted)} ${decryptData(student.lastNameEncrypted)}`;
          return (
            <div
              key={student.id}
              className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow border border-gray-200 dark:border-slate-800 space-y-4"
            >
              <div className="border-b border-gray-100 dark:border-slate-800 pb-3 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    {studentName}
                  </h2>
                  <p className="text-xs text-gray-500">
                    Admission No: {student.admissionNumber}
                  </p>
                </div>
                <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
                  Ward
                </span>
              </div>

              {cards.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">
                  No report cards generated yet for this student.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cards.map((card) => (
                    <div
                      key={card.id}
                      className="flex justify-between items-center p-4 border rounded-lg border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {card.exam?.name ?? "Examination"}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Generated on:{" "}
                          {card.generatedAt
                            ? new Date(card.generatedAt).toLocaleDateString(
                                "en-IN",
                              )
                            : "—"}
                        </p>
                        <p className="text-xs text-indigo-600 mt-0.5">
                          Grade: {card.overallGrade ?? "—"}{" "}
                          {card.rank ? `| Rank: ${card.rank}` : ""}
                        </p>
                      </div>
                      <a
                        href={`/api/report-cards/${card.id}/download`}
                        target="_blank"
                        className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700 transition-colors"
                      >
                        Download PDF
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
