"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Plus,
  BarChart3,
  Search,
  Layers,
  GraduationCap,
  CalendarDays,
  UserCheck,
  Trash2,
  Loader2,
  ChevronRight,
  Edit2,
  FileText,
  ListOrdered,
  Sparkles,
} from "lucide-react";
import ClassCreationWizard from "./ClassCreationWizard";
import { deleteClass } from "../actions/class-setup.actions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SetupProgressBar } from "@/components/ui/SetupProgressBar";
import { NextBestAction } from "@/components/ui/NextBestAction";
import { EmptyStateCTA } from "@/components/ui/EmptyStateCTA";
import AcademicBlockTabs, {
  AcademicBlockKey,
  getGradeBlock,
  getCanonicalSortOrder,
} from "@/components/academics/AcademicBlockTabs";
import { toast } from "sonner";

type Classroom = {
  id: string;
  gradeLevel: string;
  displayName: string;
  sortOrder: number;
  sections: Array<{
    id: string;
    name: string;
    capacity: number;
    classTeacherId: string | null;
    roomNumber: string | null;
  }>;
};

const sortClassroomsCanonically = (list: Classroom[]) => {
  return [...list].sort((a, b) => {
    const canonicalA = getCanonicalSortOrder(a.gradeLevel, a.displayName);
    const canonicalB = getCanonicalSortOrder(b.gradeLevel, b.displayName);
    if (canonicalA !== canonicalB) return canonicalA - canonicalB;
    return (a.sortOrder || 0) - (b.sortOrder || 0);
  });
};

type Subject = {
  id: string;
  code: string;
  name: string;
  nameHindi: string | null;
  subjectType: string;
  maxMarks: number;
  passingMarks: number;
};

type Teacher = {
  id: string;
  email: string;
};

type ClassSubject = {
  id: string;
  classId: string;
  subjectId: string;
  assignedTeacherId: string | null;
  periodsPerWeek: number;
  isElective: boolean;
  class: { displayName: string };
  subject: { name: string; code: string };
};

type AcademicYear = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

