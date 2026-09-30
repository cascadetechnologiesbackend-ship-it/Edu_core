"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Plus,
  Calendar,
  Layers,
  GraduationCap,
  ArrowLeft,
  Edit2,
  Trash2,
  FileText,
  Award,
  Sparkles,
  ClipboardList,
  Loader2,
  X,
  UserCheck,
} from "lucide-react";
import {
  saveSection,
  saveClassSubject,
  saveSubject,
  saveAssignment,
} from "../../actions";
import {
  saveTimetablePeriod,
  deleteTimetablePeriod,
  saveTimetableSubstitution,
} from "../../actions/timetable.actions";
import { saveAssessment } from "../../actions/assessment.actions";
import { deleteClass } from "../../actions/class-setup.actions";

type Section = {
  id: string;
  name: string;
  capacity: number;
  classTeacherId: string | null;
  roomNumber: string | null;
  classTeacher?: { id: string; email: string } | null;
};

type ClassSubject = {
  id: string;
  classId: string;
  subjectId: string;
  assignedTeacherId: string | null;
  periodsPerWeek: number;
  isElective: boolean;
  subject: {
    id: string;
    name: string;
    code: string;
    subjectType: string;
  };
  teacher?: { id: string; email: string } | null;
};

type BellPeriod = {
  id: string;
  periodNumber: number;
  name: string;
  startTime: string;
  endTime: string;
  periodType: string;
};

type SubjectProgress = {
  classSubjectId: string;
  subjectName: string;
  total: number;
  completed: number;
  percentage: number;
};

const DAYS_OF_WEEK = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

