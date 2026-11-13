"use client";

import React, { useState, useTransition } from "react";
import {
  BookOpen,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Paperclip,
  Users,
  Award,
  Send,
  X,
  Lock,
  ChevronRight,
  Filter,
} from "lucide-react";
import { AppModal } from "@/components/ui/AppModal";
import { toast } from "sonner";
import {
  createHomeworkAction,
  updateHomeworkAction,
  getHomeworkSubmissionsRoster,
  updateSubmissionGradeAction,
  type TeacherHomeworkItem,
  type TeacherAllocationOption,
  type SyllabusTopicOption,
} from "./homeworkActions";
import { cn } from "@/lib/utils";

export interface TeacherHomeworkClientProps {
  initialHomeworkList: TeacherHomeworkItem[];
  allocations: TeacherAllocationOption[];
  syllabusTopics: SyllabusTopicOption[];
  locale?: string;
}

export function TeacherHomeworkClient({
  initialHomeworkList,
  allocations,
  syllabusTopics,
  locale = "en",
}: TeacherHomeworkClientProps) {
  const isHi = locale === "hi";
  const [homeworkList, setHomeworkList] = useState<TeacherHomeworkItem[]>(initialHomeworkList);
  const [selectedAllocationKey, setSelectedAllocationKey] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  // Create/Edit Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingHomework, setEditingHomework] = useState<TeacherHomeworkItem | null>(null);
  const [formData, setFormData] = useState({
    allocationKey: allocations[0] ? `${allocations[0].classSubjectId}_${allocations[0].sectionId}` : "",
    title: "",
    description: "",
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16),
    maxMarks: 50,
    attachmentS3Key: "",
    syllabusTopicId: "",
  });

  // Submissions Roster Modal State
  const [rosterOpen, setRosterOpen] = useState(false);
  const [activeRosterData, setActiveRosterData] = useState<{
    assignment: any;
    roster: any[];
  } | null>(null);
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);

  // Filtered homework list
  const filteredHomework = homeworkList.filter((hw) => {
    if (selectedAllocationKey === "all") return true;
    const [csId, secId] = selectedAllocationKey.split("_");
    return hw.classSubjectId === csId && hw.sectionId === secId;
  });

  const handleOpenCreate = () => {
    setEditingHomework(null);
    setFormData({
      allocationKey: allocations[0] ? `${allocations[0].classSubjectId}_${allocations[0].sectionId}` : "",
      title: "",
      description: "",
      dueDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16),
      maxMarks: 50,
      attachmentS3Key: "",
      syllabusTopicId: "",
    });
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (hw: TeacherHomeworkItem) => {
    setEditingHomework(hw);
    setFormData({
      allocationKey: `${hw.classSubjectId}_${hw.sectionId}`,
      title: hw.title,
      description: hw.description,
      dueDate: new Date(hw.dueDate).toISOString().slice(0, 16),
      maxMarks: hw.maxMarks || 50,
      attachmentS3Key: hw.attachmentS3Key || "",
      syllabusTopicId: "",
    });
    setIsCreateOpen(true);
  };

  const handleSaveHomework = (publishNow = false) => {
    if (!formData.title.trim()) {
      toast.error(isHi ? "कृपया शीर्षक दर्ज करें" : "Please enter assignment title");
      return;
    }
    if (!formData.description.trim()) {
      toast.error(isHi ? "कृपया विवरण दर्ज करें" : "Please enter assignment instructions");
      return;
    }

    const [classSubjectId, sectionId] = formData.allocationKey.split("_");
    if (!classSubjectId || !sectionId) {
      toast.error(isHi ? "कृपया कक्षा व विषय चुनें" : "Please select a valid allocation");
      return;
    }

    startTransition(async () => {
      try {
        if (editingHomework) {
          const targetStatus: "DRAFT" | "PUBLISHED" | "CLOSED" =
            publishNow
              ? "PUBLISHED"
              : editingHomework.status === "GRADED"
              ? "PUBLISHED"
              : editingHomework.status;
          const res = await updateHomeworkAction({
            id: editingHomework.id,
            title: formData.title,
            description: formData.description,
            dueDate: new Date(formData.dueDate),
            maxMarks: Number(formData.maxMarks),
            ...(formData.attachmentS3Key ? { attachmentS3Key: formData.attachmentS3Key } : {}),
            status: targetStatus,
          });

          if (res.success) {
            toast.success(
              publishNow
                ? (isHi ? "गृहकार्य प्रकाशित किया गया!" : "Homework published successfully!")
                : (isHi ? "गृहकार्य अद्यतित किया गया" : "Homework updated successfully")
            );
            setHomeworkList((prev) =>
              prev.map((h) =>
                h.id === editingHomework.id
                  ? {
                      ...h,
                      title: formData.title,
                      description: formData.description,
                      dueDate: new Date(formData.dueDate).toISOString(),
                      maxMarks: Number(formData.maxMarks),
                      attachmentS3Key: formData.attachmentS3Key || null,
                      status: publishNow ? "PUBLISHED" : h.status,
                    }
                  : h
              )
            );
            setIsCreateOpen(false);
          }
        } else {
          const res = await createHomeworkAction({
            classSubjectId,
            sectionId,
            title: formData.title,
            description: formData.description,
            dueDate: new Date(formData.dueDate),
            maxMarks: Number(formData.maxMarks),
            ...(formData.attachmentS3Key ? { attachmentS3Key: formData.attachmentS3Key } : {}),
            ...(formData.syllabusTopicId ? { syllabusTopicId: formData.syllabusTopicId } : {}),
            status: publishNow ? "PUBLISHED" : "DRAFT",
          });

          if (res.success) {
            toast.success(
              publishNow
                ? (isHi ? "गृहकार्य प्रकाशित किया गया!" : "Homework posted and sent to parents!")
                : (isHi ? "गृहकार्य ड्राफ्ट के रूप में सहेजा गया" : "Homework saved as draft")
            );

            const alloc = allocations.find((a) => a.classSubjectId === classSubjectId && a.sectionId === sectionId);

            const newItem: TeacherHomeworkItem = {
              id: res.assignmentId,
              classSubjectId,
              sectionId,
              className: alloc?.className || "Class",
              sectionName: alloc?.sectionName || "Section",
              subjectName: alloc?.subjectName || "Subject",
              title: formData.title,
              description: formData.description,
              dueDate: new Date(formData.dueDate).toISOString(),
              maxMarks: Number(formData.maxMarks),
              status: publishNow ? "PUBLISHED" : "DRAFT",
              attachmentS3Key: formData.attachmentS3Key || null,
              totalSubmissions: 0,
              gradedSubmissions: 0,
              totalStudents: 35,
            };

            setHomeworkList((prev) => [newItem, ...prev]);
            setIsCreateOpen(false);
          }
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to save homework");
      }
    });
  };

  const handlePublishDirect = (hw: TeacherHomeworkItem) => {
    startTransition(async () => {
      try {
        const res = await updateHomeworkAction({
          id: hw.id,
          status: "PUBLISHED",
        });
        if (res.success) {
          toast.success(isHi ? "गृहकार्य प्रकाशित हुआ!" : "Homework published! Parents notified.");
          setHomeworkList((prev) =>
            prev.map((h) => (h.id === hw.id ? { ...h, status: "PUBLISHED" } : h))
          );
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to publish");
      }
    });
  };

  const handleOpenRoster = (hw: TeacherHomeworkItem) => {
    startTransition(async () => {
      try {
        const data = await getHomeworkSubmissionsRoster(hw.id);
        setActiveRosterData(data);
        setRosterOpen(true);
      } catch (err: any) {
        toast.error(err.message || "Failed to load submissions");
      }
    });
  };

  const handleGradeStudent = (
    studentId: string,
    marksAwarded: number | null,
    remarks: string | null
  ) => {
    if (!activeRosterData) return;
    setSavingStudentId(studentId);

    startTransition(async () => {
      try {
        await updateSubmissionGradeAction({
          assignmentId: activeRosterData.assignment.id,
          studentId,
          marksAwarded,
          remarks,
        });

        setActiveRosterData((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            roster: prev.roster.map((st) =>
              st.studentId === studentId
                ? {
                    ...st,
                    isSubmitted: true,
                    marksAwarded,
                    remarks,
                  }
                : st
            ),
          };
        });
        toast.success(isHi ? "अंक सहेजे गए" : "Marks saved");
      } catch (err: any) {
        toast.error(err.message || "Failed to save grade");
      } finally {
        setSavingStudentId(null);
      }
    });
  };

  return (
    <div className="space-y-6" data-testid="teacher-homework-surface">
      {/* ─── Header Strip ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-indigo-500" />
            <span>{isHi ? "गृहकार्य प्रबंधन" : "Homework & Assignments"}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isHi
              ? "गृहकार्य पोस्ट करें, सबमिशन जांचें और अभिभावक फ़ीड को लाइव रखें।"
              : "Post assignments, grade submissions, and feed the parent companion feed."}
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          data-testid="post-homework-cta"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        >
          <Plus className="w-4 h-4" />
          <span>{isHi ? "गृहकार्य पोस्ट करें" : "Post Homework"}</span>
        </button>
      </div>

      {/* ─── Allocations Filter ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedAllocationKey("all")}
          className={cn(
            "px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border",
            selectedAllocationKey === "all"
              ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
          )}
        >
          {isHi ? "सभी कक्षाएं" : "All Allocations"} ({homeworkList.length})
        </button>

        {allocations.map((alloc) => {
          const key = `${alloc.classSubjectId}_${alloc.sectionId}`;
          const isSelected = selectedAllocationKey === key;
          const count = homeworkList.filter(
            (h) => h.classSubjectId === alloc.classSubjectId && h.sectionId === alloc.sectionId
          ).length;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedAllocationKey(key)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border",
                isSelected
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              {alloc.className}-{alloc.sectionName} · {alloc.subjectName} ({count})
            </button>
          );
        })}
      </div>

      {/* ─── Homework Cards Grid ─────────────────────────────────────────────── */}
      {filteredHomework.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {isHi ? "कोई गृहकार्य पोस्ट नहीं मिला" : "No Homework Posted Yet"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {isHi
              ? "अपनी आवंटित कक्षाओं के लिए नया गृहकार्य पोस्ट करें ताकि अभिभावकों के पास पहुंच सके।"
              : "Post your first assignment for this class-subject. It will appear on parents' feeds immediately."}
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isHi ? "पहला गृहकार्य बनाएं" : "Create Assignment"}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="teacher-homework-list">
          {filteredHomework.map((hw) => {
            const dueDate = new Date(hw.dueDate);
            const isPastDue = dueDate.getTime() < Date.now();
            const formattedDueDate = dueDate.toLocaleDateString(isHi ? "hi-IN" : "en-IN", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={hw.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4 sm:p-5 flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition"
              >
                <div className="space-y-3">
                  {/* Top Meta Chips */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 truncate">
                        {hw.className}-{hw.sectionName} · {hw.subjectName}
                      </span>
                    </div>

                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                        hw.status === "PUBLISHED"
                          ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
                          : hw.status === "DRAFT"
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                          : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60"
                      )}
                    >
                      {hw.status}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-1">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white line-clamp-1">
                      {hw.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {hw.description}
                    </p>
                  </div>

                  {/* Due Date & Submission Counts */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formattedDueDate}</span>
                    </div>

                    <div className="flex items-center justify-end gap-1 font-bold text-indigo-600 dark:text-indigo-400">
                      <Users className="w-3.5 h-3.5" />
                      <span>
                        {hw.totalSubmissions}/{hw.totalStudents || 35} {isHi ? "जमा" : "Submitted"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/80 gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenRoster(hw)}
                    data-testid="view-roster-btn"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <span>{isHi ? "सबमिशन व अंक देखें" : "Submissions & Grading"}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    {hw.status === "DRAFT" && (
                      <button
                        type="button"
                        onClick={() => handlePublishDirect(hw)}
                        disabled={isPending}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
                      >
                        {isHi ? "प्रकाशित करें" : "Publish"}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(hw)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
                    >
                      {isHi ? "संपादित करें" : "Edit"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Create / Edit Homework Modal ────────────────────────────────────── */}
      <AppModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        size="lg"
        title={
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-500" />
            <span>
              {editingHomework
                ? (isHi ? "गृहकार्य संपादित करें" : "Edit Homework Assignment")
                : (isHi ? "नया गृहकार्य पोस्ट करें" : "Create New Homework Assignment")}
            </span>
          </div>
        }
        description={
          <span>
            {isHi
              ? "अभिभावकों के फ़ीड में यह पोस्ट तुरंत दिखाई देगी।"
              : "Students and parents will see this directly on their daily academic feed."}
          </span>
        }
      >
        <div className="space-y-4 py-1 text-sm text-slate-800 dark:text-slate-200" data-testid="homework-form-modal">
          {/* Allocation Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isHi ? "कक्षा व विषय चुनें" : "Select Class & Subject Allocation"}
            </label>
            <select
              value={formData.allocationKey}
              disabled={Boolean(editingHomework)}
              onChange={(e) => setFormData({ ...formData, allocationKey: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              {allocations.map((alloc) => (
                <option key={`${alloc.classSubjectId}_${alloc.sectionId}`} value={`${alloc.classSubjectId}_${alloc.sectionId}`}>
                  {alloc.className}-{alloc.sectionName} · {alloc.subjectName}
                </option>
              ))}
            </select>
          </div>

          {/* Title Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isHi ? "गृहकार्य का शीर्षक" : "Assignment Title"}
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder={isHi ? "जैसे: द्विघात समीकरण अभ्यास 2.3" : "e.g. Chapter 4 Practice Questions 1 to 8"}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          {/* Instructions / Description (PII Scanned) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>{isHi ? "निर्देश व विवरण (निर्देशानुसार हल करें)" : "Instructions & Problem Statements"}</span>
              <span className="text-[10px] text-slate-400 font-normal">DPDP PII Protected</span>
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={isHi ? "विस्तृत निर्देश लिखें..." : "Enter homework instructions, problem numbers, or notes for parents..."}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          {/* Due Date & Max Marks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isHi ? "जमा करने की अंतिम तिथि" : "Submission Due Date"}
              </label>
              <input
                type="datetime-local"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isHi ? "अधिकतम अंक" : "Max Marks"}
              </label>
              <input
                type="number"
                min={1}
                max={200}
                value={formData.maxMarks}
                onChange={(e) => setFormData({ ...formData, maxMarks: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
          </div>

          {/* Optional Syllabus Topic */}
          {syllabusTopics.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isHi ? "पाठ्यक्रम इकाई व विषय (वैकल्पिक)" : "Link Syllabus Topic (Optional)"}
              </label>
              <select
                value={formData.syllabusTopicId}
                onChange={(e) => setFormData({ ...formData, syllabusTopicId: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="">{isHi ? "-- कोई विषय लिंक न करें --" : "-- None / General Assignment --"}</option>
                {syllabusTopics.map((top) => (
                  <option key={top.id} value={top.id}>
                    {top.unitTitle} · {top.chapterTitle} · {top.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Optional Attachment Key */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-slate-400" />
              <span>{isHi ? "संलग्न सामग्री कुंजी / लिंक (वैकल्पिक)" : "Attachment S3 Key / File (Optional)"}</span>
            </label>
            <input
              type="text"
              value={formData.attachmentS3Key}
              onChange={(e) => setFormData({ ...formData, attachmentS3Key: e.target.value })}
              placeholder="e.g. homework/class10/maths_ws_04.pdf"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {isHi ? "रद्द करें" : "Cancel"}
            </button>

            <button
              type="button"
              disabled={isPending}
              onClick={() => handleSaveHomework(false)}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              {isHi ? "ड्राफ्ट सहेजें" : "Save as Draft"}
            </button>

            <button
              type="button"
              disabled={isPending}
              onClick={() => handleSaveHomework(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isHi ? "प्रकाशित करें" : "Publish to Parents"}</span>
            </button>
          </div>
        </div>
      </AppModal>

      {/* ─── Submissions & Grading Roster Modal ──────────────────────────────── */}
      <AppModal
        open={rosterOpen}
        onClose={() => setRosterOpen(false)}
        size="xl"
        title={
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-500" />
            <span>
              {activeRosterData?.assignment?.title} · {activeRosterData?.assignment?.className}-
              {activeRosterData?.assignment?.sectionName}
            </span>
          </div>
        }
        description={
          <span>
            {isHi ? "अधिकतम अंक: " : "Max Marks: "}
            {activeRosterData?.assignment?.maxMarks || 50} ·{" "}
            {isHi ? "विद्यार्थी सबमिशन सूची व अंक प्रविष्टि" : "Student submissions and marks entry"}
          </span>
        }
      >
        <div className="space-y-4 py-1 text-xs sm:text-sm" data-testid="homework-roster-modal">
          <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
            {activeRosterData?.roster.map((st: any) => {
              return (
                <div
                  key={st.studentId}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
                      {st.rollNumber || "•"}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white truncate">
                        {st.studentName}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Adm: {st.admissionNumber}{" "}
                        {st.isSubmitted ? (
                          <span className="text-emerald-500 font-semibold ml-1">
                            • {isHi ? "जमा किया" : "Submitted"}
                          </span>
                        ) : (
                          <span className="text-amber-500 font-semibold ml-1">
                            • {isHi ? "बाकी" : "Missing"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Marks & Remarks Input */}
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={activeRosterData?.assignment?.maxMarks || 50}
                      defaultValue={st.marksAwarded ?? ""}
                      placeholder={isHi ? "अंक" : "Marks"}
                      id={`marks-${st.studentId}`}
                      className="w-18 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-center font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />

                    <input
                      type="text"
                      defaultValue={st.remarks ?? ""}
                      placeholder={isHi ? "टिप्पणी (वैकल्पिक)" : "Remarks (optional)"}
                      id={`remarks-${st.studentId}`}
                      className="w-32 sm:w-44 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />

                    <button
                      type="button"
                      disabled={savingStudentId === st.studentId}
                      onClick={() => {
                        const marksEl = document.getElementById(
                          `marks-${st.studentId}`
                        ) as HTMLInputElement;
                        const remarksEl = document.getElementById(
                          `remarks-${st.studentId}`
                        ) as HTMLInputElement;

                        const val = marksEl?.value ? Number(marksEl.value) : null;
                        const rem = remarksEl?.value || null;
                        handleGradeStudent(st.studentId, val, rem);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition"
                    >
                      {savingStudentId === st.studentId
                        ? "..."
                        : isHi
                        ? "दर्ज करें"
                        : "Save"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </AppModal>
    </div>
  );
}
