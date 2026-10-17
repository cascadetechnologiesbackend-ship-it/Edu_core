"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GraduationCap,
  Calendar,
  AlertTriangle,
  FileText,
  BookOpen,
  DollarSign,
  Award,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Users,
  Search,
} from "lucide-react";
import {
  PromoteStudentModal,
  ClassOption,
  YearOption,
} from "./class-history/PromoteStudentModal";
import { generateInvoicesForStudent } from "./fees/actions";
import { IdentityHeader } from "@/components/ui/IdentityHeader";
import { ActivityFeed, ActivityEvent } from "@/components/ui/ActivityFeed";
import { NeedsAttentionCard } from "@/components/ui/NeedsAttentionCard";
import { EmptyStateCTA } from "@/components/ui/EmptyStateCTA";

function formatDisplayDate(val: string | Date | null | undefined): string {
  if (!val) return "N/A";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return "N/A";
    const day = String(d.getUTCDate()).padStart(2, "0");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return "N/A";
  }
}

export interface ExamMarkItem {
  id: string;
  examName: string;
  subjectName: string;
  subjectCode: string;
  componentName: string | null;
  marksObtained: number | null;
  maxMarks: number;
  percentage: number | null;
  grade: string | null;
  isAbsent: boolean;
  isMedicalExempt: boolean;
  remarks: string | null;
  enteredAt: string;
}

export interface ReportCardItem {
  id: string;
  setupName: string;
  version: number;
  frozenAt: string;
  publishedAt: string | null;
  rank: number | string | null;
  percentage: number | string | null;
  totalMarks: number | string | null;
  maxMarks: number | string | null;
  grade: string | null;
}

export interface HomeworkItem {
  id: string;
  assignmentTitle: string;
  subjectName: string;
  subjectCode: string;
  dueDate: string | null;
  submittedAt: string;
  isLate: boolean;
  marksAwarded: number | null;
  maxMarks: number | null;
  plagiarismFlagged: boolean;
  remarks: string | null;
}

export interface Student360Data {
  id: string;
  admissionNumber: string;
  fullName: string;
  dateOfBirth: string | null;
  gender: string;
  category: string;
  bloodGroup: string | null;
  aadhaarLast4: string | null;
  apaarId: string | null;
  photoUrl: string | null;
  isActive: boolean;
  admissionDate: string;
  leavingDate: string | null;
  leavingReason: string | null;
  // Placement
  classId: string | null;
  className: string;
  sectionName: string;
  academicYearLabel: string;
  classTeacherName: string | null;
  // Family
  familyMembers: Array<{
    id: string;
    relation: string;
    name: string;
    mobile: string | null;
    email: string | null;
    isPrimaryContact: boolean;
    isEmergencyContact: boolean;
    hasConsentAuthority: boolean;
  }>;
  // Academics
  subjects: Array<{
    id: string;
    name: string;
    code: string;
    teacherName: string;
  }>;
  // Attendance
  attendanceSummary: {
    total: number;
    present: number;
    absent: number;
    late: number;
    percentage: number;
  };
  attendanceLogs: Array<{
    id: string;
    date: string;
    status: string;
    remarks: string | null;
  }>;
  // Fees
  canViewFees: boolean;
  canMutateFees: boolean;
  feeStructures: Array<{
    id: string;
    name: string;
    term: string;
    amount: string;
    dueDate: string;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    feeTypeName?: string;
    netAmount: string;
    paidAmount: string;
    balanceAmount: string;
    status: string;
    dueDate: string;
    term: string;
  }>;
  concessions: Array<{
    id: string;
    concessionName: string;
    concessionType: string;
    discountPercentage: string | null;
    discountAmount: string | null;
  }>;
  // Documents
  documents: Array<{
    id: string;
    documentType: string;
    originalFileName: string;
    isVerified: boolean;
    createdAt: string;
  }>;
  // Class History
  classHistory: Array<{
    id: string;
    academicYearLabel: string;
    className: string;
    sectionName: string;
    promotionStatus: string | null;
    createdAt: string;
  }>;
  // Timeline
  timelineEvents: Array<{
    id: string;
    date: string;
    title: string;
    description: string;
    type: "ADMISSION" | "ENROLLMENT" | "ACADEMIC" | "ATTENDANCE" | "FEE";
  }>;
  // Exams & Homework
  canViewExams: boolean;
  examMarks: ExamMarkItem[];
  reportCards: ReportCardItem[];
  homeworkSubmissions: HomeworkItem[];
}

export type StudentTabKey =
  | "OVERVIEW"
  | "ACADEMICS"
  | "ATTENDANCE"
  | "FEES"
  | "FAMILY"
  | "DOCUMENTS"
  | "HISTORY"
  | "TIMELINE"
  | "EXAMS"
  | "HOMEWORK";

