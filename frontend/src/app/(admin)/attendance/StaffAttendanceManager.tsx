"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { markStaffAttendanceAction } from "./staffActions";

export interface StaffAttendanceRow {
  staffId: string;
  name: string;
  employeeCode: string | null;
  designationName: string | null;
  status: "PRESENT" | "ABSENT" | "HALF_DAY" | "ON_LEAVE";
}

interface StaffAttendanceManagerProps {
  dateStr: string;
  initialRows: StaffAttendanceRow[];
}

export function StaffAttendanceManager({ dateStr, initialRows }: StaffAttendanceManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<StaffAttendanceRow[]>(initialRows);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const handleStatusChange = (
    staffId: string,
    status: "PRESENT" | "ABSENT" | "HALF_DAY" | "ON_LEAVE"
  ) => {
    setRows((prev) => prev.map((r) => (r.staffId === staffId ? { ...r, status } : r)));
  };

  const handleSave = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await markStaffAttendanceAction({
        dateStr,
        records: rows.map((r) => ({ staffId: r.staffId, status: r.status })),
      });
      if (res.success) {
        setFeedback({ type: "ok", text: res.message });
        router.refresh();
      } else {
        setFeedback({ type: "err", text: res.message });
      }
    });
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-level-1 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">Staff Attendance ({dateStr})</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Mark daily attendance for active teaching and non-teaching staff.
          </p>
        </div>
        <button
          type="button"
          disabled={isPending || rows.length === 0}
          onClick={handleSave}
          className="px-4 py-2 rounded-xl bg-semantic-interactive hover:bg-semantic-interactive/90 text-white text-xs font-semibold disabled:opacity-50 transition"
        >
          {isPending ? "Saving…" : "Save Staff Attendance"}
        </button>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-xs font-medium flex items-center gap-2 ${
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

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No active staff found.</p>
      ) : (
        <div className="divide-y divide-border/50">
          {rows.map((r) => (
            <div
              key={r.staffId}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div>
                <p className="text-sm font-semibold text-foreground">{r.name}</p>
                <p className="text-xs text-muted-foreground">
                  {r.employeeCode || "No Code"} {r.designationName ? `· ${r.designationName}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {(["PRESENT", "ABSENT", "HALF_DAY", "ON_LEAVE"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    disabled={isPending}
                    onClick={() => handleStatusChange(r.staffId, st)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                      r.status === st
                        ? st === "PRESENT"
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : st === "ABSENT"
                            ? "bg-rose-600 text-white border-rose-600"
                            : "bg-amber-600 text-white border-amber-600"
                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {st.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
