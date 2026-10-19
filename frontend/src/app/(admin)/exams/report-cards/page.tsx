import { db, withTenant } from "@/db";
import {
  reportCardSetups,
  resultSnapshots,
  resultSettings,
  resultHolds,
  classes,
  students,
  schools,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { Metadata } from "next";
import { requireAuth } from "@/lib/serverAuth";
import { redirect } from "next/navigation";
import { assertRouteAccess } from "@/lib/routeGuards";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";
import { decryptData } from "@/lib/encryption";
import {
  ReportCardsClient,
  type SnapshotItem,
} from "./ReportCardsClient";
import Link from "next/link";
import { ArrowLeft, Award, SlidersHorizontal, ShieldAlert } from "lucide-react";

export const metadata: Metadata = {
  title: "Report Cards & Result Snapshots | SchoolMitra ERP",
  description: "Generate immutable result snapshots, calculate ranks, and issue topper certificates",
};

const REPORT_CARD_ADMIN_ROLES = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "PRINCIPAL",
] as const;

export default async function ReportCardsAdminPage({
  searchParams,
}: {
  searchParams: { setupId?: string; classId?: string };
}) {
  const ctx = await requireAuth(REPORT_CARD_ADMIN_ROLES);
  const access = assertRouteAccess(ctx.role, "/exams/report-cards", {
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

  const data = await withDataPhaseTiming("/exams/report-cards", async () => {
    return assertQueryBudget(
      async () => {
        return await withTenant(schoolId, async (tx) => {
          const setupsList = await tx.query.reportCardSetups.findMany({
            where: eq(reportCardSetups.schoolId, schoolId),
            orderBy: (t, { desc }) => [desc(t.createdAt)],
          });

          const selectedSetupId =
            searchParams.setupId && setupsList.some((s) => s.id === searchParams.setupId)
              ? searchParams.setupId
              : setupsList[0]?.id || "";

          const classList = await tx.query.classes.findMany({
            where: eq(classes.schoolId, schoolId),
            orderBy: (t, { asc }) => [asc(t.displayName)],
          });

          const selectedClassId =
            searchParams.classId && classList.some((c) => c.id === searchParams.classId)
              ? searchParams.classId
              : classList[0]?.id || "";

          if (!selectedSetupId || !selectedClassId) {
            return {
              setups: setupsList.map((s) => ({ id: s.id, name: s.name })),
              selectedSetupId,
              classes: classList.map((c) => ({ id: c.id, displayName: c.displayName })),
              selectedClassId,
              snapshots: [],
              settings: null,
            };
          }

          const [rawSnapshots, holdsList, settingsRecord, rawStudents] =
            await Promise.all([
              tx.query.resultSnapshots.findMany({
                where: and(
                  eq(resultSnapshots.schoolId, schoolId),
                  eq(resultSnapshots.setupId, selectedSetupId),
                  eq(resultSnapshots.isCurrent, true),
                ),
                orderBy: (t, { desc }) => [desc(t.version)],
              }),
              tx.query.resultHolds.findMany({
                where: and(
                  eq(resultHolds.schoolId, schoolId),
                  eq(resultHolds.setupId, selectedSetupId),
                ),
              }),
              tx.query.resultSettings.findFirst({
                where: and(
                  eq(resultSettings.schoolId, schoolId),
                  eq(resultSettings.setupId, selectedSetupId),
                ),
              }),
              tx.query.students.findMany({
                where: and(
                  eq(students.schoolId, schoolId),
                  eq(students.currentClassId, selectedClassId),
                  eq(students.isActive, true),
                ),
              }),
            ]);

          const holdsMap = new Map(holdsList.map((h) => [h.studentId, h.reason]));
          const studentsMap = new Map(rawStudents.map((s) => [s.id, s]));

          // Filter snapshots belonging to students in selected class
          const snapshotsForClass: SnapshotItem[] = rawSnapshots
            .filter((snap) => studentsMap.has(snap.studentId))
            .map((snap) => {
              const st = studentsMap.get(snap.studentId);
              const first = st ? decryptData(st.firstNameEncrypted) || "" : "";
              const last = st ? decryptData(st.lastNameEncrypted) || "" : "";
              const fullName = `${first} ${last}`.trim() || "Student";

              return {
                id: snap.id,
                studentId: snap.studentId,
                studentName: fullName,
                rollNumber: st?.rollNumber || null,
                admissionNumber: st?.admissionNumber || "",
                version: snap.version,
                isCurrent: snap.isCurrent,
                frozenAt: snap.frozenAt.toISOString(),
                payload: snap.payload,
                isHeld: holdsMap.has(snap.studentId),
                holdReason: holdsMap.get(snap.studentId) || null,
              };
            });

          const formattedSettings = settingsRecord
            ? {
                withholdAll: settingsRecord.withholdAll,
                releaseAt: settingsRecord.releaseAt
                  ? settingsRecord.releaseAt.toISOString()
                  : null,
                feeLockMode: settingsRecord.feeLockMode as "OFF" | "SOFT" | "HARD",
                feeLockThresholdAmount: settingsRecord.feeLockThresholdAmount || "0",
                publicLookupEnabled: settingsRecord.publicLookupEnabled,
                publicToppersEnabled: settingsRecord.publicToppersEnabled,
              }
            : null;

          return {
            setups: setupsList.map((s) => ({ id: s.id, name: s.name })),
            selectedSetupId,
            classes: classList.map((c) => ({ id: c.id, displayName: c.displayName })),
            selectedClassId,
            snapshots: snapshotsForClass,
            settings: formattedSettings,
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
                <Award className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Report Cards &amp; Result Snapshots
              </h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Freeze immutable result snapshots, calculate class ranks, and issue topper certificates
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/exams/report-cards/setups"
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Framework Setups</span>
          </Link>
          <Link
            href={(`/exams/report-cards/settings${data.selectedSetupId ? `?setupId=${data.selectedSetupId}` : ""}`) as any}
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Release Policies</span>
          </Link>
        </div>
      </div>

      <ReportCardsClient
        setups={data.setups}
        selectedSetupId={data.selectedSetupId}
        classes={data.classes}
        selectedClassId={data.selectedClassId}
        snapshots={data.snapshots}
        settings={data.settings}
      />
    </div>
  );
}
