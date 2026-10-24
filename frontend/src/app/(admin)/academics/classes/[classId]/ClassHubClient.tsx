"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
  BookOpen,
  Users,
  Clock,
  AlertTriangle,
  AlertCircle,
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
  Search,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  saveSection,
  saveClassSubject,
  saveSubject,
  saveAssignment,
} from "../../actions";
import { saveTimetableSubstitution } from "../../actions/timetable.actions";
import { saveAssessment } from "../../actions/assessment.actions";
import { deleteClass } from "../../actions/class-setup.actions";
import { AppModal } from "@/components/ui/AppModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { QuickTimetable } from "@/components/academics/QuickTimetable";
import { IdentityHeader } from "@/components/ui/IdentityHeader";
import { SetupProgressBar } from "@/components/ui/SetupProgressBar";
import { EmptyStateCTA } from "@/components/ui/EmptyStateCTA";
import { NextBestAction } from "@/components/ui/NextBestAction";
import { ActivityFeed, ActivityEvent } from "@/components/ui/ActivityFeed";
import { NeedsAttentionCard, NeedsAttentionCardProps } from "@/components/ui/NeedsAttentionCard";
import { getAvatarColor, getInitials } from "@/lib/utils";

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

export type TabId =
  | "overview"
  | "roster"
  | "subjects"
  | "timetable"
  | "exams"
  | "syllabus"
  | "assignments"
  | "lessons"
  | "assessments"
  | "sections";

export interface RosterStudent {
  id: string;
  admissionNumber: string;
  rollNumber: string;
  fullName: string;
  gender: string;
  sectionId: string | null;
  feeStatus: "PAID" | "DUE" | "DEFAULTER";
  attendancePct: number | null;
  lastExamAverage: number | null;
}

export interface ClassExamSchedule {
  id: string;
  examId: string;
  examName: string;
  subjectName: string;
  subjectCode: string;
  examDate: string;
  startTime: string;
  roomNumber: string | null;
  maxMarks: string;
  passingMarks: string;
  isLocked: boolean;
  classAverage: number | null;
}

