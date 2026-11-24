"use client";

import { useState, useTransition } from "react";
import { createExamType, deleteExamType } from "./actions";

interface ExamTypeItem {
  id: string;
  name: string;
  code: string;
  examType: string;
  weightagePercent: string | null;
  isActive: boolean;
}

interface ExamTypesListProps {
  initialExamTypes: ExamTypeItem[];
}

export function ExamTypesList({ initialExamTypes }: ExamTypesListProps) {
  const [examTypesList, setExamTypesList] =
    useState<ExamTypeItem[]>(initialExamTypes);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const formEl = e.currentTarget;

    startTransition(async () => {
      setMessage("");
      const res = await createExamType(formData);
      if (res.success) {
        setMessage("✓ Exam Type created successfully!");
        formEl.reset();
        window.location.reload();
      } else {
        setMessage(`✗ ${res.message}`);
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this Exam Type?")) return;

    startTransition(async () => {
      setMessage("");
      const res = await deleteExamType(id);
      if (res.success) {
        setMessage("✓ Exam Type deleted successfully!");
        setExamTypesList((prev) => prev.filter((item) => item.id !== id));
      } else {
        setMessage(`✗ ${res.message}`);
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Creation Form */}
      <div className="bg-card rounded-xl border border-border/40 p-6 h-fit space-y-6">
        <div>
          <h2 className="font-semibold text-lg">Add Exam Type</h2>
          <p className="text-sm text-gray-500">
            Define a new category of exams for weightage and grading.
          </p>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              name="name"
              required
              placeholder="e.g., Unit Test 1"
              className="w-full rounded-md border border-border/60 bg-transparent px-3 py-2 text-sm focus:ring-1 focus:ring-[#007AFF] dark:focus:ring-[#0A84FF]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Code *</label>
            <input
              name="code"
              required
              placeholder="e.g., UT-1"
              className="w-full rounded-md border border-border/60 bg-transparent px-3 py-2 text-sm uppercase"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Standard Type *
            </label>
            <select
              name="examType"
              required
              className="w-full rounded-md border border-border/60 bg-transparent px-3 py-2 text-sm"
            >
              <option value="UNIT_TEST">Unit Test</option>
              <option value="HALF_YEARLY">Half Yearly</option>
              <option value="ANNUAL">Annual</option>
              <option value="PRE_BOARD">Pre Board</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Weightage % *
            </label>
            <input
              type="number"
              name="weightagePercent"
              required
              min={0}
              max={100}
              step={0.5}
              placeholder="e.g., 10"
              className="w-full rounded-md border border-border/60 bg-transparent px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full min-h-[44px] bg-[#007AFF] hover:bg-[#0062cc] dark:bg-[#0A84FF] dark:hover:bg-[#0071e3] text-white dark:text-black py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50 shadow-sm"
          >
            {isPending ? "Creating..." : "Create Exam Type"}
          </button>
        </form>

        {message && (
          <div
            className={`p-3 rounded-md text-sm ${
              message.startsWith("✓")
                ? "bg-green-50 border border-green-200 text-green-700"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}
          >
            {message}
          </div>
        )}
      </div>

      {/* List */}
      <div className="lg:col-span-2 bg-card rounded-xl border border-border/40 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border/40 bg-muted/40">
          <h2 className="font-semibold text-foreground">
            Configured Exam Types
          </h2>
        </div>

        {examTypesList.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No exam types configured yet. Use the form on the left to add one.
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {examTypesList.map((item) => (
              <div
                key={item.id}
                className="p-4 flex justify-between items-center hover:bg-muted/40"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-foreground">
                      {item.name}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-muted/60 text-muted-foreground">
                      {item.code}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Type: {item.examType} | Weightage: {item.weightagePercent}%
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  disabled={isPending}
                  className="text-xs min-h-[36px] bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 px-3 py-1.5 rounded-xl font-medium transition-colors"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
