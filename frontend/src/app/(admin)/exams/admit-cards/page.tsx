import { db } from "@/db";
import {
  exams,
  academicYears,
  classes,
  students,
  feeInvoices,
  examAdmitCardSettings,
  examAdmitCardHolds,
} from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { Metadata } from "next";
import { requireAuth } from "@/lib/serverAuth";
import { redirect } from "next/navigation";
import { assertRouteAccess } from "@/lib/routeGuards";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";
import { decryptData } from "@/lib/encryption";
import { AdmitCardClient } from "./AdmitCardClient";
import Link from "next/link";
import { ArrowLeft, FileCheck2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Admit Cards & Hall Tickets | SchoolMitra ERP",
  description: "Configure hall tickets, manage fee clearance gates, and student holds",
};

export default async function AdmitCardsAdminPage({
  searchParams,
}: {
  searchParams: { examId?: string };
}) {
  const ctx = await requireAuth();
  const access = assertRouteAccess(ctx.role, "/exams/admit-cards", {
    id: ctx.userId,
    email: ctx.email,
  });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  const schoolId = ctx.schoolId || "";

  const data = await withDataPhaseTiming("/exams/admit-cards", async () => {
    return assertQueryBudget(
      async () => {
        const activeYear = await db.query.academicYears.findFirst({
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
            settings: null,
            studentsList: [],
          };
        }

        const examsList = await db.query.exams.findMany({
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

        const classList = await db.query.classes.findMany({
          where: eq(classes.schoolId, schoolId),
          orderBy: (t, { asc }) => [asc(t.displayName)],
        });

        if (!selectedExamId) {
          return {
            examsList: examsList.map((e) => ({ id: e.id, name: e.name })),
            selectedExamId: "",
            classList: classList.map((c) => ({ id: c.id, displayName: c.displayName })),
            settings: null,
            studentsList: [],
          };
        }

        const [settingsRecord, holdsRecords, rawStudents, rawInvoices] =
          await Promise.all([
            db.query.examAdmitCardSettings.findFirst({
              where: and(
                eq(examAdmitCardSettings.schoolId, schoolId),
                eq(examAdmitCardSettings.examId, selectedExamId),
              ),
            }),
            db.query.examAdmitCardHolds.findMany({
              where: and(
                eq(examAdmitCardHolds.schoolId, schoolId),
                eq(examAdmitCardHolds.examId, selectedExamId),
              ),
            }),
            db.query.students.findMany({
              where: and(
                eq(students.schoolId, schoolId),
                eq(students.isActive, true),
              ),
              orderBy: (t, { asc }) => [asc(t.rollNumber)],
            }),
            db.query.feeInvoices.findMany({
              where: and(
                eq(feeInvoices.schoolId, schoolId),
                isNull(feeInvoices.deletedAt),
              ),
              columns: {
                studentId: true,
                balanceAmount: true,
              },
            }),
          ]);

        // Build dues lookup
        const studentDueMap = new Map<string, number>();
        for (const inv of rawInvoices) {
          const bal = parseFloat(inv.balanceAmount || "0");
          if (bal > 0) {
            studentDueMap.set(
              inv.studentId,
              (studentDueMap.get(inv.studentId) || 0) + bal,
            );
          }
        }

        // Build holds lookup
        const holdsMap = new Map<string, string>();
        for (const h of holdsRecords) {
          holdsMap.set(h.studentId, h.reason);
        }

        // Build class lookup
        const classMap = new Map<string, string>();
        for (const c of classList) {
          classMap.set(c.id, c.displayName);
        }

        const formattedSettings = settingsRecord
          ? {
              ...(settingsRecord.id ? { id: settingsRecord.id } : {}),
              isReleased: settingsRecord.isReleased,
              availableFrom: settingsRecord.availableFrom
                ? settingsRecord.availableFrom.toISOString()
                : null,
              availableUntil: settingsRecord.availableUntil
                ? settingsRecord.availableUntil.toISOString()
                : null,
              instructions: settingsRecord.instructions,
              examCentre: settingsRecord.examCentre,
              reportingTime: settingsRecord.reportingTime,
              feeLockMode: settingsRecord.feeLockMode as "OFF" | "SOFT" | "HARD",
              feeLockThresholdAmount: settingsRecord.feeLockThresholdAmount || "0",
            }
          : null;

        const studentsList = rawStudents.map((st) => {
          const first = decryptData(st.firstNameEncrypted) || "";
          const last = decryptData(st.lastNameEncrypted) || "";
          const fullName = `${first} ${last}`.trim() || "Student";
          const due = studentDueMap.get(st.id) || 0;
          const isHeld = holdsMap.has(st.id);
          const holdReason = holdsMap.get(st.id) || null;
          const className = st.currentClassId
            ? classMap.get(st.currentClassId) || "Unassigned"
            : "Unassigned";

          return {
            id: st.id,
            rollNumber: st.rollNumber,
            admissionNumber: st.admissionNumber,
            name: fullName,
            classId: st.currentClassId,
            className,
            dueAmount: due,
            isHeld,
            holdReason,
          };
        });

        return {
          examsList: examsList.map((e) => ({ id: e.id, name: e.name })),
          selectedExamId,
          classList: classList.map((c) => ({ id: c.id, displayName: c.displayName })),
          settings: formattedSettings,
          studentsList,
        };
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
                <FileCheck2 className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Admit Cards &amp; Hall Tickets
              </h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Configure download schedules, fee defaulter locks, and manage individual student holds
            </p>
          </div>
        </div>
      </div>

      <AdmitCardClient
        exams={data.examsList}
        selectedExamId={data.selectedExamId}
        classes={data.classList}
        settings={data.settings}
        students={data.studentsList}
      />
    </div>
  );
}
