"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import {
  getQuestionBankData,
  saveQuestionBankItem,
  updateQuestionReviewStatus,
  type QuestionBankFilters,
  type QuestionTypeValue,
  type DifficultyValue,
  type CognitiveLevelValue,
  type ReviewStatusValue,
} from "./actions";

const QUESTION_TYPES: QuestionTypeValue[] = [
  "MCQ",
  "MSQ",
  "TRUE_FALSE",
  "FILL_BLANK",
  "MATCH",
  "VSA",
  "SA",
  "LA",
  "CASE_BASED",
  "SOURCE_BASED",
  "DIAGRAM",
  "NUMERICAL",
  "PRACTICAL",
];

const DIFFICULTIES: DifficultyValue[] = ["EASY", "MEDIUM", "HARD"];
const COGNITIVE_LEVELS: CognitiveLevelValue[] = [
  "REMEMBER",
  "UNDERSTAND",
  "APPLY",
  "ANALYZE",
  "EVALUATE",
  "CREATE",
];
const REVIEW_STATUSES: ReviewStatusValue[] = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
];

type QuestionRow = Awaited<
  ReturnType<typeof getQuestionBankData>
>["questions"][number];
type OptionItem = { id: string; name?: string; title?: string };

export default function TeacherQuestionBankPage() {
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [classes, setClasses] = useState<OptionItem[]>([]);
  const [subjects, setSubjects] = useState<OptionItem[]>([]);
  const [chapters, setChapters] = useState<OptionItem[]>([]);
  const [filters, setFilters] = useState<QuestionBankFilters>({});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    board: "CBSE",
    classId: "",
    subjectId: "",
    syllabusChapterId: "",
    learningOutcome: "",
    questionType: "MCQ" as QuestionTypeValue,
    questionText: "",
    optionsText: "",
    correctAnswer: "",
    markingScheme: "",
    explanation: "",
    maxMarks: 1,
    difficulty: "MEDIUM" as DifficultyValue,
    cognitiveLevel: "UNDERSTAND" as CognitiveLevelValue,
    competencyTag: "",
    language: "en",
  });

  const loadData = useCallback((nextFilters: QuestionBankFilters) => {
    startTransition(async () => {
      try {
        const res = await getQuestionBankData(nextFilters);
        setQuestions(res.questions);
        setClasses(res.classes);
        setSubjects(res.subjects);
        setChapters(res.chapters);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load question bank",
        );
      }
    });
  }, []);

  useEffect(() => {
    loadData(filters);
  }, [filters, loadData]);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      board: "CBSE",
      classId: classes[0]?.id ?? "",
      subjectId: subjects[0]?.id ?? "",
      syllabusChapterId: "",
      learningOutcome: "",
      questionType: "MCQ",
      questionText: "",
      optionsText: "",
      correctAnswer: "",
      markingScheme: "",
      explanation: "",
      maxMarks: 1,
      difficulty: "MEDIUM",
      cognitiveLevel: "UNDERSTAND",
      competencyTag: "",
      language: "en",
    });
    setShowForm(true);
  };

  const openEdit = (q: QuestionRow) => {
    setEditingId(q.id);
    const opts = Array.isArray(q.optionsJson)
      ? (q.optionsJson as string[]).join("\n")
      : "";
    setForm({
      board: q.board ?? "CBSE",
      classId: q.classId,
      subjectId: q.subjectId,
      syllabusChapterId: q.syllabusChapterId ?? "",
      learningOutcome: q.learningOutcome ?? "",
      questionType: q.questionType,
      questionText: q.questionText,
      optionsText: opts,
      correctAnswer: q.correctAnswer ?? "",
      markingScheme: q.markingScheme ?? "",
      explanation: q.explanation ?? "",
      maxMarks: Number(q.maxMarks) || 1,
      difficulty: q.difficulty,
      cognitiveLevel: q.cognitiveLevel,
      competencyTag: q.competencyTag ?? "",
      language: q.language ?? "en",
    });
    setShowForm(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveQuestionBankItem({
        id: editingId ?? undefined,
        board: form.board,
        classId: form.classId,
        subjectId: form.subjectId,
        syllabusChapterId: form.syllabusChapterId || null,
        learningOutcome: form.learningOutcome,
        questionType: form.questionType,
        questionText: form.questionText,
        optionsJson: form.optionsText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        correctAnswer: form.correctAnswer,
        markingScheme: form.markingScheme,
        explanation: form.explanation,
        maxMarks: Number(form.maxMarks),
        difficulty: form.difficulty,
        cognitiveLevel: form.cognitiveLevel,
        competencyTag: form.competencyTag,
        language: form.language,
      });
      if (!res.success) {
        setError(res.error ?? "Failed to save question");
        return;
      }
      setShowForm(false);
      loadData(filters);
    });
  };

  const handleStatusChange = (id: string, status: ReviewStatusValue) => {
    startTransition(async () => {
      await updateQuestionReviewStatus(id, status);
      loadData(filters);
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Question Bank (NCERT / PARAKH)
          </h1>
          <p className="text-sm text-slate-600">
            Create, tag, and review competency-aligned questions for paper
            assembly.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + Add Question
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
        <input
          type="text"
          placeholder="Search question or outcome..."
          value={filters.search ?? ""}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm lg:col-span-2"
        />
        <select
          value={filters.subjectId ?? ""}
          onChange={(e) =>
            setFilters({ ...filters, subjectId: e.target.value || undefined })
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={filters.chapterId ?? ""}
          onChange={(e) =>
            setFilters({ ...filters, chapterId: e.target.value || undefined })
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Chapters</option>
          {chapters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <select
          value={filters.questionType ?? ""}
          onChange={(e) =>
            setFilters({
              ...filters,
              questionType: (e.target.value as QuestionTypeValue) || "",
            })
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Types</option>
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={filters.difficulty ?? ""}
          onChange={(e) =>
            setFilters({
              ...filters,
              difficulty: (e.target.value as DifficultyValue) || "",
            })
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Difficulties</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Competency tag..."
          value={filters.competencyTag ?? ""}
          onChange={(e) =>
            setFilters({ ...filters, competencyTag: e.target.value })
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={filters.reviewStatus ?? ""}
          onChange={(e) =>
            setFilters({
              ...filters,
              reviewStatus: (e.target.value as ReviewStatusValue) || "",
            })
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          {REVIEW_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <form
          onSubmit={handleSave}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              {editingId ? "Edit Question" : "New Question"}
            </h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <select
              required
              value={form.classId}
              onChange={(e) => setForm({ ...form, classId: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select Class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              required
              value={form.subjectId}
              onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select Subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={form.syllabusChapterId}
              onChange={(e) =>
                setForm({ ...form, syllabusChapterId: e.target.value })
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Chapter (Optional)</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <select
              value={form.questionType}
              onChange={(e) =>
                setForm({
                  ...form,
                  questionType: e.target.value as QuestionTypeValue,
                })
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {QUESTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              value={form.difficulty}
              onChange={(e) =>
                setForm({
                  ...form,
                  difficulty: e.target.value as DifficultyValue,
                })
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={form.cognitiveLevel}
              onChange={(e) =>
                setForm({
                  ...form,
                  cognitiveLevel: e.target.value as CognitiveLevelValue,
                })
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {COGNITIVE_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={form.maxMarks}
              onChange={(e) =>
                setForm({ ...form, maxMarks: Number(e.target.value) })
              }
              placeholder="Max Marks"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <textarea
            required
            rows={3}
            placeholder="Question text..."
            value={form.questionText}
            onChange={(e) => setForm({ ...form, questionText: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <textarea
              rows={2}
              placeholder="Options (one per line, for MCQ/MSQ)..."
              value={form.optionsText}
              onChange={(e) =>
                setForm({ ...form, optionsText: e.target.value })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <textarea
              rows={2}
              placeholder="Correct Answer / Key..."
              value={form.correctAnswer}
              onChange={(e) =>
                setForm({ ...form, correctAnswer: e.target.value })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Marking Scheme (e.g. 1 mark formula + 1 mark substitution)"
              value={form.markingScheme}
              onChange={(e) =>
                setForm({ ...form, markingScheme: e.target.value })
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Competency Tag (e.g. C-1.2, Critical Thinking)"
              value={form.competencyTag}
              onChange={(e) =>
                setForm({ ...form, competencyTag: e.target.value })
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Save Question"}
            </button>
          </div>
        </form>
      )}

      {/* Question List */}
      <div className="space-y-3">
        {questions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No questions match the current filters.
          </div>
        ) : (
          questions.map((q) => (
            <div
              key={q.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                      {q.questionType}
                    </span>
                    <span className="rounded bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                      {q.difficulty}
                    </span>
                    <span className="rounded bg-purple-50 px-2 py-0.5 font-medium text-purple-700">
                      {q.cognitiveLevel}
                    </span>
                    <span className="rounded bg-amber-50 px-2 py-0.5 font-medium text-amber-800">
                      {q.maxMarks} Marks
                    </span>
                    {q.competencyTag && (
                      <span className="rounded bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                        {q.competencyTag}
                      </span>
                    )}
                    <span className="rounded bg-slate-200 px-2 py-0.5 font-medium text-slate-800">
                      {q.reviewStatus}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-900">
                    {q.questionText}
                  </p>
                  {q.correctAnswer && (
                    <p className="text-xs text-slate-600">
                      Answer: {q.correctAnswer}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(q)}
                    className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  {q.reviewStatus === "DRAFT" && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(q.id, "SUBMITTED")}
                      className="rounded bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                    >
                      Submit
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
