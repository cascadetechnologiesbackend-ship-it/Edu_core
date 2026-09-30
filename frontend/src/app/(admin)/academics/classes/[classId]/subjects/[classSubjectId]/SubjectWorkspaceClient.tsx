"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  Archive,
  RefreshCw,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Layers,
  FileText,
  ClipboardList,
  Award,
  BarChart3,
  X,
  Loader2,
  UserCheck,
  Calendar,
  Check,
} from "lucide-react";
import {
  saveSyllabusUnit,
  archiveSyllabusUnit,
  restoreSyllabusUnit,
  saveSyllabusChapter,
  archiveSyllabusChapter,
  restoreSyllabusChapter,
  saveSyllabusTopic,
  archiveSyllabusTopic,
  restoreSyllabusTopic,
} from "../../../../actions/syllabus.actions";
import {
  saveLessonPlan,
  saveAssignment,
  gradeSubmission,
} from "../../../../actions";
import { saveAssessment } from "../../../../actions/assessment.actions";
import { assignSectionTeacher } from "../../../../actions/class-setup.actions";

type Topic = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  estimatedPeriods: number;
  isActive: boolean;
};

type Chapter = {
  id: string;
  name: string;
  ncertReference: string | null;
  sortOrder: number;
  isActive: boolean;
  topics: Topic[];
};

type Unit = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  term?: { id: string; name: string } | null;
  chapters: Chapter[];
};

type Section = {
  id: string;
  name: string;
};

type SectionTeacher = {
  id: string;
  sectionId: string;
  teacherId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  teacher?: { id: string; email: string } | null;
  section?: { id: string; name: string } | null;
};

type LessonPlan = {
  id: string;
  syllabusTopicId: string | null;
  title: string;
  chapterName: string;
  ncertReference: string | null;
  objectives: string | null;
  plannedDate: string | null;
  completedDate: string | null;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED";
  createdAt: string;
};

type Assignment = {
  id: string;
  sectionId: string;
  title: string;
  description: string;
  dueDate: string;
  maxMarks: number;
  status: "DRAFT" | "PUBLISHED" | "CLOSED" | "GRADED";
  section?: { name: string } | null;
};

type Assessment = {
  id: string;
  sectionId: string | null;
  title: string;
  type: string;
  date: string;
  maxMarks: number;
  status: string;
  section?: { name: string } | null;
};

