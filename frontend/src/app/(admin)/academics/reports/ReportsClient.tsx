"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  Users,
  FileText,
  AlertCircle,
  TrendingUp,
  Search,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  RotateCcw,
  Check,
  Award,
} from "lucide-react";
import {
  getClassSyllabusProgress,
  getSubjectSyllabusProgress,
  getTeacherWorkloadReport,
  getAssignmentCompletionReport,
  getAcademicActivityReport,
} from "../actions/reports.actions";

type ClassItem = {
  id: string;
  displayName: string;
  gradeLevel: string;
  sections: Array<{ id: string; name: string }>;
  classSubjects: Array<{
    id: string;
    subjectId: string;
    subject: { name: string; code: string };
  }>;
};

type TeacherWorkloadItem = {
  teacherId: string;
  email: string;
  totalPeriodsPerWeek: number;
  scheduledTimetablePeriods: number;
  subjectCount: number;
  assignmentCount: number;
  lessonPlanCount: number;
};

export default function ReportsClient({
  classes,
  activeYearName,
  initialTeacherWorkload,
}: {
  classes: ClassItem[];
  activeYearName: string;
  initialTeacherWorkload: TeacherWorkloadItem[];
}) {
  const [activeTab, setActiveTab] = useState<
    | "class-syllabus"
    | "subject-syllabus"
    | "teacher-workload"
    | "assignment-completion"
    | "academic-activity"
  >("class-syllabus");

  const [isPending, startTransition] = useTransition();

  // Selected filters
  const [selectedClassId, setSelectedClassId] = useState<string>(
    classes[0]?.id || "",
  );
  const selectedClass = classes.find((c) => c.id === selectedClassId);

  const [selectedClassSubjectId, setSelectedClassSubjectId] = useState<string>(
    selectedClass?.classSubjects[0]?.id || "",
  );

  const [selectedSectionId, setSelectedSectionId] = useState<string>(
    selectedClass?.sections[0]?.id || "",
  );

  // Report States
  const [classSyllabusData, setClassSyllabusData] = useState<any>(null);
  const [subjectSyllabusData, setSubjectSyllabusData] = useState<any>(null);
  const [teacherWorkloadData, setTeacherWorkloadData] = useState<
    TeacherWorkloadItem[]
  >(initialTeacherWorkload);
  const [assignmentCompletionData, setAssignmentCompletionData] =
    useState<any>(null);
  const [academicActivityData, setAcademicActivityData] = useState<any>(null);

  const [error, setError] = useState<string | null>(null);

  // Update dependent dropdowns when selected class changes
  useEffect(() => {
    if (selectedClass) {
      if (selectedClass.classSubjects.length > 0) {
        setSelectedClassSubjectId(selectedClass.classSubjects[0]!.id);
      } else {
        setSelectedClassSubjectId("");
      }
      if (selectedClass.sections.length > 0) {
        setSelectedSectionId(selectedClass.sections[0]!.id);
      } else {
        setSelectedSectionId("");
      }
    }
  }, [selectedClassId]);

  // Load Class Syllabus Report
  const loadClassSyllabus = (classId: string) => {
    if (!classId) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await getClassSyllabusProgress(classId);
        setClassSyllabusData(res);
      } catch (err: any) {
        setError(err.message || "Failed to load class syllabus report");
      }
    });
  };

  // Load Subject Syllabus Report
  const loadSubjectSyllabus = (csId: string) => {
    if (!csId) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await getSubjectSyllabusProgress(csId);
        setSubjectSyllabusData(res);
      } catch (err: any) {
        setError(err.message || "Failed to load subject syllabus report");
      }
    });
  };

  // Load Teacher Workload Report
  const loadTeacherWorkload = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await getTeacherWorkloadReport();
        setTeacherWorkloadData(res);
      } catch (err: any) {
        setError(err.message || "Failed to load teacher workload report");
      }
    });
  };

  // Load Assignment Completion Report
  const loadAssignmentCompletion = (secId: string) => {
    if (!secId) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await getAssignmentCompletionReport(secId);
        setAssignmentCompletionData(res);
      } catch (err: any) {
        setError(err.message || "Failed to load assignment completion report");
      }
    });
  };

  // Load Academic Activity Report
  const loadAcademicActivity = (clsId: string) => {
    if (!clsId) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await getAcademicActivityReport(clsId);
        setAcademicActivityData(res);
      } catch (err: any) {
        setError(err.message || "Failed to load academic activity report");
      }
    });
  };

  // Auto-fetch on tab switch or filter change
  useEffect(() => {
    if (activeTab === "class-syllabus" && selectedClassId) {
      loadClassSyllabus(selectedClassId);
    } else if (activeTab === "subject-syllabus" && selectedClassSubjectId) {
      loadSubjectSyllabus(selectedClassSubjectId);
    } else if (activeTab === "teacher-workload") {
      loadTeacherWorkload();
    } else if (activeTab === "assignment-completion" && selectedSectionId) {
      loadAssignmentCompletion(selectedSectionId);
    } else if (activeTab === "academic-activity" && selectedClassId) {
      loadAcademicActivity(selectedClassId);
    }
  }, [activeTab, selectedClassId, selectedClassSubjectId, selectedSectionId]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <nav className="flex items-center gap-2 text-xs font-medium text-muted-foreground dark:text-muted-foreground mb-1">
            <Link
              href="/academics"
              className="hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              Academics
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-foreground dark:text-foreground font-semibold">
              Live Academic Reports
            </span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Academic Operational Reports
          </h1>
          <p className="text-sm text-muted-foreground dark:text-muted-foreground">
            Real-time analytics on syllabus coverage, teacher workload,
            assignment completions, and live classroom activity for{" "}
            <span className="font-medium text-foreground dark:text-foreground">
              {activeYearName}
            </span>
            .
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/academics"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/60 dark:border-border/40 bg-card text-xs font-semibold text-muted-foreground dark:text-foreground hover:bg-muted/30 dark:hover:bg-muted/40 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to AMS Hub
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border/40 dark:border-border/40">
        <div className="flex flex-wrap gap-2">
          {[
            {
              id: "class-syllabus",
              label: "Class Syllabus Progress",
              icon: Layers,
            },
            {
              id: "subject-syllabus",
              label: "Subject Syllabus Progress",
              icon: BookOpen,
            },
            {
              id: "teacher-workload",
              label: "Teacher Workload",
              icon: Users,
            },
            {
              id: "assignment-completion",
              label: "Assignment Completion",
              icon: FileText,
            },
            {
              id: "academic-activity",
              label: "Academic Activity",
              icon: TrendingUp,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-all ${
                  isActive
                    ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/60"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters Bar (Dynamic per tab) */}
      <div className="p-4 bg-card border border-border/40 dark:border-border/40 rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {activeTab !== "teacher-workload" && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground">
                Class:
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-3 py-1.5 text-xs font-medium bg-muted/30 bg-muted/60 border border-border/60 dark:border-border/40 rounded-lg text-foreground dark:text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTab === "subject-syllabus" && selectedClass && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground">
                Subject:
              </label>
              <select
                value={selectedClassSubjectId}
                onChange={(e) => setSelectedClassSubjectId(e.target.value)}
                className="px-3 py-1.5 text-xs font-medium bg-muted/30 bg-muted/60 border border-border/60 dark:border-border/40 rounded-lg text-foreground dark:text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {selectedClass.classSubjects.length === 0 ? (
                  <option value="">No subjects mapped</option>
                ) : (
                  selectedClass.classSubjects.map((cs) => (
                    <option key={cs.id} value={cs.id}>
                      {cs.subject.name} ({cs.subject.code})
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          {activeTab === "assignment-completion" && selectedClass && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground">
                Section:
              </label>
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className="px-3 py-1.5 text-xs font-medium bg-muted/30 bg-muted/60 border border-border/60 dark:border-border/40 rounded-lg text-foreground dark:text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {selectedClass.sections.length === 0 ? (
                  <option value="">No sections found</option>
                ) : (
                  selectedClass.sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      Section {s.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}
        </div>

        <button
          onClick={() => {
            if (activeTab === "class-syllabus")
              loadClassSyllabus(selectedClassId);
            else if (activeTab === "subject-syllabus")
              loadSubjectSyllabus(selectedClassSubjectId);
            else if (activeTab === "teacher-workload") loadTeacherWorkload();
            else if (activeTab === "assignment-completion")
              loadAssignmentCompletion(selectedSectionId);
            else if (activeTab === "academic-activity")
              loadAcademicActivity(selectedClassId);
          }}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground dark:text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-muted/50 dark:hover:bg-muted/40 rounded-lg transition-colors"
        >
          <RotateCcw
            className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center gap-3 text-red-700 dark:text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────
          TAB 1: CLASS SYLLABUS PROGRESS REPORT
         ───────────────────────────────────────────────────────────────────────── */}
      {activeTab === "class-syllabus" && (
        <div className="space-y-6">
          {classSyllabusData ? (
            <>
              {/* Summary Header Card */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-card border border-border/40 dark:border-border/40 shadow-sm">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Class
                  </div>
                  <div className="text-lg font-bold text-foreground dark:text-foreground">
                    {classSyllabusData.className}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Grade {classSyllabusData.gradeLevel}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border/40 dark:border-border/40 shadow-sm">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Total Subjects
                  </div>
                  <div className="text-2xl font-bold text-foreground dark:text-foreground">
                    {classSyllabusData.subjects.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Curriculum Mapped</div>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border/40 dark:border-border/40 shadow-sm">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Total Topics Defined
                  </div>
                  <div className="text-2xl font-bold text-foreground dark:text-foreground">
                    {classSyllabusData.subjects.reduce(
                      (acc: number, s: any) => acc + s.totalTopics,
                      0,
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Across all subjects
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/50 shadow-sm">
                  <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider mb-1">
                    Class Completion Average
                  </div>
                  <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {classSyllabusData.subjects.length > 0
                      ? Math.round(
                          classSyllabusData.subjects.reduce(
                            (acc: number, s: any) => acc + s.percentage,
                            0,
                          ) / classSyllabusData.subjects.length,
                        )
                      : 0}
                    %
                  </div>
                  <div className="text-xs text-indigo-600 dark:text-indigo-400">
                    Cumulative coverage
                  </div>
                </div>
              </div>

              {/* Subject Breakdown Table */}
              <div className="bg-card border border-border/40 dark:border-border/40 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border/40 dark:border-border/40">
                  <h3 className="text-sm font-semibold text-foreground dark:text-foreground">
                    Subject-wise Syllabus Progress
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/30 dark:bg-muted/40 text-muted-foreground dark:text-muted-foreground border-b border-border/40 dark:border-border/40">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Subject</th>
                        <th className="px-4 py-3 font-semibold">Code</th>
                        <th className="px-4 py-3 font-semibold">Lead Teacher</th>
                        <th className="px-4 py-3 font-semibold text-center">
                          Total Topics
                        </th>
                        <th className="px-4 py-3 font-semibold text-center">
                          Completed
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          Completion Progress
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {classSyllabusData.subjects.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-4 py-8 text-center text-muted-foreground"
                          >
                            No subjects mapped to this class yet.
                          </td>
                        </tr>
                      ) : (
                        classSyllabusData.subjects.map((sub: any) => (
                          <tr
                            key={sub.classSubjectId}
                            className="hover:bg-muted/20 dark:hover:bg-muted/30"
                          >
                            <td className="px-4 py-3 font-semibold text-foreground dark:text-foreground">
                              {sub.subjectName}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground font-mono">
                              {sub.subjectCode}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground dark:text-muted-foreground">
                              {sub.teacherEmail || (
                                <span className="text-amber-500 font-medium italic">
                                  Unassigned
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center font-medium text-foreground dark:text-foreground">
                              {sub.totalTopics}
                            </td>
                            <td className="px-4 py-3 text-center font-medium text-emerald-600 dark:text-emerald-400">
                              {sub.coveredTopics}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-2 bg-muted/50 bg-muted/60 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      sub.percentage === 100
                                        ? "bg-emerald-500"
                                        : sub.percentage >= 50
                                          ? "bg-indigo-600"
                                          : "bg-amber-500"
                                    }`}
                                    style={{ width: `${sub.percentage}%` }}
                                  />
                                </div>
                                <span className="font-semibold text-foreground dark:text-foreground w-10 text-right">
                                  {sub.percentage}%
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link
                                href={`/academics/classes/${classSyllabusData.classId}/subjects/${sub.classSubjectId}`}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                              >
                                Workspace
                                <ChevronRight className="w-3.5 h-3.5" />
                              </Link>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center bg-card border border-border/40 dark:border-border/40 rounded-xl">
              <Layers className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <div className="text-sm font-semibold text-foreground dark:text-foreground">
                Select a class to generate syllabus progress report
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Choose a class from the dropdown above to view real-time topic
                completion rates.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────
          TAB 2: SUBJECT SYLLABUS PROGRESS REPORT
         ───────────────────────────────────────────────────────────────────────── */}
      {activeTab === "subject-syllabus" && (
        <div className="space-y-6">
          {subjectSyllabusData ? (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-card border border-border/40 dark:border-border/40 shadow-sm">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Subject & Class
                  </div>
                  <div className="text-lg font-bold text-foreground dark:text-foreground">
                    {subjectSyllabusData.subjectName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {subjectSyllabusData.className} ·{" "}
                    {subjectSyllabusData.subjectCode}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border/40 dark:border-border/40 shadow-sm">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Syllabus Scope
                  </div>
                  <div className="text-2xl font-bold text-foreground dark:text-foreground">
                    {subjectSyllabusData.totalUnits} Units
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {subjectSyllabusData.totalChapters} Chapters ·{" "}
                    {subjectSyllabusData.totalTopics} Topics
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border/40 dark:border-border/40 shadow-sm">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Topics Completed
                  </div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {subjectSyllabusData.completedTopics} /{" "}
                    {subjectSyllabusData.totalTopics}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Unique topic completions
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/50 shadow-sm">
                  <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider mb-1">
                    Overall Coverage
                  </div>
                  <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {subjectSyllabusData.percentage}%
                  </div>
                  <div className="text-xs text-indigo-600 dark:text-indigo-400">
                    Standardized AMS formula
                  </div>
                </div>
              </div>

              {/* Units & Chapters Tree Breakdown */}
              <div className="bg-card border border-border/40 dark:border-border/40 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-semibold text-foreground dark:text-foreground">
                  Comprehensive Topic Completion Breakdown
                </h3>

                {subjectSyllabusData.units.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-xs">
                    No syllabus units created for this subject yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {subjectSyllabusData.units.map(
                      (unit: any, uIdx: number) => (
                        <div
                          key={unit.id}
                          className="border border-border/40 dark:border-border/40 rounded-xl overflow-hidden"
                        >
                          <div className="p-3 bg-muted/30 dark:bg-muted/40 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] flex items-center justify-center">
                                {uIdx + 1}
                              </span>
                              <span className="font-semibold text-xs text-foreground dark:text-foreground">
                                {unit.name}
                              </span>
                              {unit.termName && (
                                <span className="px-2 py-0.5 rounded text-[10px] bg-muted text-muted-foreground font-mono">
                                  {unit.termName}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground font-medium">
                              {unit.completedTopics} / {unit.totalTopics} topics
                              completed
                            </div>
                          </div>

                          <div className="p-3 divide-y divide-border/40">
                            {unit.chapters.length === 0 ? (
                              <div className="text-xs text-muted-foreground italic py-2">
                                No chapters in this unit.
                              </div>
                            ) : (
                              unit.chapters.map(
                                (ch: any, cIdx: number) => (
                                  <div key={ch.id} className="py-2.5 space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                      <div className="font-medium text-foreground dark:text-foreground flex items-center gap-2">
                                        <span className="text-muted-foreground">
                                          {uIdx + 1}.{cIdx + 1}
                                        </span>
                                        {ch.name}
                                        {ch.ncertReference && (
                                          <span className="text-[10px] text-muted-foreground font-mono">
                                            [{ch.ncertReference}]
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[11px] text-muted-foreground">
                                        {ch.completedTopics}/{ch.totalTopics}{" "}
                                        completed
                                      </span>
                                    </div>

                                    {/* Topics List */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-4">
                                      {ch.topics.map((tp: any) => (
                                        <div
                                          key={tp.id}
                                          className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                                            tp.isCompleted
                                              ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-300"
                                              : "bg-muted/20 dark:bg-muted/30 border-border/40 dark:border-border/40 text-muted-foreground dark:text-muted-foreground"
                                          }`}
                                        >
                                          <div className="flex items-center gap-2 truncate">
                                            {tp.isCompleted ? (
                                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                            ) : (
                                              <div className="w-3.5 h-3.5 rounded-full border border-border/60 dark:border-border/40 flex-shrink-0" />
                                            )}
                                            <span className="truncate font-medium">
                                              {tp.name}
                                            </span>
                                          </div>
                                          <div className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                                            {tp.estimatedPeriods} periods
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ),
                              )
                            )}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-12 text-center bg-card border border-border/40 dark:border-border/40 rounded-xl">
              <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <div className="text-sm font-semibold text-foreground dark:text-foreground">
                Select a subject to view detailed syllabus breakdown
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────
          TAB 3: TEACHER WORKLOAD REPORT
         ───────────────────────────────────────────────────────────────────────── */}
      {activeTab === "teacher-workload" && (
        <div className="space-y-6">
          <div className="bg-card border border-border/40 dark:border-border/40 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border/40 dark:border-border/40 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground dark:text-foreground">
                  Faculty Teaching Allocations & Academic Workload
                </h3>
                <p className="text-xs text-muted-foreground">
                  Comparison between mapped curriculum periods and actual
                  scheduled timetable periods.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
                {teacherWorkloadData.length} Active Faculty Members
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/30 dark:bg-muted/40 text-muted-foreground dark:text-muted-foreground border-b border-border/40 dark:border-border/40">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Teacher Email</th>
                    <th className="px-4 py-3 font-semibold text-center">
                      Subjects Handled
                    </th>
                    <th className="px-4 py-3 font-semibold text-center">
                      Curriculum Periods/Wk
                    </th>
                    <th className="px-4 py-3 font-semibold text-center">
                      Timetable Periods/Wk
                    </th>
                    <th className="px-4 py-3 font-semibold text-center">
                      Assignments Published
                    </th>
                    <th className="px-4 py-3 font-semibold text-center">
                      Lesson Plans Prepared
                    </th>
                    <th className="px-4 py-3 font-semibold text-center">
                      Workload Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {teacherWorkloadData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        No teacher allocations found in this academic session.
                      </td>
                    </tr>
                  ) : (
                    teacherWorkloadData.map((t) => {
                      const isHigh = t.scheduledTimetablePeriods > 24;
                      const isOptimal =
                        t.scheduledTimetablePeriods >= 15 &&
                        t.scheduledTimetablePeriods <= 24;
                      return (
                        <tr
                          key={t.teacherId}
                          className="hover:bg-muted/20 dark:hover:bg-muted/30"
                        >
                          <td className="px-4 py-3 font-semibold text-foreground dark:text-foreground">
                            {t.email}
                          </td>
                          <td className="px-4 py-3 text-center font-medium text-muted-foreground dark:text-muted-foreground">
                            {t.subjectCount}
                          </td>
                          <td className="px-4 py-3 text-center font-medium text-muted-foreground dark:text-muted-foreground">
                            {t.totalPeriodsPerWeek}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-foreground dark:text-foreground">
                            {t.scheduledTimetablePeriods}
                          </td>
                          <td className="px-4 py-3 text-center font-medium text-indigo-600 dark:text-indigo-400">
                            {t.assignmentCount}
                          </td>
                          <td className="px-4 py-3 text-center font-medium text-emerald-600 dark:text-emerald-400">
                            {t.lessonPlanCount}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                isHigh
                                  ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                                  : isOptimal
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                    : "bg-muted/50 text-muted-foreground dark:text-muted-foreground"
                              }`}
                            >
                              {isHigh
                                ? "Heavy (>24)"
                                : isOptimal
                                  ? "Optimal (15-24)"
                                  : "Light (<15)"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────
          TAB 4: ASSIGNMENT COMPLETION REPORT
         ───────────────────────────────────────────────────────────────────────── */}
      {activeTab === "assignment-completion" && (
        <div className="space-y-6">
          {assignmentCompletionData ? (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-card border border-border/40 dark:border-border/40 shadow-sm">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Section Scope
                  </div>
                  <div className="text-lg font-bold text-foreground dark:text-foreground">
                    {assignmentCompletionData.className} · Section{" "}
                    {assignmentCompletionData.sectionName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {assignmentCompletionData.totalAssignments} Total
                    Assignments Issued
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border/40 dark:border-border/40 shadow-sm">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Student Submissions
                  </div>
                  <div className="text-2xl font-bold text-foreground dark:text-foreground">
                    {assignmentCompletionData.assignments.reduce(
                      (acc: number, a: any) => acc + a.totalSubmissions,
                      0,
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Recorded student responses
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 shadow-sm">
                  <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1">
                    Graded Submissions
                  </div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {assignmentCompletionData.assignments.reduce(
                      (acc: number, a: any) => acc + a.gradedSubmissions,
                      0,
                    )}
                  </div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400">
                    Evaluated with marks
                  </div>
                </div>
              </div>

              {/* Assignments Table */}
              <div className="bg-card border border-border/40 dark:border-border/40 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border/40 dark:border-border/40">
                  <h3 className="text-sm font-semibold text-foreground dark:text-foreground">
                    Section Assignment Breakdown
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/30 dark:bg-muted/40 text-muted-foreground dark:text-muted-foreground border-b border-border/40 dark:border-border/40">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Title</th>
                        <th className="px-4 py-3 font-semibold">Subject</th>
                        <th className="px-4 py-3 font-semibold text-center">
                          Max Marks
                        </th>
                        <th className="px-4 py-3 font-semibold text-center">
                          Submissions
                        </th>
                        <th className="px-4 py-3 font-semibold text-center">
                          Graded
                        </th>
                        <th className="px-4 py-3 font-semibold text-center">
                          Pending
                        </th>
                        <th className="px-4 py-3 font-semibold text-center">
                          Avg Marks
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {assignmentCompletionData.assignments.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-4 py-8 text-center text-muted-foreground"
                          >
                            No assignments created for this section yet.
                          </td>
                        </tr>
                      ) : (
                        assignmentCompletionData.assignments.map((a: any) => (
                          <tr
                            key={a.id}
                            className="hover:bg-muted/20 dark:hover:bg-muted/30"
                          >
                            <td className="px-4 py-3 font-semibold text-foreground dark:text-foreground">
                              {a.title}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground dark:text-muted-foreground">
                              {a.subjectName} ({a.subjectCode})
                            </td>
                            <td className="px-4 py-3 text-center font-medium text-muted-foreground dark:text-muted-foreground">
                              {a.maxMarks}
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-foreground dark:text-foreground">
                              {a.totalSubmissions}
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-emerald-600 dark:text-emerald-400">
                              {a.gradedSubmissions}
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-amber-600 dark:text-amber-400">
                              {a.pendingGrading}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-foreground dark:text-foreground">
                              {a.averageMarks !== null ? a.averageMarks : "—"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  a.status === "PUBLISHED"
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                    : a.status === "GRADED"
                                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400"
                                      : "bg-muted/50 text-muted-foreground dark:text-muted-foreground"
                                }`}
                              >
                                {a.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center bg-card border border-border/40 dark:border-border/40 rounded-xl">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <div className="text-sm font-semibold text-foreground dark:text-foreground">
                Select a class and section to view assignment completions
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────
          TAB 5: ACADEMIC ACTIVITY REPORT
         ───────────────────────────────────────────────────────────────────────── */}
      {activeTab === "academic-activity" && (
        <div className="space-y-6">
          {academicActivityData ? (
            <>
              {/* Summary Metric Counters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-card border border-border/40 dark:border-border/40 shadow-sm flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Lesson Plans Created
                    </div>
                    <div className="text-2xl font-bold text-foreground dark:text-foreground">
                      {academicActivityData.lessonPlansCount}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border/40 dark:border-border/40 shadow-sm flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Assignments Scheduled
                    </div>
                    <div className="text-2xl font-bold text-foreground dark:text-foreground">
                      {academicActivityData.assignmentsCount}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border/40 dark:border-border/40 shadow-sm flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Assessments Configured
                    </div>
                    <div className="text-2xl font-bold text-foreground dark:text-foreground">
                      {academicActivityData.assessmentsCount}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity Timeline */}
              <div className="bg-card border border-border/40 dark:border-border/40 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-semibold text-foreground dark:text-foreground">
                  Recent Academic Stream for {academicActivityData.className}
                </h3>

                {academicActivityData.recentActivities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-xs">
                    No recent academic operations recorded for this class yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {academicActivityData.recentActivities.map(
                      (act: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg border border-border/40 dark:border-border/40 bg-muted/20 dark:bg-muted/30 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`p-2 rounded-lg ${
                                act.type === "LESSON_PLAN"
                                  ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600"
                                  : "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600"
                              }`}
                            >
                              {act.type === "LESSON_PLAN" ? (
                                <BookOpen className="w-4 h-4" />
                              ) : (
                                <FileText className="w-4 h-4" />
                              )}
                            </span>
                            <div>
                              <div className="text-xs font-semibold text-foreground dark:text-foreground">
                                {act.title}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {act.subjectName} ·{" "}
                                {act.teacherEmail ||
                                  act.sectionName ||
                                  "Class-wide"}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {new Date(act.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-12 text-center bg-card border border-border/40 dark:border-border/40 rounded-xl">
              <TrendingUp className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <div className="text-sm font-semibold text-foreground dark:text-foreground">
                Select a class to view academic activity
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
