"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import {
  getQuestionPapersWorkspaceData,
  createBlueprint,
  assembleQuestionPaper,
  getAnswerKeyPreview,
  submitPaperForModeration,
} from "./actions";

type WorkspaceData = Awaited<
  ReturnType<typeof getQuestionPapersWorkspaceData>
>;
type AnswerKeyRow = Awaited<ReturnType<typeof getAnswerKeyPreview>>[number];

export default function TeacherQuestionPapersPage() {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Blueprint form
  const [bpName, setBpName] = useState("");
  const [bpClassId, setBpClassId] = useState("");
  const [bpSubjectId, setBpSubjectId] = useState("");
  const [bpTotalMarks, setBpTotalMarks] = useState(80);
  const [bpDuration, setBpDuration] = useState(180);

  // Paper assembly form
  const [paperTitle, setPaperTitle] = useState("");
  const [selectedBlueprintId, setSelectedBlueprintId] = useState("");
  const [paperClassId, setPaperClassId] = useState("");
  const [paperSubjectId, setPaperSubjectId] = useState("");
  const [setCode, setSetCode] = useState<"A" | "B" | "C">("A");
  const [paperTotalMarks, setPaperTotalMarks] = useState(80);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  // Answer key preview
  const [previewPaperId, setPreviewPaperId] = useState<string | null>(null);
  const [answerKeyRows, setAnswerKeyRows] = useState<AnswerKeyRow[]>([]);

  const loadWorkspace = useCallback(() => {
    startTransition(async () => {
      try {
        const res = await getQuestionPapersWorkspaceData();
        setData(res);
        if (!bpClassId && res.classes[0]) setBpClassId(res.classes[0].id);
        if (!bpSubjectId && res.subjects[0]) setBpSubjectId(res.subjects[0].id);
        if (!paperClassId && res.classes[0]) setPaperClassId(res.classes[0].id);
        if (!paperSubjectId && res.subjects[0])
          setPaperSubjectId(res.subjects[0].id);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load workspace",
        );
      }
    });
  }, [bpClassId, bpSubjectId, paperClassId, paperSubjectId]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const handleCreateBlueprint = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createBlueprint({
        name: bpName,
        classId: bpClassId,
        subjectId: bpSubjectId,
        totalMarks: Number(bpTotalMarks),
        durationMinutes: Number(bpDuration),
        sections: [
          {
            label: "Section A",
            questionCount: 10,
            marksPerQuestion: 1,
          },
        ],
      });
      if (!res.success) {
        setError(res.error ?? "Failed to create blueprint");
        return;
      }
      setBpName("");
      setMessage("Blueprint created.");
      loadWorkspace();
    });
  };

  const toggleQuestion = (id: string) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(id) ? prev.filter((q) => q !== id) : [...prev, id],
    );
  };

  const selectedQuestions = (data?.bankQuestions ?? []).filter((q) =>
    selectedQuestionIds.includes(q.id),
  );
  const selectedMarksSum = selectedQuestions.reduce(
    (sum, q) => sum + Number(q.maxMarks || 0),
    0,
  );

  const handleAssemblePaper = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await assembleQuestionPaper({
        title: paperTitle,
        blueprintId: selectedBlueprintId || null,
        classId: paperClassId,
        subjectId: paperSubjectId,
        setCode,
        totalMarks: Number(paperTotalMarks),
        durationMinutes: Number(bpDuration),
        items: selectedQuestions.map((q, idx) => ({
          questionId: q.id,
          sectionLabel: "Section A",
          orderIndex: idx + 1,
          marks: Number(q.maxMarks || 1),
          isOptional: false,
        })),
      });
      if (!res.success) {
        setError(res.error ?? "Failed to assemble paper");
        return;
      }
      setPaperTitle("");
      setSelectedQuestionIds([]);
      setMessage("Question paper assembled.");
      loadWorkspace();
    });
  };

  const handlePreviewAnswerKey = (paperId: string) => {
    startTransition(async () => {
      const rows = await getAnswerKeyPreview(paperId);
      setPreviewPaperId(paperId);
      setAnswerKeyRows(rows);
    });
  };

  const handleSubmitModeration = (paperId: string) => {
    startTransition(async () => {
      await submitPaperForModeration(paperId);
      setMessage("Paper submitted for moderation.");
      loadWorkspace();
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Question Paper Builder &amp; Blueprints
        </h1>
        <p className="text-sm text-slate-600">
          Define exam blueprints, assemble papers from the Question Bank,
          preview Answer Keys, and submit for moderation.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Create Blueprint */}
        <form
          onSubmit={handleCreateBlueprint}
          className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-slate-900">
            1. Create Blueprint
          </h2>
          <input
            type="text"
            required
            placeholder="Blueprint name (e.g. Term 1 Science Blueprint)"
            value={bpName}
            onChange={(e) => setBpName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={bpClassId}
              onChange={(e) => setBpClassId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {(data?.classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={bpSubjectId}
              onChange={(e) => setBpSubjectId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {(data?.subjects ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              min={1}
              value={bpTotalMarks}
              onChange={(e) => setBpTotalMarks(Number(e.target.value))}
              placeholder="Total Marks"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={15}
              value={bpDuration}
              onChange={(e) => setBpDuration(Number(e.target.value))}
              placeholder="Duration (mins)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Save Blueprint
          </button>
        </form>

        {/* Assemble Paper */}
        <form
          onSubmit={handleAssemblePaper}
          className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-slate-900">
            2. Assemble Question Paper
          </h2>
          <input
            type="text"
            required
            placeholder="Paper Title (e.g. Half-Yearly Science Set A)"
            value={paperTitle}
            onChange={(e) => setPaperTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-3 gap-3">
            <select
              value={selectedBlueprintId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedBlueprintId(id);
                const bp = data?.blueprints.find((b) => b.id === id);
                if (bp) {
                  setPaperTotalMarks(bp.totalMarks);
                  setPaperClassId(bp.classId);
                  setPaperSubjectId(bp.subjectId);
                }
              }}
              className="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select Blueprint (Optional)</option>
              {(data?.blueprints ?? []).map((bp) => (
                <option key={bp.id} value={bp.id}>
                  {bp.name} ({bp.totalMarks}m)
                </option>
              ))}
            </select>
            <select
              value={setCode}
              onChange={(e) => setSetCode(e.target.value as "A" | "B" | "C")}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="A">Set A</option>
              <option value="B">Set B</option>
              <option value="C">Set C</option>
            </select>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              Selected: {selectedQuestionIds.length} questions (
              {selectedMarksSum} marks)
            </span>
            <span>Target: {paperTotalMarks} marks</span>
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {(data?.bankQuestions ?? []).map((q) => (
              <label
                key={q.id}
                className="flex cursor-pointer items-start gap-2 rounded p-1.5 text-xs hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selectedQuestionIds.includes(q.id)}
                  onChange={() => toggleQuestion(q.id)}
                  className="mt-0.5"
                />
                <span className="flex-1 text-slate-800">
                  [{q.questionType} · {q.maxMarks}m] {q.questionText}
                </span>
              </label>
            ))}
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Assemble Paper
          </button>
        </form>
      </div>

      {/* Assembled Papers */}
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Assembled Question Papers
        </h2>
        {(data?.papers ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No question papers yet.</p>
        ) : (
          <div className="space-y-2">
            {(data?.papers ?? []).map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {p.title} (Set {p.setCode})
                  </p>
                  <p className="text-xs text-slate-600">
                    {p.totalMarks} Marks · {p.durationMinutes} mins · Status:{" "}
                    {p.status}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePreviewAnswerKey(p.id)}
                    className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Answer Key &amp; Marking Scheme
                  </button>
                  {p.status === "DRAFT" && (
                    <button
                      type="button"
                      onClick={() => handleSubmitModeration(p.id)}
                      className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                    >
                      Submit for Moderation
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Answer Key & Marking Scheme Preview */}
      {previewPaperId && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              Answer Key &amp; Marking Scheme Preview
            </h2>
            <button
              type="button"
              onClick={() => setPreviewPaperId(null)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Close
            </button>
          </div>
          {answerKeyRows.length === 0 ? (
            <p className="text-sm text-slate-500">No items in this paper.</p>
          ) : (
            <div className="space-y-2">
              {answerKeyRows.map((row) => (
                <div
                  key={row.id}
                  className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs"
                >
                  <p className="font-medium text-slate-900">
                    Q{row.orderIndex} ({row.sectionLabel} · {row.marks}m):{" "}
                    {row.questionText}
                  </p>
                  <p className="mt-1 text-emerald-700">
                    Answer: {row.correctAnswer || "—"}
                  </p>
                  <p className="text-slate-600">
                    Marking Scheme: {row.markingScheme || "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