export default function SubjectWorkspaceClient({
  classSubjectId,
  classId,
  className,
  subjectName,
  subjectCode,
  leadTeacherEmail,
  sections,
  sectionTeachers,
  initialUnits,
  initialLessonPlans,
  initialAssignments,
  initialAssessments,
  initialProgress,
  allTeachers,
  isAdmin,
  isTeacher,
  userId,
}: {
  classSubjectId: string;
  classId: string;
  className: string;
  subjectName: string;
  subjectCode: string;
  leadTeacherEmail: string | null;
  sections: Section[];
  sectionTeachers: SectionTeacher[];
  initialUnits: Unit[];
  initialLessonPlans: LessonPlan[];
  initialAssignments: Assignment[];
  initialAssessments: Assessment[];
  initialProgress: {
    totalTopics: number;
    completedTopics: number;
    percentage: number;
  };
  allTeachers: Array<{ id: string; email: string }>;
  isAdmin: boolean;
  isTeacher: boolean;
  userId: string;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "syllabus"
    | "lessons"
    | "assignments"
    | "homework"
    | "assessments"
    | "progress"
  >("overview");

  // Operational Section Filter Context: "ALL" (Curriculum Mode) or specific sectionId
  const [selectedSectionId, setSelectedSectionId] = useState<string>("ALL");

  const [units, setUnits] = useState<Unit[]>(initialUnits);
  const [lessonPlans, setLessonPlans] =
    useState<LessonPlan[]>(initialLessonPlans);
  const [assignments, setAssignments] =
    useState<Assignment[]>(initialAssignments);
  const [assessments, setAssessments] =
    useState<Assessment[]>(initialAssessments);
  const [progress, setProgress] = useState(initialProgress);

  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Unit Modal
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [unitName, setUnitName] = useState("");
  const [unitOrder, setUnitOrder] = useState(units.length + 1);

  // Chapter Modal
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [chapterTargetUnitId, setChapterTargetUnitId] = useState("");
  const [chapterName, setChapterName] = useState("");
  const [chapterNcert, setChapterNcert] = useState("");
  const [chapterOrder, setChapterOrder] = useState(1);

  // Topic Modal
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [topicTargetChapterId, setTopicTargetChapterId] = useState("");
  const [topicName, setTopicName] = useState("");
  const [topicPeriods, setTopicPeriods] = useState(2);
  const [topicDesc, setTopicDesc] = useState("");
  const [topicOrder, setTopicOrder] = useState(1);

  // Lesson Plan Modal
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonChapterName, setLessonChapterName] = useState("");
  const [lessonTopicId, setLessonTopicId] = useState("");
  const [lessonObj, setLessonObj] = useState("");
  const [lessonPlannedDate, setLessonPlannedDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [lessonStatus, setLessonStatus] = useState<
    "PLANNED" | "IN_PROGRESS" | "COMPLETED"
  >("PLANNED");

  // Assignment Modal
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentDesc, setAssignmentDesc] = useState("");
  const [assignmentSectionId, setAssignmentSectionId] = useState(
    sections[0]?.id || "",
  );
  const [assignmentDueDate, setAssignmentDueDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  );
  const [assignmentMaxMarks, setAssignmentMaxMarks] = useState(20);

  // Assessment Modal
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [assessmentTitle, setAssessmentTitle] = useState("");
  const [assessmentType, setAssessmentType] = useState("UNIT_TEST");
  const [assessmentSectionId, setAssessmentSectionId] = useState(""); // empty = class-wide
  const [assessmentDate, setAssessmentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [assessmentMaxMarks, setAssessmentMaxMarks] = useState(50);

  // Section Teacher Allocation Modal
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [allocSectionId, setAllocSectionId] = useState(sections[0]?.id || "");
  const [allocTeacherId, setAllocTeacherId] = useState("");
  const [allocDate, setAllocDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  // Find assigned teacher for selected section
  const currentSectionTeacher = sectionTeachers.find(
    (st) => st.sectionId === selectedSectionId && st.isActive,
  );

  // Determine current active section name for UI display
  const activeSectionObj = sections.find((s) => s.id === selectedSectionId);

  // Filtered operational lists
  const filteredAssignments =
    selectedSectionId === "ALL"
      ? assignments
      : assignments.filter((a) => a.sectionId === selectedSectionId);

  const filteredAssessments =
    selectedSectionId === "ALL"
      ? assessments
      : assessments.filter(
          (a) => !a.sectionId || a.sectionId === selectedSectionId,
        );

  // Collect all active topics for topic selector in Lesson Plans
  const allActiveTopics = units.flatMap((u) =>
    u.chapters.flatMap((c) =>
      c.topics.map((t) => ({
        ...t,
        chapterName: c.name,
        unitName: u.name,
      })),
    ),
  );

  // Handlers for Syllabus CRUD
  const handleSaveUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitName.trim()) return;
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await saveSyllabusUnit({
          classSubjectId,
          name: unitName.trim(),
          sortOrder: unitOrder,
        });
        setShowUnitModal(false);
        setUnitName("");
        router.refresh();
      } catch (err: any) {
        setErrorMsg(err?.message || "Failed to save syllabus unit");
      }
    });
  };

  const handleArchiveUnit = (id: string) => {
    if (!confirm("Are you sure you want to archive this unit and all its contents?")) return;
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const res = await archiveSyllabusUnit(id);
        if (res.referenced && !res.success) {
          if (confirm(res.message)) {
            await archiveSyllabusUnit(id, true);
          }
        }
        router.refresh();
      } catch (err: any) {
        setErrorMsg(err?.message || "Failed to archive unit");
      }
    });
  };

  const handleSaveChapter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chapterName.trim() || !chapterTargetUnitId) return;
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await saveSyllabusChapter({
          unitId: chapterTargetUnitId,
          name: chapterName.trim(),
          ncertReference: chapterNcert.trim() || null,
          sortOrder: chapterOrder,
        });
        setShowChapterModal(false);
        setChapterName("");
        router.refresh();
      } catch (err: any) {
        setErrorMsg(err?.message || "Failed to save chapter");
      }
    });
  };

  const handleSaveTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicName.trim() || !topicTargetChapterId) return;
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await saveSyllabusTopic({
          chapterId: topicTargetChapterId,
          name: topicName.trim(),
          estimatedPeriods: topicPeriods,
          description: topicDesc.trim() || null,
          sortOrder: topicOrder,
        });
        setShowTopicModal(false);
        setTopicName("");
        router.refresh();
      } catch (err: any) {
        setErrorMsg(err?.message || "Failed to save topic");
      }
    });
  };

  const handleSaveLessonPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonTitle.trim() || !lessonChapterName.trim()) return;
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await saveLessonPlan({
          classSubjectId,
          title: lessonTitle.trim(),
          chapterName: lessonChapterName.trim(),
          syllabusTopicId: lessonTopicId || null,
          objectives: lessonObj.trim() || null,
          plannedDate: lessonPlannedDate || null,
          completedDate:
            lessonStatus === "COMPLETED"
              ? new Date().toISOString().slice(0, 10)
              : null,
          status: lessonStatus,
        });
        setShowLessonModal(false);
        setLessonTitle("");
        router.refresh();
      } catch (err: any) {
        setErrorMsg(err?.message || "Failed to save lesson plan");
      }
    });
  };

  const handleSaveAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentTitle.trim() || !assignmentSectionId) return;
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await saveAssignment({
          classSubjectId,
          sectionId: assignmentSectionId,
          title: assignmentTitle.trim(),
          description: assignmentDesc.trim(),
          maxMarks: assignmentMaxMarks,
          dueDate: assignmentDueDate || new Date().toISOString().slice(0, 10),
          status: "PUBLISHED",
        });
        setShowAssignmentModal(false);
        setAssignmentTitle("");
        router.refresh();
      } catch (err: any) {
        setErrorMsg(err?.message || "Failed to create assignment");
      }
    });
  };

  const handleSaveAssessment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessmentTitle.trim()) return;
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await saveAssessment({
          classSubjectId,
          sectionId: assessmentSectionId || null,
          title: assessmentTitle.trim(),
          assessmentType: assessmentType as any,
          date: assessmentDate || new Date().toISOString().slice(0, 10),
          maxMarks: assessmentMaxMarks,
          status: "SCHEDULED",
        });
        setShowAssessmentModal(false);
        setAssessmentTitle("");
        router.refresh();
      } catch (err: any) {
        setErrorMsg(err?.message || "Failed to create assessment");
      }
    });
  };

  const handleAllocateTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocSectionId || !allocTeacherId) return;
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await assignSectionTeacher({
          classSubjectId,
          sectionId: allocSectionId,
          teacherId: allocTeacherId,
          effectiveFrom: allocDate || new Date().toISOString().slice(0, 10),
        });
        setShowAllocateModal(false);
        router.refresh();
      } catch (err: any) {
        setErrorMsg(err?.message || "Failed to assign section teacher");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* ─── Breadcrumb & Top Context Header ──────────────────────────────── */}
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
            <Link
              href={`/academics/classes/${classId}`}
              className="hover:text-primary transition"
            >
              {className} Hub
            </Link>
            <span>/</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {subjectName} Workspace
            </span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white">
              {subjectName}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded font-mono bg-primary/10 text-primary font-bold">
              {subjectCode}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            <span>Class: <strong className="text-gray-700 dark:text-gray-300">{className}</strong></span>
            <span>·</span>
            <span>
              Subject Lead:{" "}
              <strong className="text-gray-700 dark:text-gray-300">
                {leadTeacherEmail || "Unassigned"}
              </strong>
            </span>
            {selectedSectionId !== "ALL" && currentSectionTeacher && (
              <>
                <span>·</span>
                <span className="text-primary font-semibold">
                  Section {activeSectionObj?.name} Teacher:{" "}
                  {currentSectionTeacher.teacher?.email}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Section Operational Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-slate-800 p-1.5 rounded-xl border border-gray-200 dark:border-slate-700">
            <span className="text-[11px] font-bold text-gray-500 pl-2">
              Scope:
            </span>
            <button
              onClick={() => setSelectedSectionId("ALL")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                selectedSectionId === "ALL"
                  ? "bg-white dark:bg-slate-900 text-primary shadow-xs"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              All Sections (Curriculum)
            </button>
            {sections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => setSelectedSectionId(sec.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  selectedSectionId === sec.id
                    ? "bg-white dark:bg-slate-900 text-primary shadow-xs"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Section {sec.name}
              </button>
            ))}
          </div>

          {isAdmin && (
            <button
              onClick={() => setShowAllocateModal(true)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 text-gray-700 dark:text-gray-200 flex items-center gap-1 shadow-xs"
            >
              <UserCheck className="w-3.5 h-3.5 text-blue-500" />
              Assign Teacher
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ─── Top Stats Banner ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] uppercase tracking-wider text-gray-400 font-bold block mb-1">
            Syllabus Progress
          </span>
          <div className="text-2xl font-black text-primary">
            {progress.percentage}%
          </div>
          <span className="text-[11px] text-gray-400">
            {progress.completedTopics}/{progress.totalTopics} unique topics
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] uppercase tracking-wider text-gray-400 font-bold block mb-1">
            Lesson Plans
          </span>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {lessonPlans.length}
          </div>
          <span className="text-[11px] text-gray-400">
            Curriculum master
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] uppercase tracking-wider text-gray-400 font-bold block mb-1">
            Assignments
          </span>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {filteredAssignments.length}
          </div>
          <span className="text-[11px] text-gray-400">
            {selectedSectionId === "ALL" ? "All sections" : `Section ${activeSectionObj?.name}`}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] uppercase tracking-wider text-gray-400 font-bold block mb-1">
            Assessments
          </span>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {filteredAssessments.length}
          </div>
          <span className="text-[11px] text-gray-400">
            Scheduled tests
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] uppercase tracking-wider text-gray-400 font-bold block mb-1">
            Syllabus Units
          </span>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {units.length}
          </div>
          <span className="text-[11px] text-gray-400">
            Active units
          </span>
        </div>
      </div>

      {/* ─── Workspace Navigation Tabs ───────────────────────────────────── */}
      <div className="border-b border-gray-200 dark:border-slate-800 overflow-x-auto">
        <nav className="flex space-x-6">
          {[
            { id: "overview", label: "Trajectory Overview", icon: Layers },
            { id: "syllabus", label: `Syllabus Tree (${units.length} Units)`, icon: BookOpen },
            { id: "lessons", label: `Lesson Plans (${lessonPlans.length})`, icon: ClipboardList },
            { id: "assignments", label: `Assignments (${filteredAssignments.length})`, icon: FileText },
            { id: "homework", label: "Homework", icon: CheckCircle2 },
            { id: "assessments", label: `Assessments (${filteredAssessments.length})`, icon: Award },
            { id: "progress", label: "Detailed Progress", icon: BarChart3 },
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
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">
              Academic Trajectory & Coverage
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Curriculum is class-wide for {className} {subjectName}. Daily operations (assignments, homework, tests) are section-targeted.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30">
                <span className="text-xs font-bold text-gray-900 dark:text-white block mb-1">
                  1. Curriculum Mastery
                </span>
                <p className="text-xs text-gray-500 mb-3">
                  {units.length} units with {progress.totalTopics} total syllabus topics defined.
                </p>
                <button
                  onClick={() => setActiveTab("syllabus")}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  Manage Syllabus Hierarchy →
                </button>
              </div>

              <div className="p-4 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30">
                <span className="text-xs font-bold text-gray-900 dark:text-white block mb-1">
                  2. Lesson Execution
                </span>
                <p className="text-xs text-gray-500 mb-3">
                  {lessonPlans.filter((l) => l.status === "COMPLETED").length} completed out of {lessonPlans.length} planned lessons.
                </p>
                <button
                  onClick={() => setActiveTab("lessons")}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  View Lesson Schedule →
                </button>
              </div>

              <div className="p-4 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30">
                <span className="text-xs font-bold text-gray-900 dark:text-white block mb-1">
                  3. Section Operations
                </span>
                <p className="text-xs text-gray-500 mb-3">
                  {assignments.length} assignments and {assessments.length} assessments scheduled across {sections.length} sections.
                </p>
                <button
                  onClick={() => setActiveTab("assignments")}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  Manage Assignments →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: SYLLABUS (Interactive Unit -> Chapter -> Topic Tree) ──── */}
      {activeTab === "syllabus" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Syllabus Hierarchy (Curriculum Master)
              </h3>
              <p className="text-xs text-gray-500">
                Units, Chapters, and Topics are shared across all sections of {className}.
              </p>
            </div>
            <button
              onClick={() => {
                setUnitName(`Unit ${units.length + 1}`);
                setUnitOrder(units.length + 1);
                setShowUnitModal(true);
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary text-white flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Unit
            </button>
          </div>

          <div className="space-y-4">
            {units.map((unit) => (
              <div
                key={unit.id}
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs"
              >
                {/* Unit Header */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                      U{unit.sortOrder}
                    </span>
                    <h4 className="font-bold text-base text-gray-900 dark:text-white">
                      {unit.name}
                    </h4>
                    {unit.term && (
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                        {unit.term.name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setChapterTargetUnitId(unit.id);
                        setChapterName("");
                        setChapterOrder((unit.chapters?.length || 0) + 1);
                        setShowChapterModal(true);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Chapter
                    </button>
                    <button
                      onClick={() => handleArchiveUnit(unit.id)}
                      className="p-1 text-gray-400 hover:text-red-500 rounded"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Chapters list under this unit */}
                <div className="divide-y divide-gray-100 dark:divide-slate-800/80 mt-2">
                  {unit.chapters?.map((ch) => (
                    <div key={ch.id} className="py-3 pl-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                            {ch.name}
                          </span>
                          {ch.ncertReference && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 font-mono text-gray-500">
                              NCERT: {ch.ncertReference}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setTopicTargetChapterId(ch.id);
                              setTopicName("");
                              setTopicOrder((ch.topics?.length || 0) + 1);
                              setShowTopicModal(true);
                            }}
                            className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-0.5"
                          >
                            <Plus className="w-3 h-3" /> Topic
                          </button>
                        </div>
                      </div>

                      {/* Topics under Chapter */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-2 pl-2">
                        {ch.topics?.map((topic) => (
                          <div
                            key={topic.id}
                            className="p-2.5 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 flex items-center justify-between"
                          >
                            <div className="min-w-0 pr-2">
                              <span className="text-xs font-semibold text-gray-900 dark:text-white block truncate">
                                {topic.name}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {topic.estimatedPeriods} period(s)
                              </span>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 shrink-0">
                              Active
                            </span>
                          </div>
                        ))}

                        {(!ch.topics || ch.topics.length === 0) && (
                          <div className="text-[11px] text-gray-400 italic">
                            No topics yet in this chapter.
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {(!unit.chapters || unit.chapters.length === 0) && (
                    <div className="text-xs text-gray-400 italic py-2">
                      No chapters defined for this unit.
                    </div>
                  )}
                </div>
              </div>
            ))}

            {units.length === 0 && (
              <div className="text-center py-12 bg-white dark:bg-slate-900 border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl text-gray-400 text-xs">
                No syllabus units defined for {subjectName} yet. Click "+ Add Unit" to begin curriculum setup.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: LESSON PLANS (Curriculum Scoped) ──────────────────────── */}
      {activeTab === "lessons" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Lesson Plans (Class Curriculum)
              </h3>
              <p className="text-xs text-gray-500">
                Master curriculum plans. Marking a lesson COMPLETED advances syllabus progress.
              </p>
            </div>
            <button
              onClick={() => {
                setLessonTitle("");
                setLessonChapterName(units[0]?.chapters[0]?.name || "");
                setLessonTopicId(units[0]?.chapters[0]?.topics[0]?.id || "");
                setShowLessonModal(true);
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary text-white flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Plan Lesson
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl divide-y divide-gray-100 dark:divide-slate-800 shadow-xs">
            {lessonPlans.map((lp) => (
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
                    {lp.objectives || "No specific objectives stated"}
                    {lp.plannedDate && ` · Planned for ${lp.plannedDate}`}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      lp.status === "COMPLETED"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                    }`}
                  >
                    {lp.status}
                  </span>
                </div>
              </div>
            ))}

            {lessonPlans.length === 0 && (
              <div className="py-12 text-center text-xs text-gray-400">
                No lesson plans recorded for {subjectName} yet. Click "+ Plan Lesson".
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 4: ASSIGNMENTS (Section-Specific) ─────────────────────────── */}
      {activeTab === "assignments" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Assignments (Section Operations)
              </h3>
              <p className="text-xs text-gray-500">
                Assignments are assigned and graded per section.
              </p>
            </div>
            <button
              onClick={() => {
                setAssignmentTitle("");
                setAssignmentDesc("");
                setShowAssignmentModal(true);
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary text-white flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Create Assignment
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl divide-y divide-gray-100 dark:divide-slate-800 shadow-xs">
            {filteredAssignments.map((a) => (
              <div key={a.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-gray-900 dark:text-white">
                      {a.title}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      Section {a.section?.name || "All"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Max Marks: {a.maxMarks} · Due: {new Date(a.dueDate).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300">
                  {a.status}
                </span>
              </div>
            ))}

            {filteredAssignments.length === 0 && (
              <div className="py-12 text-center text-xs text-gray-400">
                No assignments found for the current section selection.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 5: HOMEWORK ──────────────────────────────────────────────── */}
      {activeTab === "homework" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Daily Homework & Practice Tasks
              </h3>
              <p className="text-xs text-gray-500">
                Quick practice work assigned to sections.
              </p>
            </div>
            <button
              onClick={() => {
                setAssignmentTitle("Homework: ");
                setShowAssignmentModal(true);
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary text-white flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Assign Homework
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl divide-y divide-gray-100 dark:divide-slate-800 shadow-xs">
            {filteredAssignments
              .filter((a) => a.title.toLowerCase().includes("homework") || a.title.toLowerCase().includes("hw"))
              .map((hw) => (
                <div key={hw.id} className="p-4 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-gray-900 dark:text-white block mb-0.5">
                      {hw.title}
                    </span>
                    <span className="text-xs text-gray-500">
                      Due: {new Date(hw.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                    Section {hw.section?.name}
                  </span>
                </div>
              ))}

            {filteredAssignments.filter((a) => a.title.toLowerCase().includes("homework") || a.title.toLowerCase().includes("hw")).length === 0 && (
              <div className="py-8 text-center text-xs text-gray-400">
                No homework tasks tagged for this selection.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 6: ASSESSMENTS ───────────────────────────────────────────── */}
      {activeTab === "assessments" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Assessments & Periodic Tests
              </h3>
              <p className="text-xs text-gray-500">
                Section-specific or Class-wide formal evaluations.
              </p>
            </div>
            <button
              onClick={() => setShowAssessmentModal(true)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary text-white flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Create Assessment
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl divide-y divide-gray-100 dark:divide-slate-800 shadow-xs">
            {filteredAssessments.map((asm) => (
              <div key={asm.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-gray-900 dark:text-white">
                      {asm.title}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                      {asm.type}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-gray-100 dark:bg-slate-800 text-gray-600">
                      {asm.section ? `Section ${asm.section.name}` : "Class-Wide"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Max Marks: {asm.maxMarks} · Scheduled Date: {asm.date}
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300">
                  {asm.status}
                </span>
              </div>
            ))}

            {filteredAssessments.length === 0 && (
              <div className="py-12 text-center text-xs text-gray-400">
                No assessments scheduled yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 7: PROGRESS ─────────────────────────────────────────────── */}
      {activeTab === "progress" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">
              Unit-wise Syllabus Completion
            </h3>
            <div className="space-y-4 mt-4">
              {units.map((u) => {
                const totalInUnit = u.chapters.reduce(
                  (acc, c) => acc + c.topics.length,
                  0,
                );
                return (
                  <div key={u.id} className="p-4 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-gray-900 dark:text-white">
                        {u.name}
                      </span>
                      <span className="text-xs text-gray-500 font-medium">
                        {totalInUnit} Topics Defined
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${progress.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Add Unit ─────────────────────────────────────────────── */}
      {showUnitModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveUnit}
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Add Syllabus Unit
              </h3>
              <button
                type="button"
                onClick={() => setShowUnitModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Unit Title
              </label>
              <input
                type="text"
                required
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                placeholder="e.g. Unit 1: Number Systems"
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Sort Order
              </label>
              <input
                type="number"
                value={unitOrder}
                onChange={(e) => setUnitOrder(parseInt(e.target.value) || 1)}
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowUnitModal(false)}
                className="px-3 py-1.5 text-xs text-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-primary text-white disabled:opacity-50"
              >
                Save Unit
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── MODAL: Add Chapter ──────────────────────────────────────────── */}
      {showChapterModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveChapter}
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Add Chapter
              </h3>
              <button
                type="button"
                onClick={() => setShowChapterModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Chapter Name
              </label>
              <input
                type="text"
                required
                value={chapterName}
                onChange={(e) => setChapterName(e.target.value)}
                placeholder="e.g. Knowing Our Numbers"
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                NCERT / Curriculum Reference
              </label>
              <input
                type="text"
                value={chapterNcert}
                onChange={(e) => setChapterNcert(e.target.value)}
                placeholder="e.g. NCERT Chapter 1"
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowChapterModal(false)}
                className="px-3 py-1.5 text-xs text-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-primary text-white disabled:opacity-50"
              >
                Save Chapter
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── MODAL: Add Topic ────────────────────────────────────────────── */}
      {showTopicModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveTopic}
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Add Syllabus Topic
              </h3>
              <button
                type="button"
                onClick={() => setShowTopicModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Topic Name
              </label>
              <input
                type="text"
                required
                value={topicName}
                onChange={(e) => setTopicName(e.target.value)}
                placeholder="e.g. Place Value & Face Value"
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Estimated Periods
              </label>
              <input
                type="number"
                value={topicPeriods}
                onChange={(e) =>
                  setTopicPeriods(parseInt(e.target.value) || 1)
                }
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowTopicModal(false)}
                className="px-3 py-1.5 text-xs text-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-primary text-white disabled:opacity-50"
              >
                Save Topic
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── MODAL: Plan Lesson ──────────────────────────────────────────── */}
      {showLessonModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveLessonPlan}
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Plan Curriculum Lesson
              </h3>
              <button
                type="button"
                onClick={() => setShowLessonModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Lesson Title
              </label>
              <input
                type="text"
                required
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
                placeholder="e.g. Introduction to Number Systems"
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Link to Syllabus Topic
              </label>
              <select
                value={lessonTopicId}
                onChange={(e) => {
                  setLessonTopicId(e.target.value);
                  const found = allActiveTopics.find(
                    (t) => t.id === e.target.value,
                  );
                  if (found) {
                    setLessonChapterName(found.chapterName);
                  }
                }}
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              >
                <option value="">No linked topic</option>
                {allActiveTopics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.chapterName} → {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Chapter Name
              </label>
              <input
                type="text"
                required
                value={lessonChapterName}
                onChange={(e) => setLessonChapterName(e.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Planned Date
                </label>
                <input
                  type="date"
                  value={lessonPlannedDate}
                  onChange={(e) => setLessonPlannedDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Execution Status
                </label>
                <select
                  value={lessonStatus}
                  onChange={(e) => setLessonStatus(e.target.value as any)}
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                >
                  <option value="PLANNED">PLANNED</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="COMPLETED">COMPLETED (Advances Progress)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowLessonModal(false)}
                className="px-3 py-1.5 text-xs text-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-primary text-white disabled:opacity-50"
              >
                Save Lesson Plan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── MODAL: Create Assignment ────────────────────────────────────── */}
      {showAssignmentModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveAssignment}
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Create Assignment for {subjectName}
              </h3>
              <button
                type="button"
                onClick={() => setShowAssignmentModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Target Section
              </label>
              <select
                required
                value={assignmentSectionId}
                onChange={(e) => setAssignmentSectionId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              >
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    Section {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Assignment Title
              </label>
              <input
                type="text"
                required
                value={assignmentTitle}
                onChange={(e) => setAssignmentTitle(e.target.value)}
                placeholder="e.g. Exercise 1.2 Problems 1-10"
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  required
                  value={assignmentDueDate}
                  onChange={(e) => setAssignmentDueDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Max Marks
                </label>
                <input
                  type="number"
                  value={assignmentMaxMarks}
                  onChange={(e) =>
                    setAssignmentMaxMarks(parseInt(e.target.value) || 10)
                  }
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAssignmentModal(false)}
                className="px-3 py-1.5 text-xs text-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-primary text-white disabled:opacity-50"
              >
                Publish Assignment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── MODAL: Create Assessment ────────────────────────────────────── */}
      {showAssessmentModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveAssessment}
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Create Assessment
              </h3>
              <button
                type="button"
                onClick={() => setShowAssessmentModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Assessment Title
              </label>
              <input
                type="text"
                required
                value={assessmentTitle}
                onChange={(e) => setAssessmentTitle(e.target.value)}
                placeholder="e.g. Unit Test 1 — Mathematics"
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Assessment Type
                </label>
                <select
                  value={assessmentType}
                  onChange={(e) => setAssessmentType(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                >
                  <option value="UNIT_TEST">Unit Test</option>
                  <option value="MIDTERM">Midterm Exam</option>
                  <option value="FINAL">Final Exam</option>
                  <option value="QUIZ">Quiz</option>
                  <option value="PRACTICAL">Practical Test</option>
                  <option value="PROJECT">Project Work</option>
                  <option value="FA">Formative Assessment (FA)</option>
                  <option value="SA">Summative Assessment (SA)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Scope
                </label>
                <select
                  value={assessmentSectionId}
                  onChange={(e) => setAssessmentSectionId(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                >
                  <option value="">Class-Wide (All Sections)</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      Section {s.name} Only
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Scheduled Date
                </label>
                <input
                  type="date"
                  required
                  value={assessmentDate}
                  onChange={(e) => setAssessmentDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Max Marks
                </label>
                <input
                  type="number"
                  value={assessmentMaxMarks}
                  onChange={(e) =>
                    setAssessmentMaxMarks(parseInt(e.target.value) || 50)
                  }
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAssessmentModal(false)}
                className="px-3 py-1.5 text-xs text-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-primary text-white disabled:opacity-50"
              >
                Schedule Assessment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── MODAL: Assign Section Teacher ───────────────────────────────── */}
      {showAllocateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAllocateTeacher}
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Assign Section Teacher
              </h3>
              <button
                type="button"
                onClick={() => setShowAllocateModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Section
              </label>
              <select
                required
                value={allocSectionId}
                onChange={(e) => setAllocSectionId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              >
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    Section {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Teacher
              </label>
              <select
                required
                value={allocTeacherId}
                onChange={(e) => setAllocTeacherId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              >
                <option value="">Select teacher</option>
                {allTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Effective From Date
              </label>
              <input
                type="date"
                required
                value={allocDate}
                onChange={(e) => setAllocDate(e.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Previous teacher allocation will be automatically closed with this date.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAllocateModal(false)}
                className="px-3 py-1.5 text-xs text-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-primary text-white disabled:opacity-50"
              >
                Save Allocation
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
