import { db, withTenant } from "@/db";
import {
  exams,
  academicYears,
  classes,
  subjects,
  classSubjects,
  students,
  markEntries,
  examMarkDistributions,
  examComponents,
  examMarksLocks,
  examSchedules,
  users,
  schools,
} from "@/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { Metadata } from "next";
import { requireAuth } from "@/lib/serverAuth";
import { redirect } from "next/navigation";
import { assertRouteAccess } from "@/lib/routeGuards";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";
import { decryptData } from "@/lib/encryption";
import {
  MarksEntryClient,
  type ComponentCol,
  type StudentRow,
} from "./MarksEntryClient";
import Link from "next/link";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";

export const metadata: Metadata = {
  title: "Scholastic Marks Entry Matrix | SchoolMitra ERP",
  description: "Record evaluation scores, component marks, and lock grade submissions",
};

const MARKS_ADMIN_ROLES = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "PRINCIPAL",
] as const;

export default async function MarksAdminPage({
  searchParams,
}: {
  searchParams: {
    examId?: string;
    classId?: string;
    subjectId?: string;
  };
}) {
  const ctx = await requireAuth(MARKS_ADMIN_ROLES);
  const access = assertRouteAccess(ctx.role, "/exams/marks", {
    id: ctx.userId,
    email: ctx.email,
  });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  let schoolId = ctx.schoolId || "";
  if (!schoolId && ctx.role === "SUPER_ADMIN") {
    const activeSchool = await db.query.schools.findFirst({
      where: eq(schools.isActive, true),
      columns: { id: true },
    });
    schoolId = activeSchool?.id || "";
  }

  const data = await withDataPhaseTiming("/exams/marks", async () => {
    return assertQueryBudget(
      async () => {
        return await withTenant(schoolId, async (tx) => {
          const activeYear = await tx.query.academicYears.findFirst({
            where: and(
              eq(academicYears.schoolId, schoolId),
              eq(academicYears.isActive, true),
            ),
          });

          if (!activeYear) {
            return {
              examsList: [],
              selectedExamId: "",
              classList: [],
              selectedClassId: "",
              subjectsList: [],
              selectedSubjectId: "",
              lockInfo: { isLocked: false, lockedByName: null, lockedAt: null },
              components: [],
              defaultMaxMarks: 100,
              defaultPassingMarks: 33,
              students: [],
            };
          }

          const examsList = await tx.query.exams.findMany({
            where: and(
              eq(exams.schoolId, schoolId),
              eq(exams.academicYearId, activeYear.id),
            ),
            orderBy: (t, { desc }) => [desc(t.startDate)],
          });

          const selectedExamId =
            searchParams.examId && examsList.some((e) => e.id === searchParams.examId)
              ? searchParams.examId
              : examsList[0]?.id || "";

          const classList = await tx.query.classes.findMany({
            where: eq(classes.schoolId, schoolId),
            orderBy: (t, { asc }) => [asc(t.displayName)],
          });

          const selectedClassId =
            searchParams.classId && classList.some((c) => c.id === searchParams.classId)
              ? searchParams.classId
              : classList[0]?.id || "";

          // Query subjects assigned to this class
          let subjectsList: Array<{ id: string; name: string; code: string }> = [];
          if (selectedClassId) {
            const classSubs = await tx.query.classSubjects.findMany({
              where: and(
                eq(classSubjects.schoolId, schoolId),
                eq(classSubjects.classId, selectedClassId),
              ),
              with: { subject: true },
            });

            subjectsList = classSubs
              .filter((cs) => cs.subject)
              .map((cs) => ({
                id: cs.subject!.id,
                name: cs.subject!.name,
                code: cs.subject!.code,
              }));
          }

          // Fallback to all subjects if none mapped to class
          if (subjectsList.length === 0) {
            const allSubs = await tx.query.subjects.findMany({
              where: eq(subjects.schoolId, schoolId),
              orderBy: (t, { asc }) => [asc(t.name)],
            });
            subjectsList = allSubs.map((s) => ({
              id: s.id,
              name: s.name,
              code: s.code,
            }));
          }

          const selectedSubjectId =
            searchParams.subjectId &&
            subjectsList.some((s) => s.id === searchParams.subjectId)
              ? searchParams.subjectId
              : subjectsList[0]?.id || "";

          if (!selectedExamId || !selectedClassId || !selectedSubjectId) {
            return {
              examsList: examsList.map((e) => ({ id: e.id, name: e.name })),
              selectedExamId,
              classList: classList.map((c) => ({ id: c.id, displayName: c.displayName })),
              selectedClassId,
              subjectsList,
              selectedSubjectId,
              lockInfo: { isLocked: false, lockedByName: null, lockedAt: null },
              components: [],
              defaultMaxMarks: 100,
              defaultPassingMarks: 33,
              students: [],
            };
          }

          // Parallel query for schedules, distributions, lock state, and enrolled students
          const [scheduleRecord, distributions, lockRecord, rawStudents] =
            await Promise.all([
              tx.query.examSchedules.findFirst({
                where: and(
                  eq(examSchedules.schoolId, schoolId),
                  eq(examSchedules.examId, selectedExamId),
                  eq(examSchedules.classId, selectedClassId),
                  eq(examSchedules.subjectId, selectedSubjectId),
                ),
              }),
              tx.query.examMarkDistributions.findMany({
                where: and(
                  eq(examMarkDistributions.schoolId, schoolId),
                  eq(examMarkDistributions.examId, selectedExamId),
                  eq(examMarkDistributions.classId, selectedClassId),
                  eq(examMarkDistributions.subjectId, selectedSubjectId),
                ),
                with: {
                  component: true,
                },
              }),
              tx.query.examMarksLocks.findFirst({
                where: and(
                  eq(examMarksLocks.schoolId, schoolId),
                  eq(examMarksLocks.examId, selectedExamId),
                  eq(examMarksLocks.classId, selectedClassId),
                  eq(examMarksLocks.subjectId, selectedSubjectId),
                ),
                with: {
                  lockedBy: true,
                },
              }),
              tx.query.students.findMany({
                where: and(
                  eq(students.schoolId, schoolId),
                  eq(students.currentClassId, selectedClassId),
                  eq(students.isActive, true),
                ),
                orderBy: (t, { asc }) => [asc(t.rollNumber), asc(t.admissionNumber)],
              }),
            ]);

          const defaultMaxMarks = scheduleRecord?.maxMarks
            ? parseFloat(scheduleRecord.maxMarks)
            : 100;
          const defaultPassingMarks = scheduleRecord?.passingMarks
            ? parseFloat(scheduleRecord.passingMarks)
            : 33;

          // Components
          const components: ComponentCol[] = distributions
            .filter((d) => d.component !== null && d.component !== undefined)
            .map((d) => ({
              id: d.component!.id,
              name: d.component!.displayName,
              maxMarks: parseFloat(d.maxMarks),
              passingMarks: parseFloat(d.passingMarks),
            }));

          // Lock info
          const isLocked = lockRecord?.status === "LOCKED";
          const lockInfo = {
            isLocked,
            lockedByName: lockRecord?.lockedBy?.email || null,
            lockedAt: lockRecord?.lockedAt ? lockRecord.lockedAt.toISOString() : null,
          };

          // Existing marks
          const studentIds = rawStudents.map((s) => s.id);
          const existingEntries =
            studentIds.length > 0
              ? await tx.query.markEntries.findMany({
                  where: and(
                    eq(markEntries.schoolId, schoolId),
                    eq(markEntries.examId, selectedExamId),
                    eq(markEntries.subjectId, selectedSubjectId),
                    inArray(markEntries.studentId, studentIds),
                  ),
                })
              : [];

          // Build marks map: studentId -> { marks: Record<string, string>, isAbsent, isMedicalExempt, remarks }
          const marksLookup = new Map<
            string,
            {
              marks: Record<string, string>;
              isAbsent: boolean;
              isMedicalExempt: boolean;
              remarks: string;
            }
          >();

          for (const entry of existingEntries) {
            const current = marksLookup.get(entry.studentId) || {
              marks: {},
              isAbsent: false,
              isMedicalExempt: false,
              remarks: "",
            };

            const key = entry.componentId || "_total";
            if (entry.marksObtained !== null && entry.marksObtained !== undefined) {
              current.marks[key] = entry.marksObtained;
            }
            if (entry.isAbsent) current.isAbsent = true;
            if (entry.isMedicalExempt) current.isMedicalExempt = true;
            if (entry.remarks) current.remarks = entry.remarks;

            marksLookup.set(entry.studentId, current);
          }

          const studentRows: StudentRow[] = rawStudents.map((st) => {
            const first = decryptData(st.firstNameEncrypted) || "";
            const last = decryptData(st.lastNameEncrypted) || "";
            const fullName = `${first} ${last}`.trim() || "Student";
            const entryData = marksLookup.get(st.id) || {
              marks: {},
              isAbsent: false,
              isMedicalExempt: false,
              remarks: "",
            };

            return {
              id: st.id,
              rollNumber: st.rollNumber,
              admissionNumber: st.admissionNumber,
              name: fullName,
              marks: entryData.marks,
              isAbsent: entryData.isAbsent,
              isMedicalExempt: entryData.isMedicalExempt,
              remarks: entryData.remarks,
            };
          });

          return {
            examsList: examsList.map((e) => ({ id: e.id, name: e.name })),
            selectedExamId,
            classList: classList.map((c) => ({ id: c.id, displayName: c.displayName })),
            selectedClassId,
            subjectsList,
            selectedSubjectId,
            lockInfo,
            components,
            defaultMaxMarks,
            defaultPassingMarks,
            students: studentRows,
          };
        });
      },
      { maxQueries: 10 },
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/exams/dashboard"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Marks Entry &amp; Gradebook Matrix
              </h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Enter component evaluation scores, manage absent/medical exemptions, and lock finalized grades
            </p>
          </div>
        </div>
      </div>

      <MarksEntryClient
        exams={data.examsList}
        selectedExamId={data.selectedExamId}
        classes={data.classList}
        selectedClassId={data.selectedClassId}
        subjects={data.subjectsList}
        selectedSubjectId={data.selectedSubjectId}
        lockInfo={data.lockInfo}
        components={data.components}
        defaultMaxMarks={data.defaultMaxMarks}
        defaultPassingMarks={data.defaultPassingMarks}
        initialStudents={data.students}
        canLockUnlock={true}
      />
    </div>
  );
}
