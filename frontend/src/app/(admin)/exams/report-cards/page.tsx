import { db } from "@/db";
import {
  exams,
  classes,
  reportCards,
  reportCardJobs,
  academicYears,
  certificates,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { Metadata } from "next";
import { BulkGenerateButton } from "./BulkGenerateButton";
import { MeritListManager } from "./MeritListManager";
import { decryptData } from "@/lib/encryption";

export const metadata: Metadata = {
  title: "Report Cards | SchoolMitra ERP",
};

export default async function ReportCardsPage({
  searchParams,
}: {
  searchParams: { examId?: string };
}) {
  const activeYear = await db.query.academicYears.findFirst({
    where: eq(academicYears.isActive, true),
  });

  const allExams = activeYear
    ? await db.query.exams.findMany({
        where: eq(exams.academicYearId, activeYear.id),
        with: { examType: true },
        orderBy: (t, { desc }) => [desc(t.startDate)],
      })
    : [];

  const selectedExamId = searchParams.examId ?? allExams[0]?.id;

  const allClasses = activeYear
    ? await db.query.classes.findMany({
        where: eq(classes.academicYearId, activeYear.id),
        orderBy: (t, { asc }) => [asc(t.sortOrder)],
      })
    : [];

  // Fetch all students to build a decryption map
  const rawStudents = await db.query.students.findMany();
  const studentMap = new Map(
    rawStudents.map((s) => [
      s.id,
      {
        name: `${decryptData(s.firstNameEncrypted)} ${decryptData(s.lastNameEncrypted)}`,
        admissionNumber: s.admissionNumber,
      },
    ]),
  );

  const managerStudents = rawStudents.map((s) => ({
    id: s.id,
    name: `${decryptData(s.firstNameEncrypted)} ${decryptData(s.lastNameEncrypted)}`,
    admissionNumber: s.admissionNumber,
  }));

  // Recent batch jobs
  const recentJobs = selectedExamId
    ? await db.query.reportCardJobs.findMany({
        where: eq(reportCardJobs.examId, selectedExamId),
        with: { class: true },
        orderBy: (t, { desc }) => [desc(t.createdAt)],
      })
    : [];

  // Recently generated report cards
  const recentCards = selectedExamId
    ? await db.query.reportCards.findMany({
        where: eq(reportCards.examId, selectedExamId),
        orderBy: (t, { desc }) => [desc(t.generatedAt)],
      })
    : [];

  // Certificates
  const issuedCertificates = selectedExamId
    ? await db.query.certificates.findMany({
        where: eq(
          certificates.schoolId,
          allExams.find((e) => e.id === selectedExamId)?.schoolId ?? "",
        ),
      })
    : [];

  const selectedExam = allExams.find((e) => e.id === selectedExamId);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Report Cards
        </h1>
        <p className="text-sm text-gray-500">
          Generate and manage report cards for each exam.
        </p>
      </div>

      {/* Exam Selector */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4">
        <label className="block text-sm font-medium mb-2">Select Exam</label>
        <div className="flex gap-2 flex-wrap">
          {allExams.map((e) => (
            <Link
              key={e.id}
              href={`/exams/report-cards?examId=${e.id}`}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                selectedExamId === e.id
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
              }`}
            >
              {e.name}
            </Link>
          ))}
        </div>
      </div>

      {selectedExam && (
        <>
          {/* Bulk Generation */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6">
            <h2 className="font-semibold text-lg mb-4">
              Generate Report Cards — {selectedExam.name}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Click a class below to queue report card PDF generation for all
              students in that class. Jobs are processed asynchronously — the
              PDFs will be available in the parent portal once generation is
              complete.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {allClasses.map((cls) => (
                <div
                  key={cls.id}
                  className="border border-gray-200 dark:border-slate-700 rounded-lg p-4"
                >
                  <p className="font-semibold mb-3 text-gray-900 dark:text-white">
                    {cls.displayName}
                  </p>
                  <BulkGenerateButton
                    examId={selectedExamId!}
                    classId={cls.id}
                    className={cls.displayName}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Batch Job Status */}
          {recentJobs.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                <h2 className="font-semibold">Generation Jobs Status</h2>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-slate-800">
                {recentJobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-4 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium">{job.class?.displayName}</p>
                      <p className="text-xs text-gray-500">
                        {job.processedCount}/{job.totalStudents} processed
                        {job.failedCount > 0 && (
                          <span className="ml-2 text-red-500">
                            {job.failedCount} failed
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(job.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        job.status === "DONE"
                          ? "bg-green-100 text-green-800"
                          : job.status === "FAILED"
                            ? "bg-red-100 text-red-800"
                            : job.status === "PROCESSING"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generated Report Cards */}
          {recentCards.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                <h2 className="font-semibold">
                  Generated Report Cards ({recentCards.length})
                </h2>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
                {recentCards.map((card) => {
                  const sInfo = studentMap.get(card.studentId) || {
                    name: card.studentId,
                    admissionNumber: "—",
                  };
                  return (
                    <div
                      key={card.id}
                      className="p-3 flex justify-between items-center"
                    >
                      <div>
                        <p className="font-medium text-sm text-gray-900 dark:text-white">
                          {sInfo.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          Admission No: {sInfo.admissionNumber} | Grade:{" "}
                          {card.overallGrade ?? "—"}{" "}
                          {card.rank && `| Rank: ${card.rank}`}
                        </p>
                      </div>
                      <a
                        href={`/api/report-cards/${card.id}/download`}
                        target="_blank"
                        className="text-xs text-indigo-600 hover:underline px-2 py-1 bg-indigo-50 rounded"
                      >
                        Download PDF
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Merit List Manager */}
          <MeritListManager
            examId={selectedExamId!}
            classes={allClasses.map((c) => ({
              id: c.id,
              displayName: c.displayName,
            }))}
            students={managerStudents}
            reportCards={recentCards.map((rc) => ({
              id: rc.id,
              studentId: rc.studentId,
              rank: rc.rank,
              overallGrade: rc.overallGrade,
            }))}
            issuedCertificates={issuedCertificates.map((c) => ({
              id: c.id,
              studentId: c.studentId,
              certificateNumber: c.certificateNumber,
              remarks: c.remarks,
            }))}
          />
        </>
      )}
    </div>
  );
}