export default function AmsHubClient({
  activeYear,
  classrooms,
  subjects,
  mappings,
  teachers,
  pendingSubstitutionsCount,
  role,
  userId,
  isAdmin,
}: {
  activeYear: AcademicYear | null;
  classrooms: Classroom[];
  subjects: Subject[];
  mappings: ClassSubject[];
  teachers: Teacher[];
  pendingSubstitutionsCount: number;
  role: string;
  userId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [showWizard, setShowWizard] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeBlock, setActiveBlock] = useState<AcademicBlockKey>("all");
  const [classList, setClassList] = useState<Classroom[]>(() =>
    sortClassroomsCanonically(classrooms),
  );
  const [classToDelete, setClassToDelete] = useState<Classroom | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Dynamic NextBestAction outcome strip state
  const [postActionStrip, setPostActionStrip] = useState<{
    outcome: string;
    suggestion: { label: string; href?: string; action?: () => void; primary?: boolean };
    alternates?: Array<{ label: string; href?: string; action?: () => void }>;
  } | null>(null);

  useEffect(() => {
    setClassList(sortClassroomsCanonically(classrooms));
  }, [classrooms]);

  const isTeacher = role === "TEACHER";

  // Calculate subject counts and teacher assignments per class
  const classSubjectCounts = new Map<string, number>();
  const classTeacherAssignedCounts = new Map<string, number>();

  mappings.forEach((m) => {
    classSubjectCounts.set(
      m.classId,
      (classSubjectCounts.get(m.classId) ?? 0) + 1,
    );
    if (m.assignedTeacherId) {
      classTeacherAssignedCounts.set(
        m.classId,
        (classTeacherAssignedCounts.get(m.classId) ?? 0) + 1,
      );
    }
  });

  // Block counts for tabs
  const blockCounts: Record<AcademicBlockKey, number> = {
    all: classList.length,
    pre_primary: 0,
    primary: 0,
    middle_school: 0,
    high_school: 0,
  };

  classList.forEach((c) => {
    const b = getGradeBlock(c.gradeLevel, c.displayName);
    blockCounts[b] = (blockCounts[b] || 0) + 1;
  });

  // Filter classrooms by search query and academic block
  const filteredClassrooms = classList.filter((c) => {
    const matchesSearch =
      c.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.gradeLevel.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeBlock === "all") return true;
    return getGradeBlock(c.gradeLevel, c.displayName) === activeBlock;
  });

  const totalSections = classList.reduce(
    (sum, c) => sum + c.sections.length,
    0,
  );

  // School-wide Readiness stats
  const totalClasses = classList.length;
  const classesWithSubjects = classList.filter(
    (c) => (classSubjectCounts.get(c.id) ?? 0) > 0,
  ).length;
  const classesWithSections = classList.filter((c) => c.sections.length > 0).length;

  return (
    <div className="space-y-6 max-w-[1280px] mx-auto px-4 md:px-6">
      {/* ─── 1. Header with Breadcrumbs & Single Primary Action (Law L4, O3, O4) ─── */}
      <div className="border-b border-border/40 pb-4">
        <nav className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 mb-1">
          <Link href="/dashboard" className="hover:text-primary transition">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-700 dark:text-gray-300 font-medium">
            Academics Hub
          </span>
        </nav>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                {activeYear ? activeYear.name : "Active Session"}
              </span>
              <span className="text-xs text-gray-400">
                Academic Management System
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Academics Hub
            </h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/academics/subjects"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-card border border-border/40 hover:bg-muted/40 text-foreground transition shadow-xs min-h-[40px]"
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-500" />
              Manage Subjects
            </Link>
            <Link
              href="/academics/mapping"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-card border border-border/40 hover:bg-muted/40 text-foreground transition shadow-xs min-h-[40px]"
            >
              <ListOrdered className="w-3.5 h-3.5 text-purple-500" />
              Subject Matrix
            </Link>
            <Link
              href="/academics/setup/calendar"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-card border border-border/40 hover:bg-muted/40 text-foreground transition shadow-xs min-h-[40px]"
            >
              <Calendar className="w-3.5 h-3.5 text-amber-500" />
              Calendar
            </Link>

            {/* Exactly ONE Primary Action Button (Law O3) */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowWizard(true)}
                className="inline-flex items-center gap-1.5 bg-[#00A3C4] dark:bg-[#64D2FF] hover:opacity-90 text-white dark:text-black px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm min-h-[44px] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Create Class
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── 2. School-Wide Setup Health Readiness Banner (Surface 1 Spec) ────── */}
      <div className="bg-[#00A3C4]/10 dark:bg-[#64D2FF]/12 border border-[#00A3C4]/25 dark:border-[#64D2FF]/30 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#00A3C4]/20 dark:bg-[#64D2FF]/20 text-[#00A3C4] dark:text-[#64D2FF] flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-foreground block">
              School Academic Readiness
            </span>
            <span className="text-[11px] text-muted-foreground">
              Module-wide setup signals and curriculum completion
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold">
          <a
            href="#classes-grid"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-[#00A3C4] dark:hover:text-[#64D2FF] transition"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                classesWithSections === totalClasses && totalClasses > 0
                  ? "bg-[#34C759] dark:bg-[#30D158]"
                  : "bg-[#FF9500] dark:bg-[#FF9F0A]"
              }`}
            />
            <span>
              Classes: <strong className="font-bold text-foreground font-mono tabular-nums">{classesWithSections}/{totalClasses}</strong> configured
            </span>
          </a>

          <span className="text-border">·</span>

          <Link
            href="/academics/mapping"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-[#00A3C4] dark:hover:text-[#64D2FF] transition"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                classesWithSubjects === totalClasses && totalClasses > 0
                  ? "bg-[#34C759] dark:bg-[#30D158]"
                  : "bg-[#FF9500] dark:bg-[#FF9F0A]"
              }`}
            />
            <span>
              Subjects mapped: <strong className="font-bold text-foreground font-mono tabular-nums">{classesWithSubjects}/{totalClasses}</strong>
            </span>
          </Link>

          <span className="text-border hidden md:inline">·</span>

          <Link
            href="/academics/setup/bell-schedule"
            className="hidden md:flex items-center gap-1.5 text-muted-foreground hover:text-[#00A3C4] dark:hover:text-[#64D2FF] transition"
          >
            <span className="w-2 h-2 rounded-full bg-[#00A3C4] dark:bg-[#64D2FF]" />
            <span>Bell Schedule: Active</span>
          </Link>
        </div>
      </div>

      {/* ─── 3. Next Best Action Strip (Law L8 & Feedback Spec) ────────────────── */}
      {postActionStrip && (
        <NextBestAction
          outcome={postActionStrip.outcome}
          suggestion={postActionStrip.suggestion}
          alternates={postActionStrip.alternates}
          onDismiss={() => setPostActionStrip(null)}
        />
      )}

      {/* ─── 4. Workloads Section (Merge Plan: Assignments & Lesson Plans) ─────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border/40 hover:border-[#00A3C4]/40 transition rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Classes
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#00A3C4]/15 dark:bg-[#64D2FF]/20 text-[#00A3C4] dark:text-[#64D2FF] flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground font-mono tabular-nums">
            {classrooms.length}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {totalSections} active sections
          </div>
        </div>

        <div className="bg-card border border-border/40 hover:border-[#00A3C4]/40 transition rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Subjects Mapped
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground font-mono tabular-nums">
            {mappings.length}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Across {subjects.length} catalog subjects
          </div>
        </div>

        <div className="bg-card border border-border/40 hover:border-[#00A3C4]/40 transition rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Substitutions
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                pendingSubstitutionsCount > 0
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground font-mono tabular-nums">
            {pendingSubstitutionsCount}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {pendingSubstitutionsCount > 0
              ? "Pending coverage today"
              : "All periods covered"}
          </div>
        </div>

        <div className="bg-card border border-border/40 hover:border-[#00A3C4]/40 transition rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Bell Schedule
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#00A3C4]/15 dark:bg-[#64D2FF]/20 text-[#00A3C4] dark:text-[#64D2FF] flex items-center justify-center">
              <CalendarDays className="w-4 h-4" />
            </div>
          </div>
          <Link
            href="/academics/setup/bell-schedule"
            className="text-xs font-bold text-[#00A3C4] dark:text-[#64D2FF] hover:underline flex items-center gap-1 mt-2"
          >
            Configure Periods <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <div className="text-[11px] text-muted-foreground mt-1">
            Dynamic period schedule
          </div>
        </div>
      </div>

      {/* ─── 5. Pinned Search Input (Law L1: width 320px pinned left) ─────────── */}
      <div id="classes-grid" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="w-full sm:w-80 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search classes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-border/40 bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#00A3C4]/30 min-h-[44px]"
            />
          </div>

          <div className="text-xs text-muted-foreground font-medium">
            Showing <strong className="font-mono tabular-nums text-foreground">{filteredClassrooms.length}</strong> of <strong className="font-mono tabular-nums text-foreground">{classList.length}</strong> classes
          </div>
        </div>

        {/* ─── 6. Academic Block Tabs ────────────────────────────────────────── */}
        <AcademicBlockTabs
          activeBlock={activeBlock}
          onBlockChange={setActiveBlock}
          counts={blockCounts}
        />

        {/* ─── 7. Class Hub Cards Grid (Surface 1 Layout) ────────────────────── */}
        {filteredClassrooms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredClassrooms.map((cls) => {
              const subCount = classSubjectCounts.get(cls.id) ?? 0;
              const teacherAssignedCount = classTeacherAssignedCounts.get(cls.id) ?? 0;
              const hasSections = cls.sections.length > 0;
              const hasSubjects = subCount > 0;
              const hasTeachers = teacherAssignedCount > 0;

              return (
                <div
                  key={cls.id}
                  onClick={() => router.push(`/academics/classes/${cls.id}`)}
                  className="group bg-card border border-border/40 rounded-2xl p-5 hover:shadow-md hover:border-[#00A3C4]/40 transition duration-150 flex flex-col justify-between cursor-pointer animate-fade-in"
                >
                  <div>
                    {/* Card Top: displayName + gradeLevel badge */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground border border-border/40 font-mono">
                        {cls.gradeLevel}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="w-3.5 h-3.5" />
                        <span>
                          {cls.sections.length} Section{cls.sections.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-foreground group-hover:text-[#00A3C4] dark:group-hover:text-[#64D2FF] transition tracking-tight">
                      {cls.displayName}
                    </h3>

                    {/* Sections Chips */}
                    <div className="flex flex-wrap gap-1.5 mt-2.5 mb-4">
                      {cls.sections.map((sec) => (
                        <span
                          key={sec.id}
                          className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold bg-[#00A3C4]/12 dark:bg-[#64D2FF]/15 text-[#00A3C4] dark:text-[#64D2FF] border border-[#00A3C4]/25 dark:border-[#64D2FF]/30 font-mono"
                        >
                          Section {sec.name}
                        </span>
                      ))}
                      {cls.sections.length === 0 && (
                        <span className="text-xs text-amber-500 font-medium">
                          No sections configured
                        </span>
                      )}
                    </div>

                    {/* Card Middle: SetupProgressBar 4-dot */}
                    <div className="py-3 border-t border-border/40">
                      <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider block mb-2">
                        Setup Progress
                      </span>
                      <SetupProgressBar
                        classId={cls.id}
                        variant="mini"
                        progress={{
                          sections: hasSections ? "done" : "empty",
                          subjects: hasSubjects ? "done" : "empty",
                          teachers: hasSubjects
                            ? teacherAssignedCount >= subCount
                              ? "done"
                              : hasTeachers
                              ? "partial"
                              : "empty"
                            : "empty",
                          timetable: hasSubjects && hasSections ? "done" : "empty",
                        }}
                      />
                    </div>
                  </div>

                  {/* Card Bottom Row: 'Open Hub' (primary), 'Edit' (secondary), 'Delete' (tertiary danger) */}
                  <div
                    className="pt-4 border-t border-border/40 mt-2 flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link
                      href={`/academics/classes/${cls.id}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-[#00A3C4] dark:bg-[#64D2FF] text-white dark:text-black hover:opacity-90 transition duration-150 min-h-[40px]"
                    >
                      Open Hub <ArrowRight className="w-3.5 h-3.5" />
                    </Link>

                    <Link
                      href={`/academics/classes/${cls.id}?tab=sections`}
                      className="inline-flex items-center justify-center gap-1 py-2 px-3 rounded-xl text-xs font-semibold border border-border/40 hover:bg-muted/40 text-foreground transition min-h-[40px]"
                      title="Edit class & sections"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                      Edit
                    </Link>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setClassToDelete(cls);
                        }}
                        title={`Delete ${cls.displayName}`}
                        className="p-2 rounded-xl text-muted-foreground hover:text-red-600 hover:bg-red-500/10 border border-border/40 hover:border-red-500/30 transition min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyStateCTA
            icon={GraduationCap}
            title={searchQuery ? "No matching classes" : "No classes configured yet"}
            hint={
              searchQuery
                ? `No academic classrooms match "${searchQuery}". Try a different keyword.`
                : "Create your school's first class and configure sections and curriculum."
            }
            ctaLabel={isAdmin ? "Create Class" : undefined}
            onCta={isAdmin ? () => setShowWizard(true) : undefined}
          />
        )}
      </div>

      {/* ─── 8. Class Creation Wizard ────────────────────────────────────────── */}
      {isAdmin && (
        <ClassCreationWizard
          isOpen={showWizard}
          onClose={() => setShowWizard(false)}
          existingSubjects={subjects}
          teachers={teachers}
          existingClassrooms={classList}
          onCreated={({ classId, displayName }) => {
            setPostActionStrip({
              outcome: `Class "${displayName}" was created successfully.`,
              suggestion: {
                label: `Attach subjects to ${displayName}`,
                href: `/academics/classes/${classId}?tab=subjects`,
                primary: true,
              },
              alternates: [
                {
                  label: "Open Class Hub",
                  href: `/academics/classes/${classId}`,
                },
              ],
            });
          }}
        />
      )}

      {/* ─── 9. Delete Class Confirmation Modal ──────────────────────────────── */}
      <ConfirmDialog
        open={!!classToDelete}
        onClose={() => {
          setClassToDelete(null);
          setDeleteError(null);
        }}
        title={`Delete ${classToDelete?.displayName || "Class"}?`}
        description={
          classToDelete ? (
            <p>
              This action will permanently delete{" "}
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {classToDelete.displayName}
              </span>
              , its {classToDelete.sections.length} section(s), and related configurations.
            </p>
          ) : undefined
        }
        error={deleteError}
        safetyChecks={[
          "No active students enrolled in this class",
          "No student attendance logs",
          "No active fee structures or exam schedules",
        ]}
        confirmText="Delete Class"
        isLoading={isDeleting}
        onConfirm={async () => {
          if (!classToDelete) return;
          setIsDeleting(true);
          setDeleteError(null);
          try {
            const res = await deleteClass(classToDelete.id);
            if (res.success) {
              const remaining = classList.filter((c) => c.id !== classToDelete.id);
              setClassList(remaining);
              toast.success(`Class "${classToDelete.displayName}" deleted.`);
              setClassToDelete(null);
              router.refresh();

              // Suggest Create Class only if class count becomes 0
              if (remaining.length === 0) {
                setPostActionStrip({
                  outcome: "All classes have been removed from this school.",
                  suggestion: {
                    label: "Create Class",
                    action: () => setShowWizard(true),
                    primary: true,
                  },
                });
              } else {
                setPostActionStrip(null);
              }
            }
          } catch (err: any) {
            setDeleteError(err.message || "Failed to delete class");
          } finally {
            setIsDeleting(false);
          }
        }}
      />
    </div>
  );
}