export default function ClassHubClient({
  cls,
  overview,
  activeYearName,
  bellPeriods,
  allSubjects,
  allTeachers,
  initialTimetable = [],
  initialAssignments = [],
  initialLessonPlans = [],
  initialAssessments = [],
  isAdmin,
  isTeacher,
  userId,
}: {
  cls: {
    id: string;
    displayName: string;
    gradeLevel: string;
    sortOrder: number;
    sections: Section[];
    classSubjects: ClassSubject[];
  };
  overview: {
    sectionCount: number;
    subjectCount: number;
    pendingLessonPlansCount: number;
    pendingAssignmentsCount: number;
    overallProgress: number;
    subjectProgress: SubjectProgress[];
  };
  activeYearName: string;
  bellPeriods: BellPeriod[];
  allSubjects: Array<{ id: string; name: string; code: string; subjectType: string }>;
  allTeachers: Array<{ id: string; email: string }>;
  initialTimetable?: any[];
  initialAssignments?: any[];
  initialLessonPlans?: any[];
  initialAssessments?: any[];
  isAdmin: boolean;
  isTeacher: boolean;
  userId: string;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "sections"
    | "subjects"
    | "timetable"
    | "syllabus"
    | "assignments"
    | "lessons"
    | "assessments"
  >("overview");

  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Delete Class State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Section modal
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [newSectionName, setNewSectionName] = useState("C");
  const [newSectionCap, setNewSectionCap] = useState(40);
  const [newSectionTeacher, setNewSectionTeacher] = useState("");
  const [newSectionRoom, setNewSectionRoom] = useState("");

  // Attach Subject modal
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [assignedTeacherId, setAssignedTeacherId] = useState("");
  const [periodsPerWeek, setPeriodsPerWeek] = useState(5);

  // Inline Subject Creation inside Attach Subject modal
  const [showInlineSubject, setShowInlineSubject] = useState(false);
  const [inlineSubName, setInlineSubName] = useState("");
  const [inlineSubCode, setInlineSubCode] = useState("");
  const [inlineSubType, setInlineSubType] = useState<
    "THEORY" | "PRACTICAL" | "CO_SCHOLASTIC" | "LANGUAGE" | "ACTIVITY"
  >("THEORY");

  // Timetable State
  const [selectedTimetableSection, setSelectedTimetableSection] = useState<string>(
    cls.sections[0]?.id || "",
  );
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [periodFormData, setPeriodFormData] = useState({
    dayOfWeek: "MONDAY" as (typeof DAYS_OF_WEEK)[number],
    periodNumber: 1,
    startTime: "08:30",
    endTime: "09:15",
    periodType: "REGULAR",
    subjectId: "",
    teacherId: "",
    roomNumber: "",
  });

  // Substitution Modal
  const [showSubModal, setShowSubModal] = useState(false);
  const [subFormData, setSubFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    timetablePeriodId: "",
    originalTeacherId: "",
    substituteTeacherId: "",
    subjectId: "",
    reason: "",
  });

  // Calculate setup checklist metrics
  const hasSections = cls.sections.length > 0;
  const hasSubjects = cls.classSubjects.length > 0;
  const assignedTeachersCount = cls.classSubjects.filter(
    (cs) => cs.assignedTeacherId,
  ).length;
  const hasTeachers = assignedTeachersCount > 0;
  const hasSyllabus = overview.overallProgress > 0;
  const hasTimetable = initialTimetable.length > 0;

  // Handlers
  const handleCreateSection = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await saveSection({
          classId: cls.id,
          name: newSectionName.trim(),
          capacity: newSectionCap,
          classTeacherId: newSectionTeacher || null,
          roomNumber: newSectionRoom.trim() || null,
        });
        setShowSectionModal(false);
        router.refresh();
      } catch (err: any) {
        setErrorMsg(err?.message || "Failed to create section");
      }
    });
  };

  const handleAttachSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId) return;
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await saveClassSubject({
          classId: cls.id,
          subjectId: selectedSubjectId,
          assignedTeacherId: assignedTeacherId || null,
          periodsPerWeek,
        });
        setShowSubjectModal(false);
        router.refresh();
      } catch (err: any) {
        setErrorMsg(err?.message || "Failed to attach subject");
      }
    });
  };

  const handleInlineSubjectCreate = async () => {
    if (!inlineSubName.trim() || !inlineSubCode.trim()) return;
    try {
      await saveSubject({
        name: inlineSubName.trim(),
        code: inlineSubCode.trim().toUpperCase(),
        type: inlineSubType,
      });
      setShowInlineSubject(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to create subject");
    }
  };

  const handleSaveTimetableSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTimetableSection) return;
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await saveTimetablePeriod({
          sectionId: selectedTimetableSection,
          dayOfWeek: periodFormData.dayOfWeek,
          periodNumber: periodFormData.periodNumber,
          startTime: periodFormData.startTime,
          endTime: periodFormData.endTime,
          periodType: periodFormData.periodType as any,
          subjectId: periodFormData.subjectId || null,
          teacherId: periodFormData.teacherId || null,
          roomNumber: periodFormData.roomNumber || null,
        });
        setShowPeriodModal(false);
        router.refresh();
      } catch (err: any) {
        setErrorMsg(err?.message || "Conflict saving timetable period");
      }
    });
  };

  const handleOpenSlotModal = (
    day: (typeof DAYS_OF_WEEK)[number],
    period: BellPeriod,
  ) => {
    const existing = initialTimetable.find(
      (t) =>
        t.sectionId === selectedTimetableSection &&
        t.dayOfWeek === day &&
        t.periodNumber === period.periodNumber,
    );

    setPeriodFormData({
      dayOfWeek: day,
      periodNumber: period.periodNumber,
      startTime: period.startTime,
      endTime: period.endTime,
      periodType: period.periodType,
      subjectId: existing?.subjectId || "",
      teacherId: existing?.teacherId || "",
      roomNumber: existing?.roomNumber || "",
    });
    setShowPeriodModal(true);
  };

  const handleSaveSubstitution = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await saveTimetableSubstitution({
          timetablePeriodId: subFormData.timetablePeriodId,
          sectionId: selectedTimetableSection,
          date: subFormData.date || new Date().toISOString().slice(0, 10),
          originalTeacherId: subFormData.originalTeacherId,
          substituteTeacherId: subFormData.substituteTeacherId || null,
          subjectId: subFormData.subjectId || null,
          reason: subFormData.reason || null,
        });
        setShowSubModal(false);
        router.refresh();
      } catch (err: any) {
        setErrorMsg(err?.message || "Failed to save substitution");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* ─── Breadcrumb & Class Header ────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link
              href="/academics"
              className="hover:text-primary transition flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Academics Hub
            </Link>
            <span>/</span>
            <span>Classes</span>
            <span>/</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {cls.displayName}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white">
              {cls.displayName}
            </h1>
            <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-primary/10 text-primary font-mono">
              {cls.gradeLevel}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Academic Year {activeYearName} · Class Hub
          </p>
        </div>

        {/* Setup Checklist Bar & Action */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center flex-wrap gap-2 text-[11px] font-semibold">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg ${
                hasSections
                  ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border border-green-200 dark:border-green-800"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {hasSections ? "✓" : "○"} {cls.sections.length} Sections
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg ${
                hasSubjects
                  ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border border-green-200 dark:border-green-800"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {hasSubjects ? "✓" : "○"} {cls.classSubjects.length} Subjects
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg ${
                hasTeachers
                  ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border border-green-200 dark:border-green-800"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
              }`}
            >
              {hasTeachers ? "✓" : "○"} {assignedTeachersCount}/
              {cls.classSubjects.length} Teachers
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg ${
                hasSyllabus
                  ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border border-green-200 dark:border-green-800"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {hasSyllabus ? "✓" : "○"} {overview.overallProgress}% Syllabus
            </span>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setShowDeleteModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-600 hover:text-white hover:bg-red-600 border border-red-200 dark:border-red-900/50 transition duration-150 shadow-xs shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Class
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ─── Class Hub 8 Navigation Tabs ─────────────────────────────────── */}
      <div className="border-b border-gray-200 dark:border-slate-800 overflow-x-auto">
        <nav className="flex space-x-6">
          {[
            { id: "overview", label: "Overview", icon: Layers },
            { id: "sections", label: `Sections (${cls.sections.length})`, icon: Users },
            { id: "subjects", label: `Subjects (${cls.classSubjects.length})`, icon: BookOpen },
            { id: "timetable", label: "Timetable", icon: Clock },
            { id: "syllabus", label: "Syllabus Progress", icon: GraduationCap },
            { id: "assignments", label: "Assignments", icon: FileText },
            { id: "lessons", label: "Lesson Plans", icon: ClipboardList },
            { id: "assessments", label: "Assessments", icon: Award },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-1 border-b-2 font-bold text-xs flex items-center gap-1.5 transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ─── TAB 1: OVERVIEW ──────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Top 4 Key Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <span className="text-xs uppercase text-gray-400 font-bold block mb-1">
                Sections
              </span>
              <div className="text-2xl font-extrabold text-gray-900 dark:text-white">
                {cls.sections.length}
              </div>
              <span className="text-[11px] text-gray-400">
                {cls.sections.map((s) => s.name).join(", ") || "None"}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <span className="text-xs uppercase text-gray-400 font-bold block mb-1">
                Subjects
              </span>
              <div className="text-2xl font-extrabold text-gray-900 dark:text-white">
                {cls.classSubjects.length}
              </div>
              <span className="text-[11px] text-gray-400">
                {assignedTeachersCount} with assigned teachers
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <span className="text-xs uppercase text-gray-400 font-bold block mb-1">
                Pending Lessons
              </span>
              <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
                {overview.pendingLessonPlansCount}
              </div>
              <span className="text-[11px] text-gray-400">
                Status: PLANNED
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <span className="text-xs uppercase text-gray-400 font-bold block mb-1">
                Open Assignments
              </span>
              <div className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">
                {overview.pendingAssignmentsCount}
              </div>
              <span className="text-[11px] text-gray-400">
                Active submissions
              </span>
            </div>
          </div>

          {/* Overall Syllabus Progress Bar */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Overall Syllabus Trajectory
                </h3>
                <p className="text-xs text-gray-500">
                  Calculated from distinct completed syllabus topics across all subjects
                </p>
              </div>
              <span className="text-2xl font-black text-primary">
                {overview.overallProgress}%
              </span>
            </div>

            <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-500"
                style={{ width: `${overview.overallProgress}%` }}
              />
            </div>
          </div>

          {/* Subject Trajectory List */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Class Subjects & Workspaces
              </h3>
              {isAdmin && (
                <button
                  onClick={() => setShowSubjectModal(true)}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Attach Subject
                </button>
              )}
            </div>

            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {cls.classSubjects.map((cs) => {
                const prog = overview.subjectProgress.find(
                  (sp) => sp.classSubjectId === cs.id,
                );
                const pct = prog?.percentage ?? 0;
                return (
                  <div
                    key={cs.id}
                    className="p-4 flex items-center justify-between hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-gray-900 dark:text-white truncate">
                          {cs.subject.name}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-gray-100 dark:bg-slate-800 text-gray-500">
                          {cs.subject.code}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">
                        Lead Teacher:{" "}
                        {cs.teacher ? (
                          <span className="text-gray-700 dark:text-gray-300 font-medium">
                            {cs.teacher.email}
                          </span>
                        ) : (
                          <span className="text-amber-500 font-medium">
                            Not assigned
                          </span>
                        )}
                        {" · "}
                        {prog ? `${prog.completed}/${prog.total} Topics` : "No syllabus"}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-32 hidden sm:block text-right">
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block mb-1">
                          {pct}%
                        </span>
                        <div className="w-full bg-gray-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-primary h-full rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <Link
                        href={`/academics/classes/${cls.id}/subjects/${cs.id}`}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary/10 hover:bg-primary text-primary hover:text-white transition flex items-center gap-1 shrink-0"
                      >
                        Open Workspace <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}

              {cls.classSubjects.length === 0 && (
                <div className="py-8 text-center text-xs text-gray-400">
                  No subjects configured for this class yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: SECTIONS ─────────────────────────────────────────────── */}
      {activeTab === "sections" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Sections for {cls.displayName}
            </h3>
            {isAdmin && (
              <button
                onClick={() => setShowSectionModal(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-primary text-white flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Section
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cls.sections.map((sec) => (
              <div
                key={sec.id}
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xl font-bold text-gray-900 dark:text-white">
                      Section {sec.name}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded font-mono bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                      Cap: {sec.capacity}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
                    <div>
                      <span className="text-gray-400 block text-[11px] uppercase font-bold">
                        Class Teacher
                      </span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">
                        {sec.classTeacher?.email || "Unassigned"}
                      </span>
                    </div>

                    <div>
                      <span className="text-gray-400 block text-[11px] uppercase font-bold">
                        Room Number
                      </span>
                      <span className="font-medium">
                        {sec.roomNumber || "Not specified"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-slate-800 mt-4 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setSelectedTimetableSection(sec.id);
                      setActiveTab("timetable");
                    }}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    View Timetable <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 3: SUBJECTS ─────────────────────────────────────────────── */}
      {activeTab === "subjects" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Subject Offerings
            </h3>
            {isAdmin && (
              <button
                onClick={() => setShowSubjectModal(true)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary text-white flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Attach Subject
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cls.classSubjects.map((cs) => {
              const prog = overview.subjectProgress.find(
                (sp) => sp.classSubjectId === cs.id,
              );
              return (
                <div
                  key={cs.id}
                  className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-base font-bold text-gray-900 dark:text-white">
                        {cs.subject.name}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-gray-100 dark:bg-slate-800 text-gray-500">
                        {cs.subject.code}
                      </span>
                    </div>

                    <div className="text-xs text-gray-500 space-y-1 mb-4">
                      <div>
                        Lead Teacher:{" "}
                        <span className="text-gray-800 dark:text-gray-200 font-semibold">
                          {cs.teacher?.email || "Unassigned"}
                        </span>
                      </div>
                      <div>
                        Periods / Week:{" "}
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          {cs.periodsPerWeek}
                        </span>
                      </div>
                      <div>
                        Syllabus Progress:{" "}
                        <span className="font-bold text-primary">
                          {prog ? `${prog.percentage}%` : "0%"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100 dark:border-slate-800">
                    <Link
                      href={`/academics/classes/${cls.id}/subjects/${cs.id}`}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-primary/10 hover:bg-primary text-primary hover:text-white transition"
                    >
                      Open Subject Workspace <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── TAB 4: TIMETABLE ────────────────────────────────────────────── */}
      {activeTab === "timetable" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Section Switcher */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">Section:</span>
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
                {cls.sections.map((sec) => (
                  <button
                    key={sec.id}
                    onClick={() => setSelectedTimetableSection(sec.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      selectedTimetableSection === sec.id
                        ? "bg-white dark:bg-slate-900 text-primary shadow-xs"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    Section {sec.name}
                  </button>
                ))}
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSubModal(true)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100"
                >
                  + Add Substitution
                </button>
                <Link
                  href="/academics/setup/bell-schedule"
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200"
                >
                  Configure Bell Schedule
                </Link>
              </div>
            )}
          </div>

          {/* Timetable Grid */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/75 dark:bg-slate-800/40 border-b border-gray-200 dark:border-slate-800 text-[11px] font-bold uppercase text-gray-500">
                  <th className="p-3 w-28">Period</th>
                  {DAYS_OF_WEEK.map((d) => (
                    <th key={d} className="p-3 min-w-[130px]">
                      {d.slice(0, 3)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {bellPeriods.map((period) => (
                  <tr key={period.id}>
                    <td className="p-3 font-semibold text-gray-700 dark:text-gray-300 bg-gray-50/30 dark:bg-slate-800/20">
                      <div className="font-bold text-gray-900 dark:text-white">
                        {period.name}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        {period.startTime} - {period.endTime}
                      </div>
                    </td>

                    {DAYS_OF_WEEK.map((day) => {
                      const entry = initialTimetable.find(
                        (t) =>
                          t.sectionId === selectedTimetableSection &&
                          t.dayOfWeek === day &&
                          t.periodNumber === period.periodNumber,
                      );

                      return (
                        <td
                          key={day}
                          onClick={() =>
                            isAdmin && handleOpenSlotModal(day, period)
                          }
                          className={`p-2.5 transition ${
                            isAdmin ? "cursor-pointer hover:bg-primary/5" : ""
                          }`}
                        >
                          {entry ? (
                            <div className="p-2 rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10">
                              <span className="font-bold text-xs text-gray-900 dark:text-white block truncate">
                                {entry.subject?.name || "Subject"}
                              </span>
                              <span className="text-[10px] text-gray-500 block truncate">
                                {entry.teacher?.email || "No teacher"}
                              </span>
                              {entry.roomNumber && (
                                <span className="text-[10px] text-gray-400 block font-mono">
                                  Rm {entry.roomNumber}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="h-12 border border-dashed border-gray-200 dark:border-slate-800 rounded-xl flex items-center justify-center text-[10px] text-gray-400">
                              {isAdmin ? "+ Add" : "—"}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 5: SYLLABUS ─────────────────────────────────────────────── */}
      {activeTab === "syllabus" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Class-Wide Curriculum & Syllabus Progress
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {overview.subjectProgress.map((sp) => (
              <div
                key={sp.classSubjectId}
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-gray-900 dark:text-white">
                      {sp.subjectName}
                    </span>
                    <span className="text-sm font-bold text-primary">
                      {sp.percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mb-3">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${sp.percentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500">
                    Completed {sp.completed} of {sp.total} active syllabus topics
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-slate-800 mt-3">
                  <Link
                    href={`/academics/classes/${cls.id}/subjects/${sp.classSubjectId}`}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    Manage Syllabus Hierarchy in Workspace →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 6: ASSIGNMENTS ──────────────────────────────────────────── */}
      {activeTab === "assignments" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Assignments & Homework
            </h3>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl divide-y divide-gray-100 dark:divide-slate-800 shadow-xs">
            {initialAssignments.map((a: any) => (
              <div key={a.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-gray-900 dark:text-white">
                      {a.title}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      Section {a.section?.name || "All"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Subject: {a.classSubject?.subject?.name} · Due:{" "}
                    {new Date(a.dueDate).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300">
                  {a.status}
                </span>
              </div>
            ))}

            {initialAssignments.length === 0 && (
              <div className="py-8 text-center text-xs text-gray-400">
                No assignments recorded for this class yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 7: LESSON PLANS ─────────────────────────────────────────── */}
      {activeTab === "lessons" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Class Lesson Plans
            </h3>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl divide-y divide-gray-100 dark:divide-slate-800 shadow-xs">
            {initialLessonPlans.map((lp: any) => (
              <div key={lp.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-gray-900 dark:text-white">
                      {lp.title}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                      {lp.chapterName}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Subject: {lp.classSubject?.subject?.name}
                    {lp.plannedDate &&
                      ` · Planned: ${new Date(lp.plannedDate).toLocaleDateString()}`}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    lp.status === "COMPLETED"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                  }`}
                >
                  {lp.status}
                </span>
              </div>
            ))}

            {initialLessonPlans.length === 0 && (
              <div className="py-8 text-center text-xs text-gray-400">
                No lesson plans recorded for this class yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 8: ASSESSMENTS ──────────────────────────────────────────── */}
      {activeTab === "assessments" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Assessments & Tests
            </h3>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl divide-y divide-gray-100 dark:divide-slate-800 shadow-xs">
            {initialAssessments.map((asm: any) => (
              <div key={asm.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-gray-900 dark:text-white">
                      {asm.title}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                      {asm.type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Subject: {asm.classSubject?.subject?.name} · Date:{" "}
                    {asm.date} · Max Marks: {asm.maxMarks}
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300">
                  {asm.status}
                </span>
              </div>
            ))}

            {initialAssessments.length === 0 && (
              <div className="py-8 text-center text-xs text-gray-400">
                No assessments scheduled yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL: Add Section ──────────────────────────────────────────── */}
      {showSectionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSection}
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Add Section to {cls.displayName}
              </h3>
              <button
                type="button"
                onClick={() => setShowSectionModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Section Name (e.g. C, D)
              </label>
              <input
                type="text"
                required
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Capacity
              </label>
              <input
                type="number"
                value={newSectionCap}
                onChange={(e) =>
                  setNewSectionCap(parseInt(e.target.value) || 40)
                }
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Class Teacher
              </label>
              <select
                value={newSectionTeacher}
                onChange={(e) => setNewSectionTeacher(e.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
              >
                <option value="">None / Unassigned</option>
                {allTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Room Number
              </label>
              <input
                type="text"
                value={newSectionRoom}
                onChange={(e) => setNewSectionRoom(e.target.value)}
                placeholder="e.g. 204"
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowSectionModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-primary text-white disabled:opacity-50"
              >
                Create Section
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── MODAL: Attach Subject ───────────────────────────────────────── */}
      {showSubjectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAttachSubject}
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Attach Subject to {cls.displayName}
              </h3>
              <button
                type="button"
                onClick={() => setShowSubjectModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">
                  Select Subject
                </label>
                <button
                  type="button"
                  onClick={() => setShowInlineSubject(!showInlineSubject)}
                  className="text-[11px] font-bold text-primary hover:underline"
                >
                  {showInlineSubject ? "Select Existing" : "+ Create New"}
                </button>
              </div>

              {!showInlineSubject ? (
                <select
                  required
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select subject from catalog</option>
                  {allSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 space-y-2">
                  <input
                    type="text"
                    placeholder="Subject Name (e.g. Psychology)"
                    value={inlineSubName}
                    onChange={(e) => setInlineSubName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Code (e.g. PSY01)"
                      value={inlineSubCode}
                      onChange={(e) => setInlineSubCode(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs uppercase"
                    />
                    <select
                      value={inlineSubType}
                      onChange={(e) => setInlineSubType(e.target.value as any)}
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs"
                    >
                      <option value="THEORY">Theory</option>
                      <option value="PRACTICAL">Practical</option>
                      <option value="CO_SCHOLASTIC">Co-Scholastic</option>
                      <option value="LANGUAGE">Language</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleInlineSubjectCreate}
                    className="w-full py-1 text-xs font-bold bg-primary text-white rounded-lg"
                  >
                    Save Subject to Catalog
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Lead Teacher (Optional)
              </label>
              <select
                value={assignedTeacherId}
                onChange={(e) => setAssignedTeacherId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
              >
                <option value="">None / Unassigned</option>
                {allTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Periods Per Week
              </label>
              <input
                type="number"
                value={periodsPerWeek}
                onChange={(e) =>
                  setPeriodsPerWeek(parseInt(e.target.value) || 5)
                }
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowSubjectModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-primary text-white disabled:opacity-50"
              >
                Attach Subject
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── MODAL: Schedule Timetable Slot ──────────────────────────────── */}
      {showPeriodModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveTimetableSlot}
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Schedule {periodFormData.dayOfWeek} · Period {periodFormData.periodNumber}
              </h3>
              <button
                type="button"
                onClick={() => setShowPeriodModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Subject
              </label>
              <select
                value={periodFormData.subjectId}
                onChange={(e) =>
                  setPeriodFormData({
                    ...periodFormData,
                    subjectId: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
              >
                <option value="">None / Free Period</option>
                {cls.classSubjects.map((cs) => (
                  <option key={cs.subject.id} value={cs.subject.id}>
                    {cs.subject.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Teacher
              </label>
              <select
                value={periodFormData.teacherId}
                onChange={(e) =>
                  setPeriodFormData({
                    ...periodFormData,
                    teacherId: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
              >
                <option value="">None</option>
                {allTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Room Number
              </label>
              <input
                type="text"
                value={periodFormData.roomNumber}
                onChange={(e) =>
                  setPeriodFormData({
                    ...periodFormData,
                    roomNumber: e.target.value,
                  })
                }
                placeholder="e.g. 101"
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowPeriodModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-primary text-white disabled:opacity-50"
              >
                Save Period
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── MODAL: Add Substitution ────────────────────────────────────── */}
      {showSubModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveSubstitution}
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Teacher Substitution
              </h3>
              <button
                type="button"
                onClick={() => setShowSubModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Date
              </label>
              <input
                type="date"
                required
                value={subFormData.date}
                onChange={(e) =>
                  setSubFormData({ ...subFormData, date: e.target.value })
                }
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              />
            </div>            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Timetable Period
              </label>
              <select
                required
                value={subFormData.timetablePeriodId}
                onChange={(e) => {
                  const pId = e.target.value;
                  const foundP = initialTimetable.find((p: any) => p.id === pId);
                  setSubFormData({
                    ...subFormData,
                    timetablePeriodId: pId,
                    originalTeacherId: foundP?.teacherId || subFormData.originalTeacherId,
                    subjectId: foundP?.subjectId || subFormData.subjectId,
                  });
                }}
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              >
                <option value="">Select period to substitute</option>
                {initialTimetable
                  .filter((p: any) => p.sectionId === selectedTimetableSection)
                  .map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.dayOfWeek} — Period {p.periodNumber} ({p.startTime}–{p.endTime}) {p.subject ? `· ${p.subject.name}` : ""}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Absent Teacher
              </label>
              <select
                required
                value={subFormData.originalTeacherId}
                onChange={(e) =>
                  setSubFormData({
                    ...subFormData,
                    originalTeacherId: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              >
                <option value="">Select absent teacher</option>
                {allTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Proxy / Substitute Teacher
              </label>
              <select
                required
                value={subFormData.substituteTeacherId}
                onChange={(e) =>
                  setSubFormData({
                    ...subFormData,
                    substituteTeacherId: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              >
                <option value="">Select substitute teacher</option>
                {allTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Reason
              </label>
              <input
                type="text"
                placeholder="e.g. Sick Leave, Medical Emergency"
                value={subFormData.reason}
                onChange={(e) =>
                  setSubFormData({ ...subFormData, reason: e.target.value })
                }
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowSubModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-primary text-white disabled:opacity-50"
              >
                Confirm Substitution
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── Delete Class Confirmation Modal ─── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Delete {cls.displayName}?
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This action will permanently delete <span className="font-semibold text-gray-800 dark:text-gray-200">{cls.displayName}</span>, its {cls.sections.length} section(s), and related configurations.
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
                  setShowDeleteModal(false);
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
                  setIsDeleting(true);
                  setDeleteError(null);
                  try {
                    const res = await deleteClass(cls.id);
                    if (res.success) {
                      setShowDeleteModal(false);
                      router.push("/academics");
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
