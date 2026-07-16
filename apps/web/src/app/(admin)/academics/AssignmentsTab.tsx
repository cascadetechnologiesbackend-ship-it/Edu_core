"use client";

import { useState, useEffect, useTransition } from "react";
import { getAssignments, saveAssignment, getAssignmentSubmissions, gradeSubmission, submitAssignment } from "./actions";
import { Plus, RefreshCw, FileText, CheckCircle2, Award, ClipboardList } from "lucide-react";

type Assignment = {
  id: string;
  title: string;
  description: string;
  maxMarks: number | null;
  dueDate: Date;
  attachmentS3Key: string | null;
  status: "DRAFT" | "PUBLISHED" | "CLOSED" | "GRADED";
};

type Submission = {
  id: string;
  studentId: string;
  submittedAt: Date;
  attachmentS3Key: string | null;
  remarks: string | null;
  marksAwarded: number | null;
  gradedAt: Date | null;
};

type Classroom = {
  id: string;
  displayName: string;
  sections: { id: string; name: string }[];
};

type ClassSubject = {
  id: string;
  classId: string;
  subjectId: string;
  subject: {
    name: string;
    code: string;
  };
};

export default function AssignmentsTab({
  classrooms,
  mappings,
  role,
  userId,
}: {
  classrooms: Classroom[];
  mappings: ClassSubject[];
  role: string;
  userId: string;
}) {
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedSubjectMapping, setSelectedSubjectMapping] = useState("");
  const [assignmentsList, setAssignmentsList] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submissionsList, setSubmissionsList] = useState<Submission[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [showAssignForm, setShowAssignForm] = useState(false);
  const [showGradeForm, setShowGradeForm] = useState(false);
  const [showSubmitForm, setShowSubmitForm] = useState(false);

  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);

  const [assignData, setAssignData] = useState({
    title: "",
    description: "",
    maxMarks: 100,
    dueDate: new Date().toISOString().split("T")[0] || "",
    status: "PUBLISHED" as any,
  });

  const [gradeData, setGradeData] = useState({
    marksAwarded: 90,
    remarks: "",
  });

  const [submitData, setSubmitData] = useState({
    attachmentS3Key: "",
    remarks: "",
  });

  const isTeacher = role === "TEACHER";
  const isStudent = role === "STUDENT";
  const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(role);

  // Setup default values for dropdowns
  useEffect(() => {
    if (classrooms.length > 0 && classrooms[0]?.sections.length > 0) {
      setSelectedSection(classrooms[0].sections[0].id);
    }
  }, [classrooms]);

  useEffect(() => {
    if (selectedSection && mappings.length > 0) {
      setSelectedSubjectMapping(mappings[0]?.id || "");
    }
  }, [selectedSection, mappings]);

  // Load assignments when selection changes
  const loadData = () => {
    if (!selectedSection || !selectedSubjectMapping) return;
    setLoading(true);
    getAssignments(selectedSection, selectedSubjectMapping)
      .then((data) => {
        setAssignmentsList(data as any);
        setSelectedAssignment(null);
        setSubmissionsList([]);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [selectedSection, selectedSubjectMapping]);

  // Load submissions when an assignment is selected
  const handleSelectAssignment = (assign: Assignment) => {
    setSelectedAssignment(assign);
    setLoadingSubs(true);
    getAssignmentSubmissions(assign.id)
      .then((data) => {
        setSubmissionsList(data as any);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoadingSubs(false));
  };

  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await saveAssignment({
        classSubjectId: selectedSubjectMapping,
        sectionId: selectedSection,
        title: assignData.title,
        description: assignData.description,
        maxMarks: assignData.maxMarks,
        dueDate: assignData.dueDate,
        status: assignData.status,
      });
      setShowAssignForm(false);
      loadData();
    });
  };

  const handleGradeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub) return;
    startTransition(async () => {
      await gradeSubmission({
        submissionId: selectedSub.id,
        marksAwarded: gradeData.marksAwarded,
        remarks: gradeData.remarks || null,
      });
      setShowGradeForm(false);
      if (selectedAssignment) handleSelectAssignment(selectedAssignment);
    });
  };

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) return;
    startTransition(async () => {
      await submitAssignment({
        assignmentId: selectedAssignment.id,
        studentId: userId,
        attachmentS3Key: submitData.attachmentS3Key || null,
        remarks: submitData.remarks || null,
      });
      setShowSubmitForm(false);
      handleSelectAssignment(selectedAssignment);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">Assignments & Home Work</h2>
          <p className="text-xs text-gray-500">Create, submit, or evaluate classroom assignments.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Section:</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="rounded border border-gray-300 dark:border-slate-600 bg-transparent px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {classrooms.map((cls) =>
                cls.sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {cls.displayName} - Sec {sec.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Course:</label>
            <select
              value={selectedSubjectMapping}
              onChange={(e) => setSelectedSubjectMapping(e.target.value)}
              className="rounded border border-gray-300 dark:border-slate-600 bg-transparent px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {mappings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.subject.name} ({m.subject.code})
                </option>
              ))}
            </select>
          </div>
          {(isTeacher || isAdmin) && (
            <button
              onClick={() => setShowAssignForm(true)}
              className="flex items-center gap-1 bg-primary hover:bg-primary/95 text-white px-3 py-1.5 rounded text-xs font-semibold transition"
            >
              <Plus className="w-3.5 h-3.5" /> New Assignment
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assignments List */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-xl shadow border border-gray-200 dark:border-slate-800 p-4 space-y-3">
          <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider">Assignments</h3>
          {loading ? (
            <div className="flex justify-center py-10">
              <RefreshCw className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : assignmentsList.length === 0 ? (
            <p className="text-xs text-gray-500 italic">No assignments posted.</p>
          ) : (
            <div className="space-y-2">
              {assignmentsList.map((assign) => (
                <div
                  key={assign.id}
                  onClick={() => handleSelectAssignment(assign)}
                  className={`p-3 rounded-lg border cursor-pointer transition text-left space-y-1.5 ${
                    selectedAssignment?.id === assign.id
                      ? "border-primary bg-primary/5"
                      : "border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/30"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <p className="font-semibold text-xs text-gray-800 dark:text-gray-200 truncate">{assign.title}</p>
                    <span className="text-[10px] bg-gray-100 dark:bg-slate-800 text-gray-500 px-1.5 py-0.5 rounded font-semibold">
                      {assign.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500">
                    Due: {new Date(assign.dueDate).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Assignment Submissions/Evaluation */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl shadow border border-gray-200 dark:border-slate-800 p-6 space-y-6">
          {selectedAssignment ? (
            <div className="space-y-6">
              <div className="flex justify-between items-start border-b border-gray-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">{selectedAssignment.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{selectedAssignment.description}</p>
                  <p className="text-xs text-gray-400 mt-2 font-semibold">
                    Max Marks: {selectedAssignment.maxMarks || "—"} | Due Date: {new Date(selectedAssignment.dueDate).toLocaleDateString()}
                  </p>
                </div>
                {isStudent && (
                  <button
                    onClick={() => setShowSubmitForm(true)}
                    className="bg-primary hover:bg-primary/95 text-white px-4 py-2 rounded-lg text-xs font-semibold transition"
                  >
                    Submit Work
                  </button>
                )}
              </div>

              {/* Submissions list for teachers/admins */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-primary" /> Evaluation & Submissions
                </h4>

                {loadingSubs ? (
                  <div className="flex justify-center py-10">
                    <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                  </div>
                ) : submissionsList.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No submissions yet.</p>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    {submissionsList.map((sub) => (
                      <div key={sub.id} className="py-3 flex justify-between items-center text-xs">
                        <div className="space-y-1 text-left">
                          <p className="font-semibold text-gray-700 dark:text-gray-300">
                            Student ID: {sub.studentId.substring(0, 8)}...
                          </p>
                          <p className="text-[10px] text-gray-400">
                            Submitted: {new Date(sub.submittedAt).toLocaleString()}
                          </p>
                          {sub.remarks && <p className="text-gray-500 italic">"{sub.remarks}"</p>}
                        </div>
                        <div className="flex items-center gap-3">
                          {sub.marksAwarded !== null ? (
                            <span className="bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400 px-2 py-1 rounded font-bold border border-green-200 dark:border-green-800">
                              Graded: {sub.marksAwarded}/{selectedAssignment.maxMarks}
                            </span>
                          ) : (
                            <span className="bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 px-2 py-1 rounded font-bold border border-amber-200 dark:border-amber-800">
                              Pending Evaluation
                            </span>
                          )}
                          {(isTeacher || isAdmin) && (
                            <button
                              onClick={() => {
                                setSelectedSub(sub);
                                setGradeData({ marksAwarded: sub.marksAwarded || 90, remarks: sub.remarks || "" });
                                setShowGradeForm(true);
                              }}
                              className="text-primary hover:underline font-semibold"
                            >
                              Grade
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-gray-400 space-y-2">
              <FileText className="w-12 h-12 mx-auto text-gray-300" />
              <p className="font-medium text-sm">Select an assignment to view details and grading records.</p>
            </div>
          )}
        </div>
      </div>

      {/* Assignment Post Modal */}
      {showAssignForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreateAssignment} className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-md w-full border border-gray-200 dark:border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Post New Assignment</h3>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Title</label>
              <input
                type="text"
                required
                value={assignData.title}
                onChange={(e) => setAssignData({ ...assignData, title: e.target.value })}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Description</label>
              <textarea
                required
                value={assignData.description}
                onChange={(e) => setAssignData({ ...assignData, description: e.target.value })}
                rows={3}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Max Marks</label>
                <input
                  type="number"
                  required
                  value={assignData.maxMarks}
                  onChange={(e) => setAssignData({ ...assignData, maxMarks: parseInt(e.target.value) })}
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Due Date</label>
                <input
                  type="date"
                  required
                  value={assignData.dueDate}
                  onChange={(e) => setAssignData({ ...assignData, dueDate: e.target.value })}
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAssignForm(false)}
                className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="bg-primary hover:bg-primary/95 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60 flex items-center gap-1"
              >
                {isPending && <RefreshCw className="w-4 h-4 animate-spin" />} Post Assignment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grading Form Modal */}
      {showGradeForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleGradeSubmit} className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-md w-full border border-gray-200 dark:border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Evaluate Submission</h3>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Marks Awarded</label>
              <input
                type="number"
                required
                max={selectedAssignment?.maxMarks || 100}
                value={gradeData.marksAwarded}
                onChange={(e) => setGradeData({ ...gradeData, marksAwarded: parseInt(e.target.value) })}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Feedback Remarks</label>
              <input
                type="text"
                value={gradeData.remarks}
                onChange={(e) => setGradeData({ ...gradeData, remarks: e.target.value })}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowGradeForm(false)}
                className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="bg-primary hover:bg-primary/95 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60 flex items-center gap-1"
              >
                {isPending && <RefreshCw className="w-4 h-4 animate-spin" />} Submit Grades
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Student Submit Modal */}
      {showSubmitForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleStudentSubmit} className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-md w-full border border-gray-200 dark:border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Submit Assignment</h3>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Attachment S3 Key / Document Link</label>
              <input
                type="text"
                required
                value={submitData.attachmentS3Key}
                onChange={(e) => setSubmitData({ ...submitData, attachmentS3Key: e.target.value })}
                placeholder="s3://bucket/path/homework.pdf"
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Remarks</label>
              <input
                type="text"
                value={submitData.remarks}
                onChange={(e) => setSubmitData({ ...submitData, remarks: e.target.value })}
                placeholder="Explain details of your submission"
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitForm(false)}
                className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="bg-primary hover:bg-primary/95 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60 flex items-center gap-1"
              >
                {isPending && <RefreshCw className="w-4 h-4 animate-spin" />} Submit Homework
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
