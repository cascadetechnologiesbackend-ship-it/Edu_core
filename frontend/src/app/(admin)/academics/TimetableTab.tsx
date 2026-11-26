"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { getSectionTimetable, getTeacherLeaveStatusForDate } from "./actions/timetable.actions";
import { Calendar, RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import { QuickTimetable, TimetableRecord } from "@/components/academics/QuickTimetable";

type Classroom = {
  id: string;
  displayName: string;
  sections: {
    id: string;
    name: string;
  }[];
};

type Subject = {
  id: string;
  name: string;
  code: string;
};

type Teacher = {
  id: string;
  email: string;
  name?: string | undefined;
};

export default function TimetableTab({
  classrooms,
  subjects,
  teachers,
  isAdmin,
}: {
  classrooms: Classroom[];
  subjects: Subject[];
  teachers: Teacher[];
  isAdmin: boolean;
}) {
  const [selectedSection, setSelectedSection] = useState("");
  const [timetable, setTimetable] = useState<TimetableRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [leaveMap, setLeaveMap] = useState<Record<string, { isOnLeave: boolean; leaveEndDate?: string }>>({});

  useEffect(() => {
    getTeacherLeaveStatusForDate()
      .then((res) => setLeaveMap(res || {}))
      .catch(() => {});
  }, []);

  const teachersWithLeave = useMemo(() => {
    return teachers.map((t) => {
      const leave = leaveMap[t.id];
      const baseName = t.name || t.email;
      return {
        ...t,
        name: leave?.isOnLeave ? `${baseName} (On Leave)` : baseName,
        isOnLeave: Boolean(leave?.isOnLeave),
      };
    });
  }, [teachers, leaveMap]);

  const onLeaveCount = useMemo(
    () => teachersWithLeave.filter((t) => t.isOnLeave).length,
    [teachersWithLeave],
  );

  // Default section selection
  useEffect(() => {
    const defaultSectionId = classrooms[0]?.sections?.[0]?.id;
    if (defaultSectionId && !selectedSection) {
      setSelectedSection(defaultSectionId);
    }
  }, [classrooms, selectedSection]);

  // Load section timetable
  const fetchTimetable = async (secId: string) => {
    if (!secId) return;
    setLoading(true);
    try {
      const data = await getSectionTimetable(secId);
      setTimetable(data as any);
    } catch (err) {
      console.error("Failed to load section timetable:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSection) {
      fetchTimetable(selectedSection);
    }
  }, [selectedSection]);

  const currentClass = useMemo(() => {
    return classrooms.find((c) =>
      c.sections.some((s) => s.id === selectedSection),
    );
  }, [classrooms, selectedSection]);

  const allSectionsInClass = useMemo(() => {
    return currentClass?.sections || [];
  }, [currentClass]);

  const classSubjectsFormatted = useMemo(() => {
    return subjects.map((s) => ({
      id: s.id,
      subjectId: s.id,
      subject: {
        id: s.id,
        name: s.name,
        code: s.code,
      },
    }));
  }, [subjects]);

  return (
    <div className="space-y-6">
      {/* Header and Classroom filter */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-card border border-gray-200 dark:border-border/40 p-4 rounded-2xl shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <span>Weekly Timetable Workbench</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Quick-fill weekly schedules, auto-assign teachers, and copy between days and sections.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-gray-500 uppercase whitespace-nowrap">
            Classroom:
          </label>
          <select
            value={currentClass?.id || ""}
            onChange={(e) => {
              const cls = classrooms.find((c) => c.id === e.target.value);
              const firstSec = cls?.sections[0]?.id;
              if (firstSec) {
                setSelectedSection(firstSec);
              }
            }}
            className="rounded-xl border border-gray-300 dark:border-border/40 bg-card px-3 py-2 text-xs font-bold text-gray-800 dark:text-gray-100 focus:ring-1 focus:ring-primary min-h-[38px]"
          >
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>

          {loading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        </div>
      </div>

      {onLeaveCount > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>{onLeaveCount}</strong> faculty member{onLeaveCount === 1 ? " is" : "s are"} on approved leave today. Leave status is flagged in teacher selectors and blocked from substitution assignment.
          </span>
        </div>
      )}

      {selectedSection && currentClass ? (
        <QuickTimetable
          classId={currentClass.id}
          sectionId={selectedSection}
          sections={allSectionsInClass}
          classSubjects={classSubjectsFormatted}
          teachers={teachersWithLeave}
          timetable={timetable}
          isAdmin={isAdmin}
          onSectionChange={(newSecId) => setSelectedSection(newSecId)}
          onTimetableChanged={() => fetchTimetable(selectedSection)}
        />
      ) : (
        <div className="py-12 text-center text-xs text-gray-500 bg-card border border-gray-200 dark:border-border/40 rounded-2xl">
          No classroom or section available.
        </div>
      )}
    </div>
  );
}