export function Student360Client({
  data,
  schoolId,
  availableClasses,
  availableYears,
}: {
  data: Student360Data;
  schoolId: string;
  availableClasses: ClassOption[];
  availableYears: YearOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab Sync per Law L2
  const urlTab = searchParams.get("tab")?.toUpperCase();
  const validTabs: StudentTabKey[] = [
    "OVERVIEW",
    "ACADEMICS",
    "ATTENDANCE",
    "FEES",
    "FAMILY",
    "DOCUMENTS",
    "HISTORY",
    "TIMELINE",
    "EXAMS",
    "HOMEWORK",
  ];

  const initialTab: StudentTabKey =
    urlTab && validTabs.includes(urlTab as StudentTabKey)
      ? (urlTab as StudentTabKey)
      : "OVERVIEW";

  const [activeTab, setActiveTab] = useState<StudentTabKey>(initialTab);
  const [examSearch, setExamSearch] = useState("");
  const [homeworkSearch, setHomeworkSearch] = useState("");
  const [generatingInvoices, setGeneratingInvoices] = useState(false);
  const [invoiceMessage, setInvoiceMessage] = useState("");

  function switchTab(tab: StudentTabKey) {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab.toLowerCase());
    window.history.replaceState(null, "", url.toString());
  }

  const primaryParent =
    data.familyMembers.find((f) => f.isPrimaryContact) || data.familyMembers[0];

  const totalOutstanding = data.invoices.reduce(
    (acc, inv) => acc + parseFloat(inv.balanceAmount || "0"),
    0,
  );
  const pendingInvoices = data.invoices.filter((i) => i.status === "PENDING");
  const unverifiedDocs = data.documents.filter((d) => !d.isVerified);
  const lateHomework = data.homeworkSubmissions.filter((h) => h.isLate);
  const plagiarismHomework = data.homeworkSubmissions.filter(
    (h) => h.plagiarismFlagged,
  );

  // Compute exam metrics
  const scoredExams = data.examMarks.filter(
    (e) => !e.isAbsent && e.percentage !== null,
  );
  const averageExamScore =
    scoredExams.length > 0
      ? Math.round(
          scoredExams.reduce((acc, curr) => acc + (curr.percentage || 0), 0) /
            scoredExams.length,
        )
      : null;

  // Best and Weakest Subject computation
  const subjectScores: Record<string, { totalPct: number; count: number; name: string }> = {};
  for (const m of scoredExams) {
    const existing = subjectScores[m.subjectName] || {
      totalPct: 0,
      count: 0,
      name: m.subjectName,
    };
    existing.totalPct += m.percentage || 0;
    existing.count += 1;
    subjectScores[m.subjectName] = existing;
  }
  const subjectAverages = Object.values(subjectScores).map((s) => ({
    name: s.name,
    avg: Math.round(s.totalPct / s.count),
  }));
  subjectAverages.sort((a, b) => b.avg - a.avg);
  const bestSubject = subjectAverages[0] || null;
  const weakestSubject =
    subjectAverages.length > 1
      ? subjectAverages[subjectAverages.length - 1]
      : null;

  // Overview Story calculation (Law L11, F1-F10)
  const todayDateString = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const attentionItemsCount =
    (data.attendanceSummary.percentage < 75 ? 1 : 0) +
    (totalOutstanding > 0 && data.canViewFees ? 1 : 0) +
    (unverifiedDocs.length > 0 ? 1 : 0) +
    (lateHomework.length > 0 ? 1 : 0);

  const humanStorySentence =
    attentionItemsCount === 0
      ? "All attendance, fees, and academic milestones are in excellent standing."
      : attentionItemsCount === 1
        ? "1 item requires administrative or academic attention today."
        : `${attentionItemsCount} items require review and attention today.`;

  // Activity Feed for Story Tab
  const overviewActivityEvents: ActivityEvent[] = data.timelineEvents
    .slice(0, 6)
    .map((evt) => {
      let color: ActivityEvent["color"] = "blue";
      if (evt.type === "ACADEMIC") color = "emerald";
      else if (evt.type === "FEE") color = "amber";
      else if (evt.type === "ATTENDANCE") color = "rose";
      else if (evt.type === "ADMISSION") color = "purple";

      return {
        id: evt.id,
        text: `${evt.title} — ${evt.description}`,
        timestamp: evt.date,
        color,
        actor: data.fullName,
      };
    });

  async function handleGenerateInvoices() {
    setGeneratingInvoices(true);
    setInvoiceMessage("");
    const res = await generateInvoicesForStudent(data.id);
    setGeneratingInvoices(false);
    if (res.success) {
      setInvoiceMessage(res.message || "Invoices generated successfully.");
      router.refresh();
    } else {
      setInvoiceMessage("Error: " + res.message);
    }
  }

  // Filtered lists for scanning tabs
  const filteredExamMarks = data.examMarks.filter((entry) => {
    if (!examSearch) return true;
    const q = examSearch.toLowerCase();
    return (
      entry.examName.toLowerCase().includes(q) ||
      entry.subjectName.toLowerCase().includes(q) ||
      entry.subjectCode.toLowerCase().includes(q) ||
      (entry.grade && entry.grade.toLowerCase().includes(q))
    );
  });

  const filteredHomework = data.homeworkSubmissions.filter((sub) => {
    if (!homeworkSearch) return true;
    const q = homeworkSearch.toLowerCase();
    return (
      sub.assignmentTitle.toLowerCase().includes(q) ||
      sub.subjectName.toLowerCase().includes(q) ||
      sub.subjectCode.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ─── Sticky Identity Header (Law F10, L12) ───────────────────────── */}
      <IdentityHeader
        name={data.fullName}
        avatarUrl={data.photoUrl}
        identifier={data.admissionNumber}
        subtitle={
          <div className="flex flex-wrap items-center gap-2">
            <span>
              {data.className
                ? `${data.className} • Section ${data.sectionName}`
                : "Unassigned Class"}
            </span>
            <span className="text-gray-300 dark:text-slate-700">•</span>
            <span>Attendance {data.attendanceSummary.percentage}%</span>
            {data.canViewFees && (
              <>
                <span className="text-gray-300 dark:text-slate-700">•</span>
                <span
                  className={
                    totalOutstanding > 0 ? "text-amber-600 font-semibold" : ""
                  }
                >
                  Fee Due ₹{totalOutstanding.toFixed(0)}
                </span>
              </>
            )}
          </div>
        }
        breadcrumbs={
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Link href="/students" className="hover:underline">
              Students
            </Link>
            <span>/</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {data.fullName}
            </span>
          </div>
        }
        badges={[
          data.isActive
            ? { label: "Active Student", variant: "success" }
            : { label: "Inactive", variant: "danger" },
          data.academicYearLabel
            ? { label: data.academicYearLabel, variant: "neutral" }
            : { label: "Session", variant: "neutral" },
        ]}
        actions={
          <PromoteStudentModal
            studentId={data.id}
            schoolId={schoolId}
            availableClasses={availableClasses}
            availableYears={availableYears}
          />
        }
      />

      {/* ─── Glanceable Metric Cards (Click to Jump Tabs) ────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Attendance */}
        <div
          onClick={() => switchTab("ATTENDANCE")}
          className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-md ${
            data.attendanceSummary.percentage < 75
              ? "border-amber-300 dark:border-amber-900/60 bg-amber-50/20"
              : "border-gray-200 dark:border-slate-800 hover:border-primary/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-gray-400 tracking-wider">
              Attendance
            </span>
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <div className="text-2xl font-extrabold mt-1.5 text-gray-900 dark:text-white tabular-nums">
            {data.attendanceSummary.percentage}%
          </div>
          <div className="text-xs text-gray-500 mt-0.5 truncate">
            {data.attendanceSummary.present} / {data.attendanceSummary.total} days present
          </div>
        </div>

        {/* Fees */}
        <div
          onClick={() => switchTab("FEES")}
          className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-md ${
            data.canViewFees && totalOutstanding > 0
              ? "border-amber-300 dark:border-amber-900/60 bg-amber-50/20"
              : "border-gray-200 dark:border-slate-800 hover:border-primary/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-gray-400 tracking-wider">
              Fee Balance
            </span>
            <DollarSign className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <div className="text-2xl font-extrabold mt-1.5 text-gray-900 dark:text-white truncate tabular-nums">
            {data.canViewFees ? `₹${totalOutstanding.toFixed(0)}` : "Restricted"}
          </div>
          <div className="text-xs text-gray-500 mt-0.5 truncate">
            {data.canViewFees
              ? `${pendingInvoices.length} pending bill${pendingInvoices.length === 1 ? "" : "s"}`
              : "Financial role required"}
          </div>
        </div>

        {/* Academics / Subjects */}
        <div
          onClick={() => switchTab("ACADEMICS")}
          className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 hover:border-primary/50 transition-all cursor-pointer shadow-xs hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-gray-400 tracking-wider">
              Curriculum
            </span>
            <BookOpen className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <div className="text-2xl font-extrabold mt-1.5 text-gray-900 dark:text-white tabular-nums">
            {data.subjects.length} Subjects
          </div>
          <div className="text-xs text-gray-500 mt-0.5 truncate">
            Class Teacher: {data.classTeacherName || "Not assigned"}
          </div>
        </div>

        {/* Exams Performance */}
        <div
          onClick={() => switchTab("EXAMS")}
          className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 hover:border-primary/50 transition-all cursor-pointer shadow-xs hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-gray-400 tracking-wider">
              Exam Performance
            </span>
            <Award className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <div className="text-2xl font-extrabold mt-1.5 text-gray-900 dark:text-white tabular-nums">
            {averageExamScore !== null ? `${averageExamScore}%` : "No Marks"}
          </div>
          <div className="text-xs text-gray-500 mt-0.5 truncate">
            {bestSubject ? `Top: ${bestSubject.name}` : `${data.examMarks.length} exams recorded`}
          </div>
        </div>
      </div>

      {/* ─── 10-Tab Navigation Bar (Synced to URL ?tab= per Law L2) ──────── */}
      <div className="border-b border-gray-200 dark:border-slate-800 flex overflow-x-auto no-scrollbar gap-1 text-xs font-bold -mx-4 sm:mx-0 px-4 sm:px-0">
        {[
          { key: "OVERVIEW", label: "Overview" },
          { key: "ACADEMICS", label: "Academics" },
          { key: "ATTENDANCE", label: "Attendance" },
          { key: "FEES", label: "Fees" },
          { key: "EXAMS", label: `Exams (${data.examMarks.length})` },
          { key: "HOMEWORK", label: `Homework (${data.homeworkSubmissions.length})` },
          { key: "FAMILY", label: "Family & Guardians" },
          { key: "DOCUMENTS", label: `Documents (${data.documents.length})` },
          { key: "HISTORY", label: "Class History" },
          { key: "TIMELINE", label: "Timeline" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => switchTab(tab.key as StudentTabKey)}
            className={`min-h-[42px] py-2 px-3.5 rounded-t-xl transition-all border-b-2 whitespace-nowrap select-none ${
              activeTab === tab.key
                ? "border-primary text-primary bg-primary/5 font-extrabold"
                : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-800/50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── TAB 1: OVERVIEW (The Story - Law L11, F1-F10) ────────────────── */}
      {activeTab === "OVERVIEW" && (
        <div className="space-y-6">
          {/* Today Strip */}
          <div className="bg-gradient-to-r from-blue-50/80 via-white to-indigo-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/40 p-4 sm:p-5 rounded-2xl border border-blue-100 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>Today • {todayDateString}</span>
              </div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mt-1">
                {humanStorySentence}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300">
                Roll #{data.admissionNumber}
              </span>
              {data.classId && (
                <Link
                  href={`/academics/classes/${data.classId}?tab=roster`}
                  className="bg-primary hover:bg-primary/95 text-white px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <span>Class Hub Roster</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>

          {/* Needs Attention Cards Row */}
          {attentionItemsCount > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs uppercase font-extrabold text-gray-400 tracking-wider">
                Needs Attention
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.attendanceSummary.percentage < 75 && (
                  <NeedsAttentionCard
                    severity="rose"
                    title="Low Attendance Warning"
                    description={`Attendance is at ${data.attendanceSummary.percentage}%, below statutory 75% threshold.`}
                    actionLabel="Review Attendance Log"
                    onAction={() => switchTab("ATTENDANCE")}
                    badge="Critical"
                  />
                )}
                {totalOutstanding > 0 && data.canViewFees && (
                  <NeedsAttentionCard
                    severity={totalOutstanding > 10000 ? "rose" : "amber"}
                    title="Outstanding Fee Invoices"
                    description={`₹${totalOutstanding.toFixed(0)} overdue across ${pendingInvoices.length} bill(s).`}
                    actionLabel="View Fee Ledger"
                    onAction={() => switchTab("FEES")}
                    badge="Payment"
                  />
                )}
                {lateHomework.length > 0 && (
                  <NeedsAttentionCard
                    severity="amber"
                    title="Late Homework Submissions"
                    description={`${lateHomework.length} homework assignment(s) submitted past the due deadline.`}
                    actionLabel="Inspect Homework"
                    onAction={() => switchTab("HOMEWORK")}
                    badge="Homework"
                  />
                )}
                {unverifiedDocs.length > 0 && (
                  <NeedsAttentionCard
                    severity="amber"
                    title="Unverified Documents"
                    description={`${unverifiedDocs.length} statutory document(s) pending administrative verification.`}
                    actionLabel="Review Documents"
                    onAction={() => switchTab("DOCUMENTS")}
                    badge="Statutory"
                  />
                )}
              </div>
            </div>
          )}

          {/* Identity & Placement Information Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Identity & Demographics */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
                <h3 className="font-extrabold text-gray-900 dark:text-white text-sm">
                  Personal Identity & Demographics
                </h3>
                <span className="text-[11px] font-bold text-gray-400">
                  DPDP Compliant
                </span>
              </div>
              <div className="grid grid-cols-2 gap-y-3.5 text-xs">
                <div>
                  <span className="text-gray-400 block mb-0.5">Date of Birth</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatDisplayDate(data.dateOfBirth)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Gender</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {data.gender}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Category</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {data.category}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Blood Group</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {data.bloodGroup || "Not Provided"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Aadhaar Last-4</span>
                  <span className="font-mono font-semibold text-gray-900 dark:text-white">
                    {data.aadhaarLast4 ? `•••• •••• ${data.aadhaarLast4}` : "Masked"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Admission Date</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatDisplayDate(data.admissionDate)}
                  </span>
                </div>
              </div>
            </div>

            {/* Academic Placement */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
                <h3 className="font-extrabold text-gray-900 dark:text-white text-sm">
                  Current Academic Placement
                </h3>
                {data.classId && (
                  <Link
                    href={`/academics/classes/${data.classId}?tab=roster`}
                    className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <span>View in Class Hub</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
              <div className="grid grid-cols-2 gap-y-3.5 text-xs">
                <div>
                  <span className="text-gray-400 block mb-0.5">Class & Section</span>
                  <span className="font-bold text-gray-900 dark:text-white text-sm">
                    {data.className
                      ? `${data.className} • ${data.sectionName}`
                      : "Unassigned"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Academic Session</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {data.academicYearLabel || "Active Session"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Class Teacher</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {data.classTeacherName || "Not Assigned"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Enrolled Subjects</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {data.subjects.length} Subjects
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Primary Contact</span>
                  <span className="font-semibold text-gray-900 dark:text-white truncate block">
                    {primaryParent
                      ? `${primaryParent.name} (${primaryParent.relation})`
                      : "None recorded"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Contact Phone</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {primaryParent?.mobile || "Not provided"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Chronological Activity Feed (Law L11, F2) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-gray-900 dark:text-white text-sm">
                  Recent Activity & Milestones
                </h3>
                <p className="text-xs text-gray-500">
                  Chronological progression of academic events, submissions, and status changes
                </p>
              </div>
              <button
                onClick={() => switchTab("TIMELINE")}
                className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
              >
                <span>Full Timeline</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <ActivityFeed
              events={overviewActivityEvents}
              emptyMessage="No recent activity logged for this student."
            />
          </div>
        </div>
      )}

      {/* ─── TAB 2: ACADEMICS ────────────────────────────────────────────── */}
      {activeTab === "ACADEMICS" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-gray-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                Class Curriculum & Assigned Teachers
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Authoritative subjects inherited from Academic Management for {data.className}
              </p>
            </div>
            {data.classId && (
              <Link
                href={`/academics/classes/${data.classId}?tab=roster`}
                className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1.5 self-start sm:self-auto"
              >
                <span>View in Class Hub Roster</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.subjects.length === 0 ? (
              <div className="col-span-full">
                <EmptyStateCTA
                  icon={<BookOpen className="w-10 h-10 text-gray-300" />}
                  title="No subjects enrolled"
                  hint="No active subjects are currently attached to this class."
                  ctaLabel="Open Class Hub"
                  onCta={() =>
                    data.classId
                      ? router.push(`/academics/classes/${data.classId}?tab=subjects`)
                      : router.push("/academics")
                  }
                />
              </div>
            ) : (
              data.subjects.map((sub) => (
                <div
                  key={sub.id}
                  className="p-4 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 space-y-2 transition-colors hover:border-primary/40"
                >
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                      {sub.name}
                    </h4>
                    <span className="text-[11px] font-mono font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                      {sub.code || "SUB"}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Teacher:{" "}
                    <strong className="text-gray-800 dark:text-gray-200">
                      {sub.teacherName}
                    </strong>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: ATTENDANCE (Scanning Tab) ─────────────────────────────── */}
      {activeTab === "ATTENDANCE" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-gray-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                Attendance Record
              </h3>
              <p className="text-xs text-gray-500">
                Daily attendance logs captured from the classroom attendance register
              </p>
            </div>
            <div className="flex items-center gap-4 self-start sm:self-auto">
              <div className="text-right">
                <span className="text-2xl font-extrabold text-primary tabular-nums">
                  {data.attendanceSummary.percentage}%
                </span>
                <span className="text-[11px] text-gray-400 block font-semibold">
                  Overall Present
                </span>
              </div>
              <div className="text-xs text-gray-500 border-l border-gray-200 dark:border-slate-800 pl-4 space-y-0.5">
                <div>Present: <strong className="text-emerald-600">{data.attendanceSummary.present}</strong></div>
                <div>Absent: <strong className="text-rose-600">{data.attendanceSummary.absent}</strong></div>
                <div>Late: <strong className="text-amber-600">{data.attendanceSummary.late}</strong></div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 uppercase font-bold text-[11px]">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {data.attendanceLogs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center">
                      <EmptyStateCTA
                        icon={<Calendar className="w-8 h-8 text-gray-300" />}
                        title="No attendance records logged"
                        hint="Attendance entries logged by the class teacher will appear here."
                        ctaLabel="View Class Hub"
                        onCta={() =>
                          data.classId
                            ? router.push(`/academics/classes/${data.classId}`)
                            : router.push("/academics")
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  data.attendanceLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                        {formatDisplayDate(log.date)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            log.status === "PRESENT"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : log.status === "ABSENT"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {log.remarks || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 4: FEES (Scanning Tab) ─────────────────────────────────── */}
      {activeTab === "FEES" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-gray-200 dark:border-slate-800 shadow-xs space-y-6">
          {!data.canViewFees ? (
            <div className="p-12 text-center text-gray-500">
              🔒 Financial details and fee structures are restricted to Accountants and School Administrators.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap justify-between items-center gap-4 border-b border-gray-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                    Fee Structures & Invoices
                  </h3>
                  <p className="text-xs text-gray-500">
                    Applicable billing plans, dues, and payment history for {data.className}
                  </p>
                </div>

                {data.canMutateFees && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleGenerateInvoices}
                      disabled={generatingInvoices}
                      className="bg-primary hover:bg-primary/95 text-white font-bold py-2 px-3.5 rounded-xl text-xs shadow-xs transition-colors disabled:opacity-50 min-h-[40px]"
                    >
                      {generatingInvoices ? "Generating..." : "Generate Fee Bills"}
                    </button>
                    <Link
                      href={`/students/${data.id}/fees`}
                      className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <span>Open Full Ledger</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>

              {invoiceMessage && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-xl font-medium border border-blue-200 dark:border-blue-800">
                  {invoiceMessage}
                </div>
              )}

              {/* Active Concessions */}
              {data.concessions.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-extrabold uppercase text-gray-400 tracking-wider mb-2">
                    Active Concessions / Scholarships
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {data.concessions.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 flex justify-between items-center"
                      >
                        <span className="font-bold text-xs text-emerald-900 dark:text-emerald-300">
                          {c.concessionName} ({c.concessionType})
                        </span>
                        <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                          {c.discountPercentage
                            ? `${c.discountPercentage}% OFF`
                            : `₹${c.discountAmount} OFF`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Invoices Table */}
              <div>
                <h4 className="text-[11px] font-extrabold uppercase text-gray-400 tracking-wider mb-2">
                  Generated Invoices & Balances
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 uppercase font-bold text-[11px]">
                      <tr>
                        <th className="px-4 py-3">Fee Type</th>
                        <th className="px-4 py-3">Term</th>
                        <th className="px-4 py-3 text-right">Net Amount</th>
                        <th className="px-4 py-3 text-right">Balance Due</th>
                        <th className="px-4 py-3">Due Date</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                      {data.invoices.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                            No fee bills generated yet. Click &quot;Generate Fee Bills&quot; to initialize.
                          </td>
                        </tr>
                      ) : (
                        data.invoices.map((inv) => (
                          <tr
                            key={inv.id}
                            className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className="font-bold text-gray-900 dark:text-white">
                                {inv.feeTypeName || "Tuition / General Fee"}
                              </div>
                              <div className="font-mono text-[11px] text-gray-400">
                                #{inv.invoiceNumber}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                              {inv.term}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold tabular-nums">
                              ₹{inv.netAmount}
                            </td>
                            <td className="px-4 py-3 text-right font-extrabold text-rose-600 tabular-nums">
                              ₹{inv.balanceAmount}
                            </td>
                            <td className="px-4 py-3 text-gray-500">
                              {formatDisplayDate(inv.dueDate)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  inv.status === "PAID"
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                    : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                }`}
                              >
                                {inv.status}
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
          )}
        </div>
      )}

      {/* ─── TAB 5: EXAMS (NEW Scanning Tab) ─────────────────────────────── */}
      {activeTab === "EXAMS" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-gray-200 dark:border-slate-800 shadow-xs space-y-6">
          {!data.canViewExams ? (
            <div className="p-12 text-center text-gray-500">
              🔒 Examination records are restricted. You are not assigned to this student&apos;s class or subjects.
            </div>
          ) : (
            <>
              {/* Header KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50/50 dark:bg-slate-800/40 p-4 rounded-xl border border-gray-100 dark:border-slate-800">
                <div>
                  <span className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block">
                    Average Score
                  </span>
                  <span className="text-xl font-extrabold text-primary tabular-nums">
                    {averageExamScore !== null ? `${averageExamScore}%` : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block">
                    Best Subject
                  </span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 truncate block">
                    {bestSubject ? `${bestSubject.name} (${bestSubject.avg}%)` : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block">
                    Weakest Subject
                  </span>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 truncate block">
                    {weakestSubject
                      ? `${weakestSubject.name} (${weakestSubject.avg}%)`
                      : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block">
                    Exams Recorded
                  </span>
                  <span className="text-xl font-extrabold text-gray-900 dark:text-white tabular-nums">
                    {data.examMarks.length}
                  </span>
                </div>
              </div>

              {/* Official Report Cards (Result Snapshots) */}
              {data.reportCards.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[11px] font-extrabold uppercase text-gray-400 tracking-wider">
                    Official Term Report Cards
                  </h4>
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {data.reportCards.map((rc) => (
                      <div
                        key={rc.id}
                        className="p-4 rounded-xl border border-blue-100 dark:border-slate-800 bg-blue-50/30 dark:bg-slate-800/50 space-y-2 shadow-xs"
                      >
                        <div className="flex justify-between items-start">
                          <h5 className="font-extrabold text-xs text-gray-900 dark:text-white">
                            {rc.setupName}
                          </h5>
                          {rc.rank && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              Rank #{rc.rank}
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-500">Score Percentage</span>
                          <span className="font-extrabold text-primary">
                            {rc.percentage ? `${rc.percentage}%` : "—"}
                          </span>
                        </div>
                        {rc.grade && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-500">Term Grade</span>
                            <span className="font-bold text-emerald-600">
                              {rc.grade}
                            </span>
                          </div>
                        )}
                        <div className="text-[11px] text-gray-400 pt-1 border-t border-blue-100/60 dark:border-slate-700/60">
                          Released: {formatDisplayDate(rc.publishedAt || rc.frozenAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Exam Marks Table with Pinned Search (Law L1) */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h4 className="text-[11px] font-extrabold uppercase text-gray-400 tracking-wider">
                    Detailed Mark Entries
                  </h4>
                  {data.examMarks.length > 8 && (
                    <div className="relative w-full sm:w-[320px]">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={examSearch}
                        onChange={(e) => setExamSearch(e.target.value)}
                        placeholder="Search exam or subject..."
                        className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary min-h-[38px]"
                      />
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 uppercase font-bold text-[11px]">
                      <tr>
                        <th className="px-4 py-3">Examination</th>
                        <th className="px-4 py-3">Subject</th>
                        <th className="px-4 py-3 text-right">Marks Obtained</th>
                        <th className="px-4 py-3 text-center">Percentage</th>
                        <th className="px-4 py-3 text-center">Grade</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3">Date Logged</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                      {filteredExamMarks.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center">
                            <EmptyStateCTA
                              icon={<FileText className="w-8 h-8 text-gray-300" />}
                              title="No exam records found"
                              hint="Exam results and evaluations for this student will appear here once recorded and published."
                              ctaLabel="Open Exams Module"
                              onCta={() => router.push("/exams")}
                            />
                          </td>
                        </tr>
                      ) : (
                        filteredExamMarks.map((entry) => (
                          <tr
                            key={entry.id}
                            className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                              {entry.examName}
                              {entry.componentName && (
                                <span className="block text-[11px] text-gray-400 font-normal">
                                  {entry.componentName}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-semibold text-gray-800 dark:text-gray-200">
                                {entry.subjectName}
                              </span>
                              {entry.subjectCode && (
                                <span className="ml-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400">
                                  {entry.subjectCode}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-extrabold tabular-nums">
                              {entry.isAbsent ? (
                                <span className="text-rose-600">ABSENT</span>
                              ) : entry.isMedicalExempt ? (
                                <span className="text-amber-600">EXEMPT</span>
                              ) : (
                                `${entry.marksObtained ?? "—"} / ${entry.maxMarks}`
                              )}
                            </td>
                            <td className="px-4 py-3 text-center tabular-nums">
                              {entry.percentage !== null ? (
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                    entry.percentage >= 75
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                      : entry.percentage >= 40
                                        ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                        : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                  }`}
                                >
                                  {entry.percentage}%
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-3 text-center font-bold">
                              {entry.grade || "—"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                  entry.isAbsent
                                    ? "bg-rose-100 text-rose-800"
                                    : entry.isMedicalExempt
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                }`}
                              >
                                {entry.isAbsent
                                  ? "Absent"
                                  : entry.isMedicalExempt
                                    ? "Exempt"
                                    : "Present"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-500">
                              {formatDisplayDate(entry.enteredAt)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── TAB 6: HOMEWORK (NEW Scanning Tab) ──────────────────────────── */}
      {activeTab === "HOMEWORK" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-gray-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                Homework & Assignment Submissions
              </h3>
              <p className="text-xs text-gray-500">
                Track submitted coursework, compliance deadlines, and grading feedback
              </p>
            </div>
            {data.homeworkSubmissions.length > 8 && (
              <div className="relative w-full sm:w-[320px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={homeworkSearch}
                  onChange={(e) => setHomeworkSearch(e.target.value)}
                  placeholder="Search homework or subject..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary min-h-[38px]"
                />
              </div>
            )}
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50/50 dark:bg-slate-800/40 p-4 rounded-xl border border-gray-100 dark:border-slate-800">
            <div>
              <span className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block">
                Total Submissions
              </span>
              <span className="text-xl font-extrabold text-primary tabular-nums">
                {data.homeworkSubmissions.length}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block">
                On-Time Rate
              </span>
              <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {data.homeworkSubmissions.length > 0
                  ? `${Math.round(
                      ((data.homeworkSubmissions.length - lateHomework.length) /
                        data.homeworkSubmissions.length) *
                        100,
                    )}%`
                  : "—"}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block">
                Late Submissions
              </span>
              <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                {lateHomework.length}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block">
                Plagiarism Alerts
              </span>
              <span className="text-xl font-extrabold text-rose-600 tabular-nums">
                {plagiarismHomework.length}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 uppercase font-bold text-[11px]">
                <tr>
                  <th className="px-4 py-3">Assignment Title</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Submitted At</th>
                  <th className="px-4 py-3 text-center">Submission Status</th>
                  <th className="px-4 py-3 text-right">Score</th>
                  <th className="px-4 py-3 text-center">Plagiarism</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filteredHomework.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center">
                      <EmptyStateCTA
                        icon={<BookOpen className="w-8 h-8 text-gray-300" />}
                        title="No homework submissions recorded"
                        hint="Completed homework and student assignment uploads will be tracked here."
                        ctaLabel="View Class Workloads"
                        onCta={() =>
                          data.classId
                            ? router.push(
                                `/academics/classes/${data.classId}?tab=assignments`,
                              )
                            : router.push("/academics")
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  filteredHomework.map((sub) => (
                    <tr
                      key={sub.id}
                      className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-bold text-gray-900 dark:text-white">
                          {sub.assignmentTitle}
                        </span>
                        {sub.remarks && (
                          <span className="block text-[11px] text-gray-400 truncate max-w-xs font-normal">
                            Teacher: {sub.remarks}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          {sub.subjectName}
                        </span>
                        {sub.subjectCode && (
                          <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400">
                            {sub.subjectCode}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDisplayDate(sub.dueDate)}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDisplayDate(sub.submittedAt)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            sub.isLate
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                          }`}
                        >
                          {sub.isLate ? "Late Submission" : "On Time"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">
                        {sub.marksAwarded !== null
                          ? `${sub.marksAwarded} / ${sub.maxMarks || "—"}`
                          : "Ungraded"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {sub.plagiarismFlagged ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                            Flagged
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Clear</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 7: FAMILY & GUARDIANS ───────────────────────────────────── */}
      {activeTab === "FAMILY" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-gray-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="border-b border-gray-100 dark:border-slate-800 pb-3">
            <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
              Family & Guardians Dossier
            </h3>
            <p className="text-xs text-gray-500">
              Verified parents, legal guardians, and statutory emergency contacts
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {data.familyMembers.length === 0 ? (
              <p className="text-gray-400 text-xs">No family members recorded.</p>
            ) : (
              data.familyMembers.map((fm) => (
                <div
                  key={fm.id}
                  className="p-5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-extrabold text-gray-900 dark:text-white text-sm">
                        {fm.name}
                      </h4>
                      <span className="text-[11px] text-gray-400 uppercase tracking-wider font-bold">
                        {fm.relation}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {fm.isPrimaryContact && (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 rounded-full">
                          Primary Contact
                        </span>
                      )}
                      {fm.hasConsentAuthority && (
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 px-2 py-0.5 rounded-full">
                          DPDP Consent Authority
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
                    {fm.mobile && <div>📞 Mobile: {fm.mobile}</div>}
                    {fm.email && <div>✉️ Email: {fm.email}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 8: DOCUMENTS (Scanning Tab) ─────────────────────────────── */}
      {activeTab === "DOCUMENTS" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-gray-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="border-b border-gray-100 dark:border-slate-800 pb-3">
            <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
              Permanent Student Documents
            </h3>
            <p className="text-xs text-gray-500">
              Verified identity, statutory compliance, and admission certificates
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 uppercase font-bold text-[11px]">
                <tr>
                  <th className="px-4 py-3">Document Type</th>
                  <th className="px-4 py-3">File Name</th>
                  <th className="px-4 py-3 text-center">Verification State</th>
                  <th className="px-4 py-3">Uploaded Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {data.documents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                      No documents recorded for this student.
                    </td>
                  </tr>
                ) : (
                  data.documents.map((doc) => (
                    <tr
                      key={doc.id}
                      className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                        {doc.documentType.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {doc.originalFileName}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            doc.isVerified
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                          }`}
                        >
                          {doc.isVerified ? "✓ Verified" : "Pending Review"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDisplayDate(doc.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 9: CLASS HISTORY ────────────────────────────────────────── */}
      {activeTab === "HISTORY" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-gray-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                Academic Progression History
              </h3>
              <p className="text-xs text-gray-500">
                Authoritative class enrollment and promotion timeline
              </p>
            </div>
            <PromoteStudentModal
              studentId={data.id}
              schoolId={schoolId}
              availableClasses={availableClasses}
              availableYears={availableYears}
            />
          </div>

          <div className="space-y-3">
            {data.classHistory.length === 0 ? (
              <p className="text-gray-400 text-xs">No class progression history recorded.</p>
            ) : (
              data.classHistory.map((h, idx) => (
                <div
                  key={h.id}
                  className="flex items-center p-4 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 justify-between"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-extrabold text-xs">
                      #{idx + 1}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-xs">
                        {h.className} • Section {h.sectionName}
                      </h4>
                      <p className="text-[11px] text-gray-500">
                        Academic Year: {h.academicYearLabel}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                      {h.promotionStatus || "ACTIVE"}
                    </span>
                    <span className="block text-[11px] text-gray-400 mt-1">
                      {formatDisplayDate(h.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 10: TIMELINE ────────────────────────────────────────────── */}
      {activeTab === "TIMELINE" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-gray-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="border-b border-gray-100 dark:border-slate-800 pb-3">
            <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
              Student Trajectory Timeline
            </h3>
            <p className="text-xs text-gray-500">
              Complete chronological audit trail across admissions, enrollment, academic evaluations, and fee milestones
            </p>
          </div>

          <div className="relative border-l-2 border-primary/20 ml-4 space-y-6 py-2">
            {data.timelineEvents.map((evt) => (
              <div key={evt.id} className="relative pl-6">
                <div className="absolute -left-2 top-1.5 w-3.5 h-3.5 rounded-full bg-primary border-2 border-white dark:border-slate-900 ring-2 ring-primary/20" />
                <div className="text-[11px] text-gray-400 font-semibold">
                  {formatDisplayDate(evt.date)}
                </div>
                <div className="font-bold text-xs text-gray-900 dark:text-white mt-0.5">
                  {evt.title}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                  {evt.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
