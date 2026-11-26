export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { withTenant } from "@/db";
import {
  assignments,
  assignmentSubmissions,
  lessonPlans,
  sectionSubjectTeachers,
  syllabusChapters,
  syllabusTopics,
  syllabusUnits,
} from "@/db/schema";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import {
  BookOpen,
  ClipboardCheck,
  FileQuestion,
  FileText,
  BookMarked,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";

export const metadata = {
  title: "Work Hub | Educator PWA",
  description:
    "Central hub for homework, assignments & grading, question bank, question papers, and syllabus.",
};

interface WorkStats {
  pendingHomework: number;
  pendingSubmissionsToGrade: number;
  lessonPlansDue: number;
  syllabusProgressPct: number;
}

async function getTeacherWorkStats(): Promise<WorkStats> {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  return await withTenant(school.id, async (tx: any) => {
    const allocations = await tx.query.sectionSubjectTeachers.findMany({
      where: and(
        eq(sectionSubjectTeachers.schoolId, school.id),
        eq(sectionSubjectTeachers.teacherId, ctx.userId)
      ),
    });

    const classSubjectIds = Array.from(
      new Set(allocations.map((a: any) => a.classSubjectId).filter(Boolean))
    ) as string[];
    const sectionIds = Array.from(
      new Set(allocations.map((a: any) => a.sectionId).filter(Boolean))
    ) as string[];

    let pendingHomework = 0;
    let pendingSubmissionsToGrade = 0;

    if (classSubjectIds.length > 0 && sectionIds.length > 0) {
      const teacherAssignments = await tx.query.assignments.findMany({
        where: and(
          eq(assignments.schoolId, school.id),
          inArray(assignments.classSubjectId, classSubjectIds),
          inArray(assignments.sectionId, sectionIds)
        ),
      });

      pendingHomework = teacherAssignments.filter(
        (a: any) => a.status === "PUBLISHED" || a.status === "DRAFT"
      ).length;

      const assignmentIds = teacherAssignments.map((a: any) => a.id);
      if (assignmentIds.length > 0) {
        const ungradedSubs = await tx.query.assignmentSubmissions.findMany({
          where: and(
            eq(assignmentSubmissions.schoolId, school.id),
            inArray(assignmentSubmissions.assignmentId, assignmentIds),
            isNull(assignmentSubmissions.gradedAt)
          ),
        });
        pendingSubmissionsToGrade = ungradedSubs.length;
      }
    }

    const duePlans = await tx.query.lessonPlans.findMany({
      where: and(
        eq(lessonPlans.schoolId, school.id),
        eq(lessonPlans.teacherId, ctx.userId),
        ne(lessonPlans.status, "COMPLETED")
      ),
    });

    let topics: any[] = [];
    if (classSubjectIds.length > 0) {
      const units = await tx.query.syllabusUnits.findMany({
        where: and(
          eq(syllabusUnits.schoolId, school.id),
          inArray(syllabusUnits.classSubjectId, classSubjectIds)
        ),
      });
      const unitIds = units.map((u: any) => u.id);
      if (unitIds.length > 0) {
        const chapters = await tx.query.syllabusChapters.findMany({
          where: and(
            eq(syllabusChapters.schoolId, school.id),
            inArray(syllabusChapters.unitId, unitIds)
          ),
        });
        const chapterIds = chapters.map((c: any) => c.id);
        if (chapterIds.length > 0) {
          topics = await tx.query.syllabusTopics.findMany({
            where: and(
              eq(syllabusTopics.schoolId, school.id),
              inArray(syllabusTopics.chapterId, chapterIds)
            ),
          });
        }
      }
    }

    const completedTopics = topics.filter((t: any) => t.isCompleted).length;
    const syllabusProgressPct =
      topics.length > 0 ? Math.round((completedTopics / topics.length) * 100) : 0;

    return {
      pendingHomework,
      pendingSubmissionsToGrade,
      lessonPlansDue: duePlans.length,
      syllabusProgressPct,
    };
  });
}

export default async function TeacherWorkHubPage() {
  let stats: WorkStats = {
    pendingHomework: 0,
    pendingSubmissionsToGrade: 0,
    lessonPlansDue: 0,
    syllabusProgressPct: 0,
  };

  try {
    stats = await getTeacherWorkStats();
  } catch (err) {
    console.error("[TeacherWorkHubPage] Error fetching work stats:", err);
  }

  const workCards = [
    {
      title: "Homework",
      description: "Create, publish, and track section homework assignments.",
      href: "/teacher/homework",
      icon: BookOpen,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      statLabel: `${stats.pendingHomework} active`,
    },
    {
      title: "Assignments & Submissions",
      description: "Grade pending student submissions and enter exam marks.",
      href: "/teacher/grading",
      icon: ClipboardCheck,
      color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      statLabel: `${stats.pendingSubmissionsToGrade} to grade`,
    },
    {
      title: "Question Bank",
      description: "Manage reusable questions tagged by chapter, topic, and difficulty.",
      href: "/teacher/question-bank",
      icon: FileQuestion,
      color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
      statLabel: "Repository",
    },
    {
      title: "Question Paper Builder",
      description: "Assemble and export formatted exam question papers.",
      href: "/teacher/question-papers",
      icon: FileText,
      color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
      statLabel: "Builder",
    },
    {
      title: "Syllabus",
      description: "Track NCERT / Board chapter progress and mark topic coverage.",
      href: "/teacher/syllabus",
      icon: BookMarked,
      color: "text-teal-400 bg-teal-500/10 border-teal-500/20",
      statLabel: `${stats.syllabusProgressPct}% covered`,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Educator Work Hub</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Teaching Work & LMS
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage homework, grading, question papers, and syllabus progress.
          </p>
        </div>
      </div>

      {/* Live Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span>Active Homework</span>
          </div>
          <div className="text-xl font-bold text-white mt-1">
            {stats.pendingHomework}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ClipboardCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Pending Grading</span>
          </div>
          <div className="text-xl font-bold text-white mt-1">
            {stats.pendingSubmissionsToGrade}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Lesson Plans Due</span>
          </div>
          <div className="text-xl font-bold text-white mt-1">
            {stats.lessonPlansDue}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
            <span>Syllabus Progress</span>
          </div>
          <div className="text-xl font-bold text-white mt-1">
            {stats.syllabusProgressPct}%
          </div>
        </div>
      </div>

      {/* Work Hub Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {workCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-2xl border border-slate-800 bg-slate-900/70 hover:bg-slate-800/70 hover:border-slate-700 p-4 transition-all flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`p-2.5 rounded-xl border shrink-0 ${card.color}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors">
                      {card.title}
                    </h2>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {card.statLabel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {card.description}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