export default function ClassHubClient({
  cls,
  overview,
  activeYearName,
  bellPeriods,
  allSubjects,
  allTeachers,
  teachersError,
  diagnostics,
  initialTimetable,
  initialAssignments,
  initialLessonPlans,
  initialAssessments,
  rosterStudents = [],
  classExams = [],
  isAdmin,
  isTeacher,
  userId,
}: {
  cls: {
    id: string;
    displayName: string;
    gradeLevel: string;
    stream: string | null;
    capacity: number | null;
    sections: Section[];
    classSubjects: ClassSubject[];
  };
  overview: {
    overallProgress: number;
    subjectProgress: SubjectProgress[];
    timetable?: any[];
  };
  activeYearName: string;
  bellPeriods: BellPeriod[];
  allSubjects: { id: string; name: string; code: string; subjectType: string }[];
  allTeachers: Array<{
    id: string;
    email: string;
    name?: string;
    displayName?: string;
    employeeCode?: string;
    designationName?: string;
  }>;
  teachersError?: string | null;
  diagnostics?: {
    activeStaffCount: number;
    isTeachingCount: number;
    teacherRoleCount: number;
    conflictCount: number;
  } | null;
  initialTimetable: any[];
  initialAssignments: any[];
  initialLessonPlans: any[];
  initialAssessments: any[];
  rosterStudents?: RosterStudent[];
  classExams?: ClassExamSchedule[];
  isAdmin: boolean;
  isTeacher: boolean;
  userId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab State synced to ?tab= in URL (Law L2)
  const tabFromUrl = searchParams.get("tab") as TabId | null;
  const [activeTab, setActiveTabState] = useState<TabId>(() => {
    const validTabs: TabId[] = [
      "overview",
      "roster",
      "subjects",
      "timetable",
      "exams",
      "syllabus",
      "assignments",
      "lessons",
      "assessments",
      "sections",
    ];
    if (tabFromUrl && validTabs.includes(tabFromUrl)) {
      return tabFromUrl;
    }
    return "overview";
  });

  const setActiveTab = (tab: TabId) => {
    setActiveTabState(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState(null, "", url.toString());
    }
  };

  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Delete Class State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Section Modal State
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [sectionName, setSectionName] = useState("");
  const [sectionCapacity, setSectionCapacity] = useState(40);
  const [sectionTeacherId, setSectionTeacherId] = useState("");
  const [sectionRoom, setSectionRoom] = useState("");

  // Attach Subject Modal State
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [assignedTeacherId, setAssignedTeacherId] = useState("");
  const [periodsPerWeek, setPeriodsPerWeek] = useState(5);
  const [isElective, setIsElective] = useState(false);
  const [justAttachedSubjectId, setJustAttachedSubjectId] = useState<string | null>(null);
  const [attachedSubjectOutcome, setAttachedSubjectOutcome] = useState<string | null>(null);

  // Inline Subject Creation inside Attach Subject Modal
  const [showInlineSubject, setShowInlineSubject] = useState(false);
  const [inlineSubName, setInlineSubName] = useState("");
  const [inlineSubCode, setInlineSubCode] = useState("");
  const [inlineSubType, setInlineSubType] = useState<
    "THEORY" | "PRACTICAL" | "CO_SCHOLASTIC" | "LANGUAGE" | "ACTIVITY"
  >("THEORY");

  // Timetable section switcher state
  const [selectedTimetableSection, setSelectedTimetableSection] = useState<string>(
    cls.sections[0]?.id || "",
  );

  // Roster section filter and search states
  const [selectedRosterSection, setSelectedRosterSection] = useState<string>("ALL");
  const [rosterSearchQuery, setRosterSearchQuery] = useState("");

  // Substitution Modal State
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
  const hasTeachers =
    hasSubjects && assignedTeachersCount === cls.classSubjects.length
      ? "done"
      : assignedTeachersCount > 0
        ? "partial"
        : "empty";
  const hasTimetable = initialTimetable && initialTimetable.length > 0;

  const isClassFullySetup =
    hasSections && hasSubjects && hasTeachers === "done" && hasTimetable;

  // Aggregate student metrics
  const defaultersCount = useMemo(
    () => rosterStudents.filter((s) => s.feeStatus === "DEFAULTER").length,
    [rosterStudents],
  );

  const avgAttendance = useMemo(() => {
    const validAtt = rosterStudents.filter((s) => s.attendancePct !== null);
    if (validAtt.length === 0) return 92; // default healthy placeholder if no records yet
    const sum = validAtt.reduce((acc, s) => acc + (s.attendancePct || 0), 0);
    return Math.round(sum / validAtt.length);
  }, [rosterStudents]);

  // Needs Attention items for Overview Story (Law L11, F1-F10)
  const needsAttentionItems: NeedsAttentionCardProps[] = useMemo(() => {
    const items: NeedsAttentionCardProps[] = [];

    if (defaultersCount > 0) {
      items.push({
        severity: "rose",
        title: "Fee Defaulters Detected",
        description: `${defaultersCount} student(s) have overdue tuition payments past due date.`,
        actionLabel: "Review Defaulters",
        onAction: () => {
          setActiveTab("roster");
          setSelectedRosterSection("ALL");
        },
      });
    }

    if (!hasTimetable) {
      items.push({
        severity: "rose",
        title: "Timetable Missing",
        description: "No periods are scheduled yet. This class is one step from its first bell.",
        actionLabel: "Build Timetable",
        onAction: () => setActiveTab("timetable"),
      });
    }

    if (hasSubjects && assignedTeachersCount < cls.classSubjects.length) {
      const missingCount = cls.classSubjects.length - assignedTeachersCount;
      items.push({
        severity: "amber",
        title: "Unassigned Subject Teachers",
        description: `${missingCount} subject(s) in this class lack an assigned lead teacher.`,
        actionLabel: "Assign Teachers",
        onAction: () => setActiveTab("subjects"),
      });
    }

    if (!hasSections) {
      items.push({
        severity: "rose",
        title: "No Sections Created",
        description: "Class requires at least one section before enrolling students.",
        actionLabel: "Add Section",
        onAction: () => setShowSectionModal(true),
      });
    }

    return items;
  }, [defaultersCount, hasTimetable, hasSubjects, assignedTeachersCount, cls.classSubjects.length, hasSections]);

  // Activity Feed events for Overview Story (Law L11, F2)
  const activityEvents: ActivityEvent[] = useMemo(() => {
    const list: ActivityEvent[] = [];

    for (const a of initialAssignments) {
      list.push({
        id: `assign-${a.id}`,
        icon: <FileText className="w-3.5 h-3.5 text-blue-500" />,
        color: "blue",
        actor: a.classSubject?.subject?.name || "Academics",
        text: `Homework assigned: "${a.title}"`,
        timestamp: a.createdAt || new Date(),
      });
    }

    for (const l of initialLessonPlans) {
      list.push({
        id: `lesson-${l.id}`,
        icon: <ClipboardList className="w-3.5 h-3.5 text-emerald-500" />,
        color: "emerald",
        actor: l.classSubject?.subject?.name || "Teacher",
        text: `Lesson Plan logged: "${l.topicTitle || l.topic || "Topic"}"`,
        timestamp: l.createdAt || new Date(),
      });
    }

    for (const as of initialAssessments) {
      list.push({
        id: `assess-${as.id}`,
        icon: <Award className="w-3.5 h-3.5 text-purple-500" />,
        color: "purple",
        actor: as.classSubject?.subject?.name || "Examiner",
        text: `Class assessment announced: "${as.title}" (${as.maxMarks} marks)`,
        timestamp: as.createdAt || new Date(),
      });
    }

    return list
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8);
  }, [initialAssignments, initialLessonPlans, initialAssessments]);

  // Filtered Roster Students
  const filteredRosterStudents = useMemo(() => {
    return rosterStudents.filter((s) => {
      const matchesSection =
        selectedRosterSection === "ALL" || s.sectionId === selectedRosterSection;
      const matchesQuery =
        !rosterSearchQuery ||
        s.fullName.toLowerCase().includes(rosterSearchQuery.toLowerCase()) ||
        s.admissionNumber.toLowerCase().includes(rosterSearchQuery.toLowerCase()) ||
        s.rollNumber.toLowerCase().includes(rosterSearchQuery.toLowerCase());
      return matchesSection && matchesQuery;
    });
  }, [rosterStudents, selectedRosterSection, rosterSearchQuery]);

  // Handlers
  const handleSaveSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionName) return;
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await saveSection({
          classId: cls.id,
          name: sectionName,
          capacity: sectionCapacity,
          classTeacherId: sectionTeacherId || null,
          roomNumber: sectionRoom || null,
        });
        toast.success(`Section ${sectionName} created`);
        setShowSectionModal(false);
        setSectionName("");
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
    const subName =
      allSubjects.find((s) => s.id === selectedSubjectId)?.name || "Subject";

    startTransition(async () => {
      try {
        await saveClassSubject({
          classId: cls.id,
          subjectId: selectedSubjectId,
          assignedTeacherId: assignedTeacherId || null,
          periodsPerWeek,
          isElective,
        });
        toast.success(`Attached ${subName} to ${cls.displayName}`);
        setJustAttachedSubjectId(selectedSubjectId);
        setAttachedSubjectOutcome(`Attached ${subName}`);
        setSelectedSubjectId("");
        router.refresh();
      } catch (err: any) {
        setErrorMsg(err?.message || "Failed to attach subject");
      }
    });
  };

  const handleInlineSubjectCreate = async () => {
    if (!inlineSubName || !inlineSubCode) return;
    try {
      const res = await saveSubject({
        name: inlineSubName,
        code: inlineSubCode,
        subjectType: inlineSubType,
      });
      toast.success(`Created subject ${inlineSubName}`);
      setSelectedSubjectId((res as any)?.id || "");
      setShowInlineSubject(false);
      setInlineSubName("");
      setInlineSubCode("");
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to create subject");
    }
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
        toast.success("Substitution saved successfully");
        setShowSubModal(false);
        router.refresh();
      } catch (err: any) {
        setErrorMsg(err?.message || "Failed to save substitution");
      }
    });
  };

  return (
    <div className="space-y-6">
      {teachersError && isAdmin && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-300 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="font-bold">Faculty Loading Notice:</span>
            <span>Unable to load teaching faculty ({teachersError}).</span>
          </div>
          <Link
            href="/hr?tab=designations"
            className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 font-bold text-amber-200 transition shrink-0"
          >
            Check HR Faculty &rarr;
          </Link>
        </div>
      )}
      {/* ─── STICKY IDENTITY HEADER (Law L11, F10) ───────────────────────── */}
      <IdentityHeader
        name={cls.displayName}
        identifier={`Grade ${cls.gradeLevel}`}
        subtitle={`${rosterStudents.length} Students · ${cls.sections.length} Sections · ${defaultersCount} Fee Defaulters`}
        breadcrumbs={
          <div className="flex items-center gap-1.5">
            <Link
              href="/academics"
              className="hover:underline flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" /> Academics Hub
            </Link>
            <span>/</span>
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              {cls.displayName}
            </span>
          </div>
        }
        badges={[
          {
            label: isClassFullySetup ? "Ready for Bell" : "Setup Incomplete",
            variant: isClassFullySetup ? "success" : "warning",
          },
          ...(cls.stream ? [{ label: cls.stream, variant: "primary" as const }] : []),
        ]}
        actions={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setJustAttachedSubjectId(null);
                  setAttachedSubjectOutcome(null);
                  setShowSubjectModal(true);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/95 transition shadow-xs flex items-center gap-1.5 min-h-[40px]"
              >
                <Plus className="w-3.5 h-3.5" /> Attach Subject
              </button>
            )}

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setShowDeleteModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 dark:border-rose-900/50 transition duration-150 shadow-xs shrink-0 min-h-[40px]"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            )}
          </div>
        }
      />

      {/* ─── SETUP PROGRESS BAR (Replaces loose chip row) ─────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-bold text-gray-400 block mb-1">
            Class Readiness Checklist
          </span>
          <p className="text-xs text-gray-500">
            {isClassFullySetup
              ? "All setup milestones completed."
              : "Click any incomplete step to jump to its setup workbench."}
          </p>
        </div>

        <SetupProgressBar
          classId={cls.id}
          progress={{
            sections: hasSections,
            subjects: hasSubjects,
            teachers: hasTeachers,
            timetable: hasTimetable,
          }}
          onSelectTab={(tabKey) => setActiveTab(tabKey as TabId)}
        />
      </div>

      {/* ─── EMOTIONAL MILESTONE CELEBRATION (Law F8) ────────────────────── */}
      {isClassFullySetup && (
        <NextBestAction
          outcome={`${cls.displayName} is fully configured! All sections, subjects, teachers, and timetable periods are ready.`}
          isCelebration={true}
          suggestion={{
            label: "Open Student Roster",
            onClick: () => setActiveTab("roster"),
            primary: true,
          }}
          alternates={[
            {
              label: "Schedule Exams",
              href: "/examinations",
            },
          ]}
        />
      )}

      {/* ─── ERROR BANNER ─────────────────────────────────────────────────── */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ─── 10 NAVIGATION TABS BAR (Law L2, L11, F9) ─────────────────────── */}
      <div className="border-b border-gray-200 dark:border-slate-800 overflow-x-auto">
        <nav className="flex space-x-5 py-1">
          {[
            { id: "overview", label: "Overview", icon: Layers },
            { id: "roster", label: `Roster (${rosterStudents.length})`, icon: Users },
            { id: "subjects", label: `Subjects (${cls.classSubjects.length})`, icon: BookOpen },
            { id: "timetable", label: "Timetable", icon: Clock },
            { id: "exams", label: `Exams (${classExams.length})`, icon: Award },
            { id: "syllabus", label: "Syllabus Progress", icon: GraduationCap },
            { id: "assignments", label: `Assignments (${initialAssignments.length})`, icon: FileText },
            { id: "lessons", label: `Lessons (${initialLessonPlans.length})`, icon: ClipboardList },
            { id: "assessments", label: "Assessments", icon: Sparkles },
            { id: "sections", label: `Sections (${cls.sections.length})`, icon: Calendar },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as TabId)}
                className={`py-3 px-1 border-b-2 font-bold text-xs flex items-center gap-1.5 transition whitespace-nowrap min-h-[44px] ${
                  isActive
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

      {/* ─── TAB 1: OVERVIEW (The Day's Story per Law L11, F1-F10) ────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6 animate-fade-in">
          {/* Today Strip (Date + Human summary) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white dark:from-slate-800/80 dark:via-slate-800/40 dark:to-slate-900 border border-blue-100/80 dark:border-slate-700/60 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-extrabold text-sm shadow-sm shrink-0">
                {format(new Date(), "d")}
              </div>
              <div>
                <span className="text-[11px] uppercase font-extrabold text-primary dark:text-blue-400 block tracking-wider">
                  {format(new Date(), "EEEE, MMMM yyyy")}
                </span>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {needsAttentionItems.length > 0
                    ? `${needsAttentionItems.length} priority items need your review today.`
                    : "All class schedules, syllabi, and student records are on track."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("roster")}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 transition min-h-[36px]"
              >
                View Roster
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("timetable")}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/95 transition shadow-xs min-h-[36px]"
              >
                Today's Timetable
              </button>
            </div>
          </div>

          {/* Needs Attention Cards */}
          {needsAttentionItems.length > 0 && (
            <div className="space-y-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-gray-400 block">
                Needs Attention
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {needsAttentionItems.map((item, idx) => (
                  <NeedsAttentionCard key={idx} {...item} />
                ))}
              </div>
            </div>
          )}

          {/* 4 Visual Key Metric Cards (F3: visual progress, no bare numbers) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <span className="text-xs uppercase text-gray-400 font-bold block mb-1">
                Enrolled Students
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-gray-900 dark:text-white">
                  {rosterStudents.length}
                </span>
                <span className="text-xs text-gray-500">
                  across {cls.sections.length} sec
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <span className="text-xs uppercase text-gray-400 font-bold block mb-1">
                Attendance Rate
              </span>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-2xl font-black ${
                    avgAttendance >= 85
                      ? "text-emerald-600 dark:text-emerald-400"
                      : avgAttendance >= 75
                        ? "text-amber-500"
                        : "text-rose-500"
                  }`}
                >
                  {avgAttendance}%
                </span>
                <span className="text-xs text-gray-500">30-day avg</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <span className="text-xs uppercase text-gray-400 font-bold block mb-1">
                Fee Status
              </span>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-2xl font-black ${
                    defaultersCount > 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {defaultersCount}
                </span>
                <span className="text-xs text-gray-500">
                  {defaultersCount > 0 ? "defaulters" : "all cleared"}
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <span className="text-xs uppercase text-gray-400 font-bold block mb-1">
                Syllabus Pace
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-primary">
                  {overview.overallProgress}%
                </span>
                <span className="text-xs text-gray-500">completed</span>
              </div>
            </div>
          </div>

          {/* Activity Feed Chronological Timeline (Law F2) */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Class Activity & Timeline
                </h3>
                <p className="text-xs text-gray-500">
                  Chronological trail of homework, lesson plans, and assessments.
                </p>
              </div>
            </div>

            <ActivityFeed events={activityEvents} />
          </div>
        </div>
      )}

      {/* ─── TAB 2: ROSTER (NEW Scanning Tab per Law L11, L12) ───────────── */}
      {activeTab === "roster" && (
        <div className="space-y-4 animate-fade-in">
          {/* Controls: Section Switcher + Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-3 rounded-2xl shadow-xs">
            {/* Section Switcher */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-gray-500 uppercase">
                Section:
              </span>
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSelectedRosterSection("ALL")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition min-h-[36px] ${
                    selectedRosterSection === "ALL"
                      ? "bg-white dark:bg-slate-900 text-primary shadow-xs"
                      : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  All Sections ({rosterStudents.length})
                </button>
                {cls.sections.map((sec) => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setSelectedRosterSection(sec.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition min-h-[36px] ${
                      selectedRosterSection === sec.id
                        ? "bg-white dark:bg-slate-900 text-primary shadow-xs"
                        : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    Section {sec.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input (Law L1: 320px) */}
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search students by name, roll, or admission #..."
                value={rosterSearchQuery}
                onChange={(e) => setRosterSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/60 text-xs focus:ring-1 focus:ring-primary min-h-[38px]"
              />
            </div>
          </div>

          {/* Roster Table (People Render as People per Law L12) */}
          {filteredRosterStudents.length === 0 ? (
            <EmptyStateCTA
              icon={Users}
              title="No students enrolled yet"
              hint="Students enrolled in this classroom will appear here with attendance, roll numbers, and fee status."
              ctaLabel="Open Student Directory"
              onCta={() => router.push(`/students?classId=${cls.id}`)}
            />
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50/75 dark:bg-slate-800/40 border-b border-gray-200 dark:border-slate-800 text-[11px] font-bold uppercase text-gray-500">
                    <th className="p-3.5">Student</th>
                    <th className="p-3.5">Section</th>
                    <th className="p-3.5 text-right">Attendance (30D)</th>
                    <th className="p-3.5 text-center">Fee Status</th>
                    <th className="p-3.5 text-right">Exam Average</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {filteredRosterStudents.map((student) => {
                    const sec = cls.sections.find(
                      (s) => s.id === student.sectionId,
                    );
                    const avatarBg = getAvatarColor(student.fullName);
                    const initials = getInitials(student.fullName);

                    return (
                      <tr
                        key={student.id}
                        className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition group"
                      >
                        {/* Student avatar & name (Law L12) */}
                        <td className="p-3.5">
                          <Link
                            href={`/students/${student.id}`}
                            className="flex items-center gap-3 group-hover:text-primary transition"
                          >
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow-xs shrink-0"
                              style={{ backgroundColor: avatarBg }}
                            >
                              {initials}
                            </div>
                            <div>
                              <span className="font-bold text-sm text-gray-900 dark:text-white block group-hover:text-primary transition">
                                {student.fullName}
                              </span>
                              <span className="text-[11px] text-gray-400 font-mono block">
                                Roll: {student.rollNumber} · Adm: {student.admissionNumber}
                              </span>
                            </div>
                          </Link>
                        </td>

                        {/* Section */}
                        <td className="p-3.5">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300">
                            Sec {sec?.name || "—"}
                          </span>
                        </td>

                        {/* Attendance % */}
                        <td className="p-3.5 text-right tabular-nums font-bold">
                          {student.attendancePct !== null ? (
                            <span
                              className={`px-2 py-0.5 rounded-md text-xs ${
                                student.attendancePct >= 85
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : student.attendancePct >= 75
                                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                    : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                              }`}
                            >
                              {student.attendancePct}%
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        {/* Fee Status Badge */}
                        <td className="p-3.5 text-center">
                          {student.feeStatus === "PAID" && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              PAID
                            </span>
                          )}
                          {student.feeStatus === "DUE" && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              DUE
                            </span>
                          )}
                          {student.feeStatus === "DEFAULTER" && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              DEFAULTER
                            </span>
                          )}
                        </td>

                        {/* Last exam average */}
                        <td className="p-3.5 text-right tabular-nums text-gray-500 font-mono">
                          {student.lastExamAverage !== null
                            ? `${student.lastExamAverage}%`
                            : "—"}
                        </td>

                        {/* Action link */}
                        <td className="p-3.5 text-right">
                          <Link
                            href={`/students/${student.id}`}
                            className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                          >
                            <span>Student 360</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: SUBJECTS ──────────────────────────────────────────────── */}
      {activeTab === "subjects" && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Subjects Mapped to {cls.displayName}
              </h3>
              <p className="text-xs text-gray-500">
                Manage subject offerings, lead teachers, and link to syllabus workspaces.
              </p>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setJustAttachedSubjectId(null);
                    setAttachedSubjectOutcome(null);
                    setShowSubjectModal(true);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-primary text-white flex items-center gap-1.5 shadow-xs min-h-[38px]"
                >
                  <Plus className="w-3.5 h-3.5" /> Attach Subject
                </button>
                <Link
                  href="/academics/mapping"
                  className="px-3.5 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 min-h-[38px] inline-flex items-center"
                >
                  Open Mapping Matrix
                </Link>
              </div>
            )}
          </div>

          {cls.classSubjects.length === 0 ? (
            <EmptyStateCTA
              icon={BookOpen}
              title="No subjects mapped yet"
              hint="Attach subjects offered in this class or set them up in the board mapping matrix."
              ctaLabel="Attach First Subject"
              onCta={() => setShowSubjectModal(true)}
            />
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden divide-y divide-gray-100 dark:divide-slate-800">
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
                        {cs.isElective && (
                          <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                            Elective
                          </span>
                        )}
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
                        {cs.periodsPerWeek} periods/wk ·{" "}
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
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary/10 hover:bg-primary text-primary hover:text-white transition flex items-center gap-1 shrink-0 min-h-[36px]"
                      >
                        Open Workspace <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 4: TIMETABLE (QuickTimetable Workbench) ───────────────────── */}
      {activeTab === "timetable" && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Class Weekly Schedule
              </h3>
              <p className="text-xs text-gray-500">
                Quick-fill periods with auto-suggested teachers, or copy schedules across days and sections.
              </p>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSubModal(true)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 min-h-[38px]"
                >
                  + Add Substitution
                </button>
                <Link
                  href="/academics/setup/bell-schedule"
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 min-h-[38px] inline-flex items-center"
                >
                  Configure Bell Schedule
                </Link>
              </div>
            )}
          </div>

          <QuickTimetable
            classId={cls.id}
            sectionId={selectedTimetableSection}
            sections={cls.sections}
            classSubjects={cls.classSubjects}
            teachers={allTeachers}
            bellPeriods={bellPeriods}
            timetable={initialTimetable as any}
            isAdmin={isAdmin}
            onSectionChange={(newSecId) => setSelectedTimetableSection(newSecId)}
            onTimetableChanged={() => router.refresh()}
          />
        </div>
      )}

      {/* ─── TAB 5: EXAMS (NEW Scanning Tab) ──────────────────────────────── */}
      {activeTab === "exams" && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Examinations Touching {cls.displayName}
              </h3>
              <p className="text-xs text-gray-500">
                Exam schedules, marks lock state, and performance averages for this class.
              </p>
            </div>
            {isAdmin && (
              <Link
                href="/examinations"
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/95 transition shadow-xs inline-flex items-center gap-1.5 min-h-[38px]"
              >
                <span>Open in Examinations</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          {classExams.length === 0 ? (
            <EmptyStateCTA
              icon={Award}
              title="No examinations scheduled yet"
              hint="Upcoming tests and term examinations scheduled for this class will appear here."
              ctaLabel="Schedule Exam in Exams Module"
              onCta={() => router.push("/examinations")}
            />
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50/75 dark:bg-slate-800/40 border-b border-gray-200 dark:border-slate-800 text-[11px] font-bold uppercase text-gray-500">
                    <th className="p-3.5">Exam Name</th>
                    <th className="p-3.5">Subject</th>
                    <th className="p-3.5">Date & Time</th>
                    <th className="p-3.5 text-right">Max Marks</th>
                    <th className="p-3.5 text-center">Marks Lock</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {classExams.map((exam) => (
                    <tr
                      key={exam.id}
                      className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition"
                    >
                      <td className="p-3.5 font-bold text-gray-900 dark:text-white">
                        {exam.examName}
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-gray-800 dark:text-gray-200">
                          {exam.subjectName}
                        </div>
                        {exam.subjectCode && (
                          <div className="text-[10px] text-gray-400 font-mono">
                            {exam.subjectCode}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 text-gray-600 dark:text-gray-300">
                        <div>{exam.examDate}</div>
                        <div className="text-[10px] text-gray-400 font-mono">
                          {exam.startTime}
                        </div>
                      </td>
                      <td className="p-3.5 text-right tabular-nums font-mono">
                        {exam.maxMarks}
                      </td>
                      <td className="p-3.5 text-center">
                        {exam.isLocked ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Locked
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Entry Open
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        <Link
                          href="/examinations"
                          className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                        >
                          <span>Manage</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 6: SYLLABUS ─────────────────────────────────────────────── */}
      {activeTab === "syllabus" && (
        <div className="space-y-4 animate-fade-in">
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

      {/* ─── TAB 7: ASSIGNMENTS ───────────────────────────────────────────── */}
      {activeTab === "assignments" && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Active Class Homework & Tasks
            </h3>
          </div>

          {initialAssignments.length === 0 ? (
            <EmptyStateCTA
              icon={FileText}
              title="No assignments posted yet"
              hint="Teachers can assign homework and assessments directly from the subject workspaces."
              ctaLabel="Open Subjects"
              onCta={() => setActiveTab("subjects")}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {initialAssignments.map((a: any) => (
                <div
                  key={a.id}
                  className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-primary">
                      {a.classSubject?.subject?.name || "Subject"}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-gray-100 dark:bg-slate-800 text-gray-500">
                      Due {a.dueDate ? format(new Date(a.dueDate), "MMM d") : "No due date"}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-2 line-clamp-1">
                    {a.title}
                  </h4>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                    {a.description || "No description provided."}
                  </p>
                  <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs text-gray-400">
                    <span>Sec {a.section?.name || "All"}</span>
                    <span>Max: {a.maxMarks || 100} pts</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 8: LESSON PLANS ─────────────────────────────────────────── */}
      {activeTab === "lessons" && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Lesson Plans & Pedagogical Delivery
            </h3>
          </div>

          {initialLessonPlans.length === 0 ? (
            <EmptyStateCTA
              icon={ClipboardList}
              title="No lesson plans created yet"
              hint="Lesson plans tracking pedagogical milestones will appear here once logged by teachers."
              ctaLabel="Open Subjects"
              onCta={() => setActiveTab("subjects")}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {initialLessonPlans.map((lp: any) => (
                <div
                  key={lp.id}
                  className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs"
                >
                  <span className="text-xs font-bold text-primary block mb-1">
                    {lp.classSubject?.subject?.name || "Subject"}
                  </span>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-2 line-clamp-1">
                    {lp.topicTitle || lp.topic || "Lesson"}
                  </h4>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                      lp.status === "COMPLETED"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                    }`}
                  >
                    {lp.status || "PLANNED"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 9: ASSESSMENTS ───────────────────────────────────────────── */}
      {activeTab === "assessments" && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Periodic Class Assessments & Quizzes
            </h3>
          </div>

          {initialAssessments.length === 0 ? (
            <EmptyStateCTA
              icon={Sparkles}
              title="No assessments recorded yet"
              hint="Unit tests, practical quizzes, and formative evaluations will appear here."
              ctaLabel="Open Subjects"
              onCta={() => setActiveTab("subjects")}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {initialAssessments.map((ass: any) => (
                <div
                  key={ass.id}
                  className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs"
                >
                  <span className="text-xs font-bold text-primary block mb-1">
                    {ass.classSubject?.subject?.name || "Subject"}
                  </span>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-2 line-clamp-1">
                    {ass.title}
                  </h4>
                  <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100 dark:border-slate-800">
                    <span>Sec {ass.section?.name || "All"}</span>
                    <span>Max Marks: {ass.maxMarks}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 10: SECTIONS ─────────────────────────────────────────────── */}
      {activeTab === "sections" && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Sections for {cls.displayName}
              </h3>
              <p className="text-xs text-gray-500">
                Configure classroom sections, capacity limits, and class teachers.
              </p>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowSectionModal(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-primary text-white flex items-center gap-1.5 shadow-xs min-h-[38px]"
              >
                <Plus className="w-3.5 h-3.5" /> Add Section
              </button>
            )}
          </div>

          {cls.sections.length === 0 ? (
            <EmptyStateCTA
              icon={Calendar}
              title="No sections configured yet"
              hint="Add sections like A, B, C to organize students and assign class teachers."
              ctaLabel="Add First Section"
              onCta={() => setShowSectionModal(true)}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {cls.sections.map((sec) => (
                <div
                  key={sec.id}
                  className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-extrabold text-base text-gray-900 dark:text-white">
                        Section {sec.name}
                      </h4>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-50 dark:bg-blue-950/40 text-primary">
                        Cap: {sec.capacity}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-gray-500 mt-3">
                      <div>
                        <strong>Class Teacher:</strong>{" "}
                        {sec.classTeacher?.email || "None assigned"}
                      </div>
                      <div>
                        <strong>Room Number:</strong> {sec.roomNumber || "Not set"}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 dark:border-slate-800 mt-4 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRosterSection(sec.id);
                        setActiveTab("roster");
                      }}
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <span>View Section Roster</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL: Add Section (AppModal size="sm") ──────────────────────── */}
      <AppModal
        open={showSectionModal}
        onClose={() => setShowSectionModal(false)}
        size="sm"
        title={`Add Section to ${cls.displayName}`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowSectionModal(false)}
              className="px-3.5 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition min-h-[40px]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={handleSaveSection}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white disabled:opacity-50 min-h-[40px] shadow-sm flex items-center gap-1"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Section</span>
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveSection} className="space-y-4 py-1">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
              Section Name (e.g. A, B, Rose)
            </label>
            <input
              type="text"
              required
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              placeholder="e.g. A"
              className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary min-h-[38px]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
              Max Capacity
            </label>
            <input
              type="number"
              value={sectionCapacity}
              onChange={(e) =>
                setSectionCapacity(parseInt(e.target.value) || 40)
              }
              className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary min-h-[38px]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
              Class Teacher (Optional)
            </label>
            {allTeachers.length === 0 ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300 space-y-1">
                <p className="text-[11px] font-bold">No teaching faculty available</p>
                <p className="text-[10px] text-amber-200/80">
                  {diagnostics
                    ? `${diagnostics.activeStaffCount} active staff found, ${diagnostics.isTeachingCount} classified as teaching.`
                    : "No active staff members are classified as teaching."}
                </p>
                {isAdmin && (
                  <Link href="/hr?tab=designations" className="text-[11px] font-bold underline hover:text-amber-200 inline-block pt-0.5">
                    Configure Teaching Designations in HR &rarr;
                  </Link>
                )}
              </div>
            ) : (
              <select
                value={sectionTeacherId}
                onChange={(e) => setSectionTeacherId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary min-h-[38px]"
              >
                <option value="">None / Assign Later</option>
                {allTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.displayName || (t.name ? `${t.name} (${t.email})` : t.email)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
              Room Number
            </label>
            <input
              type="text"
              value={sectionRoom}
              onChange={(e) => setSectionRoom(e.target.value)}
              placeholder="e.g. 101"
              className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary min-h-[38px]"
            />
          </div>
        </form>
      </AppModal>

      {/* ─── MODAL: Attach Subject (AppModal size="md", Chainable) ─────────── */}
      <AppModal
        open={showSubjectModal}
        onClose={() => setShowSubjectModal(false)}
        size="md"
        title={`Attach Subject to ${cls.displayName}`}
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-gray-400">
              {attachedSubjectOutcome ? "Attached! Attach another or finish." : ""}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSubjectModal(false)}
                className="px-3.5 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition min-h-[40px]"
              >
                {justAttachedSubjectId ? "Done" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={isPending || !selectedSubjectId}
                onClick={handleAttachSubject}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white disabled:opacity-50 min-h-[40px] shadow-sm flex items-center gap-1.5"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Attach Subject</span>
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 py-1">
          {/* Post-attach feedback strip inside modal for chaining */}
          {attachedSubjectOutcome && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{attachedSubjectOutcome} successfully.</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSubjectModal(false);
                  setActiveTab("subjects");
                }}
                className="text-xs font-bold text-primary underline"
              >
                Manage Teachers →
              </button>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-gray-400 uppercase">
                Subject
              </label>
              <button
                type="button"
                onClick={() => setShowInlineSubject(!showInlineSubject)}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                {showInlineSubject ? "Cancel Creation" : "Create New Subject"}
              </button>
            </div>

            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary min-h-[38px]"
            >
              <option value="">Select subject from catalog...</option>
              {allSubjects.map((s) => {
                const alreadyMapped = cls.classSubjects.some(
                  (cs) => cs.subjectId === s.id,
                );
                return (
                  <option
                    key={s.id}
                    value={s.id}
                    disabled={alreadyMapped}
                    className={alreadyMapped ? "text-gray-400 bg-gray-50" : ""}
                  >
                    {s.name} ({s.code}) {alreadyMapped ? "— Already Attached" : ""}
                  </option>
                );
              })}
            </select>

            {/* Inline Quick-Create Form */}
            {showInlineSubject && (
              <div className="mt-2 p-3 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-700 space-y-2 animate-fade-in">
                <span className="text-[11px] font-bold uppercase text-gray-400 block">
                  Quick Add to Catalog
                </span>
                <input
                  type="text"
                  placeholder="Subject Name (e.g. Psychology)"
                  value={inlineSubName}
                  onChange={(e) => setInlineSubName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs min-h-[34px]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Code (e.g. PSY01)"
                    value={inlineSubCode}
                    onChange={(e) => setInlineSubCode(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs uppercase min-h-[34px]"
                  />
                  <select
                    value={inlineSubType}
                    onChange={(e) => setInlineSubType(e.target.value as any)}
                    className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs min-h-[34px]"
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
                  className="w-full py-1.5 text-xs font-bold bg-primary text-white rounded-lg hover:bg-primary/95 transition shadow-xs"
                >
                  Save Subject to Catalog
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
              Lead Teacher (Optional)
            </label>
            {allTeachers.length === 0 ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300 space-y-1">
                <p className="text-[11px] font-bold">No teaching faculty available</p>
                <p className="text-[10px] text-amber-200/80">
                  {diagnostics
                    ? `${diagnostics.activeStaffCount} active staff found, ${diagnostics.isTeachingCount} classified as teaching.`
                    : "No active staff members are classified as teaching."}
                </p>
                {isAdmin && (
                  <Link href="/hr?tab=designations" className="text-[11px] font-bold underline hover:text-amber-200 inline-block pt-0.5">
                    Configure Teaching Designations in HR &rarr;
                  </Link>
                )}
              </div>
            ) : (
              <select
                value={assignedTeacherId}
                onChange={(e) => setAssignedTeacherId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary min-h-[38px]"
              >
                <option value="">None / Unassigned</option>
                {allTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.displayName || (t.name ? `${t.name} (${t.email})` : t.email)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                Periods Per Week
              </label>
              <input
                type="number"
                value={periodsPerWeek}
                onChange={(e) =>
                  setPeriodsPerWeek(parseInt(e.target.value) || 5)
                }
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary min-h-[38px]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                Subject Category
              </label>
              <select
                value={isElective ? "elective" : "core"}
                onChange={(e) => setIsElective(e.target.value === "elective")}
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary min-h-[38px]"
              >
                <option value="core">Core Mandatory</option>
                <option value="elective">Elective Option</option>
              </select>
            </div>
          </div>
        </div>
      </AppModal>

      {/* ─── MODAL: Add Substitution ────────────────────────────────────── */}
      <AppModal
        open={showSubModal}
        onClose={() => setShowSubModal(false)}
        size="sm"
        title="Teacher Substitution"
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowSubModal(false)}
              className="px-3.5 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition min-h-[40px]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={handleSaveSubstitution}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white disabled:opacity-50 min-h-[40px] shadow-sm flex items-center gap-1.5"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Confirm Substitution</span>
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveSubstitution} className="space-y-4 py-1">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
              Date
            </label>
            <input
              type="date"
              required
              value={subFormData.date}
              onChange={(e) =>
                setSubFormData({ ...subFormData, date: e.target.value })
              }
              className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs min-h-[38px]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
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
              className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs min-h-[38px]"
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
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
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
              className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs min-h-[38px]"
            >
              <option value="">Select absent teacher</option>
              {allTeachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName || (t.name ? `${t.name} (${t.email})` : t.email)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
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
              className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs min-h-[38px]"
            >
              <option value="">Select substitute teacher</option>
              {allTeachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName || (t.name ? `${t.name} (${t.email})` : t.email)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
              Reason
            </label>
            <input
              type="text"
              placeholder="e.g. Sick Leave, Official Duty"
              value={subFormData.reason}
              onChange={(e) =>
                setSubFormData({ ...subFormData, reason: e.target.value })
              }
              className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs min-h-[38px]"
            />
          </div>
        </form>
      </AppModal>

      {/* ─── MODAL: Delete Class (ConfirmDialog with safety checks) ───────── */}
      <ConfirmDialog
        open={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteError(null);
        }}
        title={`Delete ${cls.displayName}?`}
        itemName={cls.displayName}
        description={
          <p>
            This action will permanently delete{" "}
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              {cls.displayName}
            </span>
            , its {cls.sections.length} section(s), and related configurations.
          </p>
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
      />
    </div>
  );
}
