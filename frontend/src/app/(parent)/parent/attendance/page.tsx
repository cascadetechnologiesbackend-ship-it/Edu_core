export const dynamic = "force-dynamic";

import React from "react";
import { getCachedSession } from "@/lib/serverAuth";
import { redirect } from "next/navigation";
import { db, withTenant } from "@/db";
import { studentAttendance } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { CalendarCheck, Calendar } from "lucide-react";
import { resolveParentWards } from "@/lib/parentEventEngine/resolveParentWards";

export const metadata = {
  title: "Child Attendance Calendar | Parent Companion",
  description: "View child monthly attendance calendar, regularity rate, and logs.",
};

export default async function ParentAttendancePage({
  searchParams,
}: {
  searchParams?: { studentId?: string };
}) {
  const session = await getCachedSession();
  if (!session?.user) {
    redirect("/login");
  }

  const schoolId = session.user.schoolId;
  if (!schoolId) {
    redirect("/parent/dashboard");
  }

  const ctx = {
    userId: session.user.id,
    role: session.user.role,
    schoolId,
    email: session.user.email ?? undefined,
  };

  const wards = await resolveParentWards(ctx as any, schoolId, searchParams?.studentId);
  if (wards.length === 0) {
    return (
      <div className="p-6 text-center text-slate-400">
        No linked student records found.
      </div>
    );
  }

  const activeWard = wards[0]!;
  let records: any[] = [];
  await withTenant(schoolId, async () => {
    records = await db.query.studentAttendance.findMany({
      where: eq(studentAttendance.studentId, activeWard.id),
      orderBy: [desc(studentAttendance.attendanceDate)],
      limit: 31,
    });
  });

  const presentCount = records.filter((r) => r.status === "PRESENT").length;
  const attendanceRate = records.length > 0 ? Math.round((presentCount / records.length) * 100) : 100;

  return (
    <div className="space-y-5 p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-rose-400" />
            Attendance Calendar
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {activeWard.fullName} • Class {activeWard.className}
          </p>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-right">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Rate</span>
          <span className="text-sm font-bold text-emerald-400">{attendanceRate}%</span>
        </div>
      </div>

      <div
        data-tour="parent-attendance-calendar"
        className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 sm:p-5 shadow-md space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <Calendar className="w-4 h-4 text-rose-400" />
            <span>Monthly Attendance Logs ({records.length} Recorded Days)</span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-400">{presentCount} Present</span>
        </div>

        {records.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No attendance records marked for this month yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {records.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs"
              >
                <span className="text-slate-300 font-mono">
                  {new Date(r.attendanceDate).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    weekday: "short",
                  })}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    r.status === "PRESENT"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  }`}
                >
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
