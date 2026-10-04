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
} from "lucide-react";
import ClassCreationWizard from "./ClassCreationWizard";
import { deleteClass } from "../actions/class-setup.actions";
import AcademicBlockTabs, {
  AcademicBlockKey,
  getGradeBlock,
} from "@/components/academics/AcademicBlockTabs";

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
  const [classList, setClassList] = useState<Classroom[]>(classrooms);
  const [classToDelete, setClassToDelete] = useState<Classroom | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setClassList(classrooms);
  }, [classrooms]);

  const isTeacher = role === "TEACHER";

  // Calculate subject counts per class
  const classSubjectCounts = new Map<string, number>();
  mappings.forEach((m) => {
    classSubjectCounts.set(
      m.classId,
      (classSubjectCounts.get(m.classId) ?? 0) + 1,
    );
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

  return (
    <div className="space-y-8">
      {/* ─── 1. Header & Active Academic Year Banner ─────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900/10 via-primary/5 to-purple-900/10 dark:from-slate-800/60 dark:to-slate-900/60 border border-primary/20 dark:border-slate-800 rounded-2xl p-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Active Session
            </span>
            <span className="text-xs text-gray-500 font-medium">
              Academic Management System
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            {activeYear ? activeYear.name : "Academic Year Not Set"}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {activeYear
              ? `${activeYear.startDate} to ${activeYear.endDate}`
              : "Please activate an academic year to manage curriculum and timetables."}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/academics/setup/calendar"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition shadow-sm"
          >
            <Calendar className="w-4 h-4 text-blue-500" />
            Calendar & Terms
          </Link>
          <Link
            href="/academics/reports"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition shadow-sm"
          >
            <BarChart3 className="w-4 h-4 text-purple-500" />
            Academic Reports
          </Link>
          {isAdmin && (
            <button
              onClick={() => setShowWizard(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/95 text-white transition shadow-md shadow-primary/20"
            >
              <Plus className="w-4 h-4" />
              Create Class
            </button>
          )}
        </div>
      </div>

      {/* ─── 2. Operational Summary Metrics Cards ───────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Classes
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {classrooms.length}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            {totalSections} active sections
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Subjects Mapped
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {mappings.length}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            Across {subjects.length} catalog subjects
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Substitutions
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                pendingSubstitutionsCount > 0
                  ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600"
                  : "bg-green-50 dark:bg-green-900/20 text-green-600"
              }`}
            >
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {pendingSubstitutionsCount}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            {pendingSubstitutionsCount > 0
              ? "Pending coverage today"
              : "All periods covered"}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Bell Schedule
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center">
              <CalendarDays className="w-4 h-4" />
            </div>
          </div>
          <Link
            href="/academics/setup/bell-schedule"
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1 mt-2"
          >
            Configure Periods <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <div className="text-[11px] text-gray-400 mt-1">
            Dynamic period schedule
          </div>
        </div>
      </div>

      {/* ─── 3. Header & Filter Bar ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            Class Hubs & Sections ({classrooms.length})
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage classroom blocks, subjects, and section assignments
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search classes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* ─── 4. Class-Centric Hub Grid ────────────────────────────────────────── */}
      <div className="space-y-6">
          <AcademicBlockTabs
            activeBlock={activeBlock}
            onBlockChange={setActiveBlock}
            counts={blockCounts}
          />
          {filteredClassrooms.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredClassrooms.map((cls) => {
                const subCount = classSubjectCounts.get(cls.id) ?? 0;
                return (
                  <div
                    key={cls.id}
                    className="group bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 hover:shadow-md hover:border-primary/40 transition duration-150 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 font-mono">
                          {cls.gradeLevel}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-400">
                            {cls.sections.length} Section
                            {cls.sections.length === 1 ? "" : "s"}
                          </span>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDeleteError(null);
                                setClassToDelete(cls);
                              }}
                              title={`Delete ${cls.displayName}`}
                              className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition opacity-80 group-hover:opacity-100"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-primary transition">
                        {cls.displayName}
                      </h3>

                      {/* Sections badges */}
                      <div className="flex flex-wrap gap-1.5 mt-3 mb-4">
                        {cls.sections.map((sec) => (
                          <span
                            key={sec.id}
                            className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
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

                      <div className="grid grid-cols-2 gap-2 py-3 border-t border-gray-100 dark:border-slate-800/80 text-xs text-gray-500">
                        <div>
                          <span className="text-[11px] uppercase text-gray-400 font-semibold block">
                            Subjects
                          </span>
                          <span className="font-bold text-gray-800 dark:text-gray-200">
                            {subCount} Mapped
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] uppercase text-gray-400 font-semibold block">
                            Status
                          </span>
                          <span className="font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100 dark:border-slate-800/80 mt-2 flex items-center gap-2">
                      <Link
                        href={`/academics/classes/${cls.id}`}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold bg-primary/10 hover:bg-primary text-primary hover:text-white transition duration-150"
                      >
                        Open Class Hub <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDeleteError(null);
                            setClassToDelete(cls);
                          }}
                          title={`Delete ${cls.displayName}`}
                          className="p-2.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 border border-gray-200 dark:border-slate-800 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-dashed border-gray-300 dark:border-slate-800 rounded-2xl p-12 text-center">
              <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-800 dark:text-white">
                No classes found
              </h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1 mb-4">
                {searchQuery
                  ? `No classes matching "${searchQuery}".`
                  : "Get started by creating your school's first class."}
              </p>
              {isAdmin && (
                <button
                  onClick={() => setShowWizard(true)}
                  className="inline-flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold"
                >
                  <Plus className="w-4 h-4" /> Create Class
                </button>
              )}
            </div>
          )}
        </div>

      {/* ─── 5. Progressive Class Creation Wizard ──────────────────────────────── */}
      {isAdmin && (
        <ClassCreationWizard
          isOpen={showWizard}
          onClose={() => setShowWizard(false)}
          existingSubjects={subjects}
          teachers={teachers}
        />
      )}

      {/* ─── 6. Delete Class Confirmation Modal ──────────────────────────────── */}
      {classToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Delete {classToDelete.displayName}?
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This action will permanently delete <span className="font-semibold text-gray-800 dark:text-gray-200">{classToDelete.displayName}</span>, its {classToDelete.sections.length} section(s), and related configurations.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Cannot Delete Class
                </div>
                <div>{deleteError}</div>
              </div>
            )}

            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-3.5 text-xs text-gray-600 dark:text-gray-400 space-y-1 border border-gray-100 dark:border-slate-800">
              <div className="font-semibold text-gray-700 dark:text-gray-300">Deletion Safety Checks:</div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-gray-500">
                <li>No active students enrolled in this class</li>
                <li>No student attendance logs</li>
                <li>No active fee structures or exam schedules</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setClassToDelete(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  if (!classToDelete) return;
                  setIsDeleting(true);
                  setDeleteError(null);
                  try {
                    const res = await deleteClass(classToDelete.id);
                    if (res.success) {
                      setClassList((prev) => prev.filter((c) => c.id !== classToDelete.id));
                      setClassToDelete(null);
                      router.refresh();
                    }
                  } catch (err: any) {
                    setDeleteError(err.message || "Failed to delete class");
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 shadow-sm shadow-red-500/20 transition disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" /> Delete Class
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
