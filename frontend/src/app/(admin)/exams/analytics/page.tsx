import { db, withTenant } from "@/db";
import {
  reportCardSetups,
  classes,
  students,
  resultSnapshots,
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
import { AnalyticsClient } from "./AnalyticsClient";
import Link from "next/link";
import { ArrowLeft, BarChart3, SlidersHorizontal, Award } from "lucide-react";

export const metadata: Metadata = {
  title: "Examination Analytics & Insights | SchoolMitra ERP",
  description: "Comprehensive cohort performance analytics, grade distributions, and topper leaderboards",
};

const ANALYTICS_ADMIN_ROLES = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "PRINCIPAL",
] as const;

export default async function ExamsAnalyticsPage({
  searchParams,
}: {
  searchParams: { setupId?: string; classId?: string };
}) {
  const ctx = await requireAuth(ANALYTICS_ADMIN_ROLES);
  const access = assertRouteAccess(ctx.role, "/exams/analytics", {
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

  const data = await withDataPhaseTiming("/exams/analytics", async () => {
    return assertQueryBudget(
      async () => {
        return await withTenant(schoolId, async (tx) => {
          const [setupsList, classList] = await Promise.all([
            tx.query.reportCardSetups.findMany({
              where: eq(reportCardSetups.schoolId, schoolId),
              orderBy: (t, { desc }) => [desc(t.createdAt)],
            }),
            tx.query.classes.findMany({
              where: eq(classes.schoolId, schoolId),
              orderBy: (t, { asc }) => [asc(t.displayName)],
            }),
          ]);

          const selectedSetupId =
            searchParams.setupId && setupsList.some((s) => s.id === searchParams.setupId)
              ? searchParams.setupId
              : setupsList[0]?.id || "";

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
              metrics: {
                totalAssessed: 0,
                passCount: 0,
                failCount: 0,
                passPercentage: 0,
                averagePercentage: 0,
                highestPercentage: 0,
                lowestPercentage: 0,
              },
              gradeDistribution: [],
              subjectAnalysis: [],
              toppers: [],
              remedialStudents: [],
            };
          }

          // Fetch students and snapshots
          const [rawStudents, rawSnapshots] = await Promise.all([
            tx.query.students.findMany({
              where: and(
                eq(students.schoolId, schoolId),
                eq(students.currentClassId, selectedClassId),
                eq(students.isActive, true),
              ),
            }),
            tx.query.resultSnapshots.findMany({
              where: and(
                eq(resultSnapshots.schoolId, schoolId),
                eq(resultSnapshots.setupId, selectedSetupId),
                eq(resultSnapshots.isCurrent, true),
              ),
            }),
          ]);

          const studentsMap = new Map(rawStudents.map((s) => [s.id, s]));

          // Filter snapshots for students in selected class
          const snapshotsForClass = rawSnapshots.filter((snap) =>
            studentsMap.has(snap.studentId),
          );

        if (snapshotsForClass.length === 0) {
          return {
            setups: setupsList.map((s) => ({ id: s.id, name: s.name })),
            selectedSetupId,
            classes: classList.map((c) => ({ id: c.id, displayName: c.displayName })),
            selectedClassId,
            metrics: {
              totalAssessed: 0,
              passCount: 0,
              failCount: 0,
              passPercentage: 0,
              averagePercentage: 0,
              highestPercentage: 0,
              lowestPercentage: 0,
            },
            gradeDistribution: [],
            subjectAnalysis: [],
            toppers: [],
            remedialStudents: [],
          };
        }

        let passCount = 0;
        let failCount = 0;
        let totalPctSum = 0;
        let highestPct = -Infinity;
        let lowestPct = Infinity;

        const gradeCounts: {
          A1: number;
          A2: number;
          B1: number;
          B2: number;
          C1: number;
          C2: number;
          D: number;
          E: number;
        } = {
          A1: 0,
          A2: 0,
          B1: 0,
          B2: 0,
          C1: 0,
          C2: 0,
          D: 0,
          E: 0,
        };

        const subjectStatsMap = new Map<
          string,
          {
            name: string;
            totalObtained: number;
            totalMax: number;
            count: number;
            highestMarks: number;
            passedCount: number;
          }
        >();

        const topperCandidates: Array<{
          rank: number;
          studentName: string;
          admissionNumber: string;
          rollNumber: string | null;
          totalMarks: number;
          totalMax: number;
          percentage: number;
          overallGrade: string;
          division: string;
        }> = [];

        const remedialCandidates: Array<{
          studentName: string;
          admissionNumber: string;
          rollNumber: string | null;
          percentage: number;
          failedSubjects: Array<{
            subjectName: string;
            obtained: number;
            max: number;
          }>;
        }> = [];

        for (const snap of snapshotsForClass) {
          const st = studentsMap.get(snap.studentId)!;
          const first = decryptData(st.firstNameEncrypted) || "";
          const last = decryptData(st.lastNameEncrypted) || "";
          const studentName = `${first} ${last}`.trim() || "Student";

          const payload = snap.payload as any;
          const summary = payload?.summary || {};
          const subjects = (payload?.subjects as any[]) || [];

          const pct = summary.percentage ?? 0;
          const isPassed = summary.resultStatus === "PASSED";

          if (isPassed) passCount++;
          else failCount++;

          totalPctSum += pct;
          if (pct > highestPct) highestPct = pct;
          if (pct < lowestPct) lowestPct = pct;

          const gr = summary.overallGrade as keyof typeof gradeCounts;
          if (gr && gradeCounts[gr] !== undefined) {
            gradeCounts[gr]++;
          } else {
            gradeCounts.E++;
          }

          // Subjects aggregation
          const failedSubs: Array<{
            subjectName: string;
            obtained: number;
            max: number;
          }> = [];

          for (const sub of subjects) {
            const key = sub.subjectName || sub.subjectId;
            if (!subjectStatsMap.has(key)) {
              subjectStatsMap.set(key, {
                name: sub.subjectName,
                totalObtained: 0,
                totalMax: sub.totalMax || 100,
                count: 0,
                highestMarks: 0,
                passedCount: 0,
              });
            }
            const sStat = subjectStatsMap.get(key)!;
            sStat.totalObtained += sub.totalObtained || 0;
            sStat.count++;
            if ((sub.totalObtained || 0) > sStat.highestMarks) {
              sStat.highestMarks = sub.totalObtained || 0;
            }
            if (sub.isPassed) {
              sStat.passedCount++;
            } else {
              failedSubs.push({
                subjectName: sub.subjectName,
                obtained: sub.totalObtained || 0,
                max: sub.totalMax || 100,
              });
            }
          }

          if (isPassed) {
            topperCandidates.push({
              rank: summary.rank || 1,
              studentName,
              admissionNumber: st.admissionNumber,
              rollNumber: st.rollNumber,
              totalMarks: summary.totalMarks || 0,
              totalMax: summary.totalMax || 0,
              percentage: pct,
              overallGrade: summary.overallGrade || "—",
              division: summary.division || "—",
            });
          }

          if (!isPassed || failedSubs.length > 0) {
            remedialCandidates.push({
              studentName,
              admissionNumber: st.admissionNumber,
              rollNumber: st.rollNumber,
              percentage: pct,
              failedSubjects: failedSubs,
            });
          }
        }

        const totalAssessed = snapshotsForClass.length;
        const passPercentage =
          totalAssessed > 0
            ? Number(((passCount / totalAssessed) * 100).toFixed(1))
            : 0;
        const averagePercentage =
          totalAssessed > 0
            ? Number((totalPctSum / totalAssessed).toFixed(1))
            : 0;

        // Grade distribution colors
        const gradeColorMap: Record<string, string> = {
          A1: "bg-emerald-500",
          A2: "bg-teal-500",
          B1: "bg-blue-500",
          B2: "bg-indigo-500",
          C1: "bg-amber-500",
          C2: "bg-orange-500",
          D: "bg-rose-400",
          E: "bg-rose-600",
        };

        const gradeDistribution = Object.entries(gradeCounts).map(
          ([grade, count]) => ({
            grade,
            count,
            percentage:
              totalAssessed > 0
                ? Number(((count / totalAssessed) * 100).toFixed(1))
                : 0,
            color: gradeColorMap[grade] || "bg-slate-500",
          }),
        );

        const subjectAnalysis = Array.from(subjectStatsMap.values()).map(
          (s) => ({
            subjectName: s.name,
            averageMarks:
              s.count > 0 ? Number((s.totalObtained / s.count).toFixed(1)) : 0,
            maxMarks: s.totalMax,
            averagePercent:
              s.count > 0 && s.totalMax > 0
                ? Number(
                    ((s.totalObtained / s.count / s.totalMax) * 100).toFixed(1),
                  )
                : 0,
            highestMarks: s.highestMarks,
            passRate:
              s.count > 0
                ? Number(((s.passedCount / s.count) * 100).toFixed(1))
                : 0,
          }),
        );

        // Sort toppers by rank ascending, take top 5
        topperCandidates.sort((a, b) => a.rank - b.rank);
        const top5 = topperCandidates.slice(0, 5);

        // Sort remedial students by percentage ascending
        remedialCandidates.sort((a, b) => a.percentage - b.percentage);

          return {
            setups: setupsList.map((s) => ({ id: s.id, name: s.name })),
            selectedSetupId,
            classes: classList.map((c) => ({ id: c.id, displayName: c.displayName })),
            selectedClassId,
            metrics: {
              totalAssessed,
              passCount,
              failCount,
              passPercentage,
              averagePercentage,
              highestPercentage: highestPct === -Infinity ? 0 : highestPct,
              lowestPercentage: lowestPct === Infinity ? 0 : lowestPct,
            },
            gradeDistribution,
            subjectAnalysis,
            toppers: top5,
            remedialStudents: remedialCandidates,
          };
        });
      },
      { maxQueries: 8 },
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
                <BarChart3 className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Cohort Examination Analytics
              </h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Deep cohort metrics, CBSE grade distributions, subject performance, and topper leaderboards
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/exams/report-cards"
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition"
          >
            <Award className="w-4 h-4" />
            <span>Report Cards</span>
          </Link>
        </div>
      </div>

      <AnalyticsClient
        setups={data.setups}
        selectedSetupId={data.selectedSetupId}
        classes={data.classes}
        selectedClassId={data.selectedClassId}
        metrics={data.metrics}
        gradeDistribution={data.gradeDistribution}
        subjectAnalysis={data.subjectAnalysis}
        toppers={data.toppers}
        remedialStudents={data.remedialStudents}
      />
    </div>
  );
}
