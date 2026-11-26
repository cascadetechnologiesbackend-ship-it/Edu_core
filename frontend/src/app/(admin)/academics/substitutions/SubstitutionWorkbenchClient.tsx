"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, UserCheck, XCircle, AlertTriangle } from "lucide-react";
import {
  createSubstitution,
  updateSubstitutionStatus,
} from "../actions/timetable.actions";

export interface UncoveredPeriodItem {
  periodId: string;
  periodNumber: number;
  startTime: string;
  endTime: string;
  sectionId: string;
  sectionLabel: string;
  subjectId: string | null;
  subjectName: string;
  originalTeacherUserId: string;
  originalTeacherName: string;
}

export interface ExistingSubstitutionItem {
  id: string;
  date: string;
  timetablePeriodId: string;
  periodLabel: string;
  sectionLabel: string;
  subjectName: string;
  originalTeacherName: string;
  substituteTeacherId: string | null;
  substituteTeacherName: string | null;
  status: string;
  reason: string | null;
}

export interface AvailableTeacherOption {
  userId: string;
  name: string;
  employeeCode: string | null;
}

interface SubstitutionWorkbenchClientProps {
  todayIso: string;
  uncoveredPeriods: UncoveredPeriodItem[];
  existingSubstitutions: ExistingSubstitutionItem[];
  availableTeachers: AvailableTeacherOption[];
}

export function SubstitutionWorkbenchClient({
  todayIso,
  uncoveredPeriods,
  existingSubstitutions,
  availableTeachers,
}: SubstitutionWorkbenchClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedTeacherByPeriod, setSelectedTeacherByPeriod] = useState<Record<string, string>>({});
  const [selectedTeacherBySub, setSelectedTeacherBySub] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const handleAssignNew = (item: UncoveredPeriodItem) => {
    const substituteTeacherId = selectedTeacherByPeriod[item.periodId];
    if (!substituteTeacherId) {
      setFeedback({ type: "err", text: "Please select an available substitute teacher first." });
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      try {
        await createSubstitution({
          date: todayIso,
          timetablePeriodId: item.periodId,
          sectionId: item.sectionId,
          originalTeacherId: item.originalTeacherUserId,
          substituteTeacherId,
          subjectId: item.subjectId,
          reason: "Teacher on approved leave",
        });
        setFeedback({
          type: "ok",
          text: `Assigned substitute for ${item.sectionLabel} (Period ${item.periodNumber}).`,
        });
        router.refresh();
      } catch (err: any) {
        setFeedback({
          type: "err",
          text: err?.message || "Failed to assign substitute.",
        });
      }
    });
  };

  const handleUpdateStatus = (
    subId: string,
    status: "CONFIRMED" | "CANCELLED",
    explicitTeacherId?: string
  ) => {
    setFeedback(null);
    startTransition(async () => {
      try {
        await updateSubstitutionStatus(subId, status, explicitTeacherId);
        setFeedback({
          type: "ok",
          text: status === "CONFIRMED" ? "Substitution confirmed." : "Substitution cancelled.",
        });
        router.refresh();
      } catch (err: any) {
        setFeedback({
          type: "err",
          text: err?.message || "Failed to update substitution.",
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium flex items-center gap-2 ${
            feedback.type === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
          }`}
        >
          {feedback.type === "ok" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Uncovered Periods Today */}
      <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-level-1 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" /> Uncovered Periods Today ({uncoveredPeriods.length})
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Periods scheduled for teachers on approved leave without a confirmed substitution.
            </p>
          </div>
        </div>

        {uncoveredPeriods.length === 0 ? (
          <div className="rounded-xl border border-border/50 bg-background/60 p-6 text-center text-sm text-muted-foreground">
            All scheduled periods for absent teachers are covered today.
          </div>
        ) : (
          <div className="space-y-3">
            {uncoveredPeriods.map((item) => (
              <div
                key={item.periodId}
                className="rounded-xl border border-border/60 bg-background/60 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                      Period {item.periodNumber} ({item.startTime}–{item.endTime})
                    </span>
                    <span className="text-sm font-bold text-foreground">{item.sectionLabel}</span>
                    <span className="text-xs text-muted-foreground">· {item.subjectName}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Absent Teacher:{" "}
                    <span className="font-medium text-foreground">{item.originalTeacherName}</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedTeacherByPeriod[item.periodId] ?? ""}
                    onChange={(e) =>
                      setSelectedTeacherByPeriod((prev) => ({
                        ...prev,
                        [item.periodId]: e.target.value,
                      }))
                    }
                    disabled={isPending}
                    className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground min-w-[200px]"
                  >
                    <option value="">Select substitute teacher…</option>
                    {availableTeachers
                      .filter((t) => t.userId !== item.originalTeacherUserId)
                      .map((t) => (
                        <option key={t.userId} value={t.userId}>
                          {t.name} {t.employeeCode ? `(${t.employeeCode})` : ""}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    disabled={isPending || !selectedTeacherByPeriod[item.periodId]}
                    onClick={() => handleAssignNew(item)}
                    className="px-3.5 py-1.5 rounded-lg bg-semantic-interactive hover:bg-semantic-interactive/90 text-white text-xs font-semibold disabled:opacity-50 transition"
                  >
                    Assign &amp; Confirm
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Today's Substitution Log */}
      <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-level-1 space-y-4">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-500" /> Today&apos;s Substitutions ({existingSubstitutions.length})
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Confirm pending substitutions or reassign coverage as needed.
          </p>
        </div>

        {existingSubstitutions.length === 0 ? (
          <div className="rounded-xl border border-border/50 bg-background/60 p-6 text-center text-sm text-muted-foreground">
            No substitutions recorded for {todayIso}.
          </div>
        ) : (
          <div className="space-y-3">
            {existingSubstitutions.map((sub) => (
              <div
                key={sub.id}
                className="rounded-xl border border-border/60 bg-background/60 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                        sub.status === "CONFIRMED"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : sub.status === "CANCELLED"
                            ? "bg-muted text-muted-foreground"
                            : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      }`}
                    >
                      {sub.status}
                    </span>
                    <span className="text-sm font-bold text-foreground">{sub.sectionLabel}</span>
                    <span className="text-xs text-muted-foreground">
                      · {sub.periodLabel} · {sub.subjectName}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Original: <span className="font-medium text-foreground">{sub.originalTeacherName}</span>
                    {" → "}
                    Substitute:{" "}
                    <span className="font-medium text-foreground">
                      {sub.substituteTeacherName || "Unassigned"}
                    </span>
                  </p>
                </div>

                {sub.status === "PENDING" && (
                  <div className="flex flex-wrap items-center gap-2">
                    {!sub.substituteTeacherId && (
                      <select
                        value={selectedTeacherBySub[sub.id] ?? ""}
                        onChange={(e) =>
                          setSelectedTeacherBySub((prev) => ({
                            ...prev,
                            [sub.id]: e.target.value,
                          }))
                        }
                        disabled={isPending}
                        className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground min-w-[180px]"
                      >
                        <option value="">Select substitute…</option>
                        {availableTeachers.map((t) => (
                          <option key={t.userId} value={t.userId}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      disabled={isPending || (!sub.substituteTeacherId && !selectedTeacherBySub[sub.id])}
                      onClick={() =>
                        handleUpdateStatus(
                          sub.id,
                          "CONFIRMED",
                          sub.substituteTeacherId ? undefined : selectedTeacherBySub[sub.id]
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50 transition"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleUpdateStatus(sub.id, "CANCELLED")}
                      className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs font-medium text-foreground disabled:opacity-50 transition inline-flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
