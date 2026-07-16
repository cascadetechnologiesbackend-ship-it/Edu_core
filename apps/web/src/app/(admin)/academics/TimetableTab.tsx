"use client";

import { useState, useEffect, useTransition } from "react";
import { getSectionTimetable, saveTimetablePeriod } from "./actions";
import { Calendar, Plus, RefreshCw, AlertCircle, Eye } from "lucide-react";

type TimetableRecord = {
  id: string;
  dayOfWeek: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY";
  periodNumber: number;
  startTime: string;
  endTime: string;
  periodType: "REGULAR" | "ASSEMBLY" | "BREAK" | "LUNCH" | "LAB" | "PT" | "LIBRARY" | "FREE";
  subjectId: string | null;
  teacherId: string | null;
  roomNumber: string | null;
  subject?: {
    name: string;
    code: string;
  } | null;
};

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
};

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;
const PERIOD_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8];

const PERIOD_TIMES = [
  { num: 1, start: "08:00", end: "08:45" },
  { num: 2, start: "08:45", end: "09:30" },
  { num: 3, start: "09:30", end: "10:15" },
  { num: 4, start: "10:30", end: "11:15" }, // after 15 min recess
  { num: 5, start: "11:15", end: "12:00" },
  { num: 6, start: "12:00", end: "12:45" },
  { num: 7, start: "13:30", end: "14:15" }, // after lunch
  { num: 8, start: "14:15", end: "15:00" },
];

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
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [cellData, setCellData] = useState({
    id: "",
    dayOfWeek: "MONDAY" as any,
    periodNumber: 1,
    startTime: "08:00",
    endTime: "08:45",
    periodType: "REGULAR" as any,
    subjectId: "",
    teacherId: "",
    roomNumber: "",
  });

  // Handle section select defaults
  useEffect(() => {
    const defaultSectionId = classrooms[0]?.sections?.[0]?.id;
    if (defaultSectionId) {
      setSelectedSection(defaultSectionId);
    }
  }, [classrooms]);

  // Load timetable on section change
  useEffect(() => {
    if (!selectedSection) return;
    setLoading(true);
    getSectionTimetable(selectedSection)
      .then((data) => {
        setTimetable(data as any);
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedSection]);

  const handleCellClick = (day: string, periodNum: number) => {
    if (!isAdmin) return;
    setErrorMsg("");
    const existing = timetable.find((t) => t.dayOfWeek === day && t.periodNumber === periodNum);
    const times = PERIOD_TIMES.find((pt) => pt.num === periodNum) || { start: "08:00", end: "08:45" };

    setCellData({
      id: existing?.id || "",
      dayOfWeek: day as any,
      periodNumber: periodNum,
      startTime: existing?.startTime || times.start,
      endTime: existing?.endTime || times.end,
      periodType: existing?.periodType || "REGULAR",
      subjectId: existing?.subjectId || "",
      teacherId: existing?.teacherId || "",
      roomNumber: existing?.roomNumber || "",
    });
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    startTransition(async () => {
      try {
        await saveTimetablePeriod({
          ...cellData,
          sectionId: selectedSection,
          subjectId: cellData.subjectId || null,
          teacherId: cellData.teacherId || null,
          roomNumber: cellData.roomNumber || null,
        });
        setShowModal(false);
        // Refresh timetable
        const updated = await getSectionTimetable(selectedSection);
        setTimetable(updated as any);
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to save period.");
      }
    });
  };

  const getCellContent = (day: string, periodNum: number) => {
    const record = timetable.find((t) => t.dayOfWeek === day && t.periodNumber === periodNum);
    if (!record) return null;

    if (record.periodType !== "REGULAR") {
      return (
        <div className="text-[10px] uppercase font-bold text-gray-400 bg-gray-50 dark:bg-slate-800/80 p-2 rounded text-center">
          {record.periodType}
        </div>
      );
    }

    const teacherEmail = teachers.find((t) => t.id === record.teacherId)?.email || "No teacher";
    return (
      <div className="text-left space-y-1">
        <p className="font-bold text-xs text-primary truncate">
          {record.subject?.code} - {record.subject?.name}
        </p>
        <p className="text-[10px] text-gray-500 truncate">{teacherEmail.split("@")[0]}</p>
        {record.roomNumber && (
          <span className="inline-block px-1 py-0.5 text-[9px] font-semibold bg-gray-100 dark:bg-slate-800 text-gray-500 rounded">
            Room: {record.roomNumber}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">Weekly Timetable Grid</h2>
          <p className="text-xs text-gray-500">Manage or view periods across classes & sections.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-gray-500 whitespace-nowrap">Select Section:</label>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
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
      </div>

      {/* Grid view */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow border border-gray-200 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="flex flex-col justify-center items-center py-20 space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm text-gray-500">Loading weekly periods…</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm table-fixed border-collapse">
              <thead className="bg-gray-50 dark:bg-slate-800/50 text-gray-600 dark:text-gray-300 text-xs font-semibold uppercase">
                <tr>
                  <th className="px-4 py-3.5 w-24 border border-gray-100 dark:border-slate-800">Day</th>
                  {PERIOD_NUMBERS.map((p) => {
                    const timeInfo = PERIOD_TIMES.find((pt) => pt.num === p);
                    return (
                      <th key={p} className="px-4 py-3.5 border border-gray-100 dark:border-slate-800">
                        Period {p}
                        <span className="block text-[10px] text-gray-400 font-normal lowercase">
                          ({timeInfo?.start}-{timeInfo?.end})
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {DAYS.map((day) => (
                  <tr key={day} className="hover:bg-gray-50/20 dark:hover:bg-slate-800/10">
                    <td className="px-4 py-5 font-bold text-gray-900 dark:text-white border border-gray-100 dark:border-slate-800 uppercase text-xs">
                      {day}
                    </td>
                    {PERIOD_NUMBERS.map((p) => (
                      <td
                        key={p}
                        onClick={() => handleCellClick(day, p)}
                        className={`px-4 py-4 border border-gray-100 dark:border-slate-800 transition min-h-[80px] vertical-align-top ${
                          isAdmin ? "cursor-pointer hover:bg-primary/5" : ""
                        }`}
                      >
                        {getCellContent(day, p) || (
                          <span className="text-[10px] text-gray-300 italic block text-center py-4">
                            {isAdmin ? "+ Add" : "Free"}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-md w-full border border-gray-200 dark:border-slate-800 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Edit Period Block
              </h3>
              <span className="text-xs uppercase font-bold text-gray-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                {cellData.dayOfWeek} / Period {cellData.periodNumber}
              </span>
            </div>

            {errorMsg && (
              <div className="bg-red-50 text-red-800 p-3 rounded-md text-xs font-semibold flex items-center gap-2 border border-red-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Period Type</label>
              <select
                value={cellData.periodType}
                onChange={(e) => setCellData({ ...cellData, periodType: e.target.value as any })}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {["REGULAR", "ASSEMBLY", "BREAK", "LUNCH", "LAB", "PT", "LIBRARY", "FREE"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {cellData.periodType === "REGULAR" && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Subject</label>
                  <select
                    value={cellData.subjectId}
                    onChange={(e) => setCellData({ ...cellData, subjectId: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">Select Subject</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Teacher</label>
                  <select
                    value={cellData.teacherId}
                    onChange={(e) => setCellData({ ...cellData, teacherId: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">Select Teacher</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>{t.email}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Room Number</label>
                  <input
                    type="text"
                    value={cellData.roomNumber}
                    onChange={(e) => setCellData({ ...cellData, roomNumber: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="bg-primary hover:bg-primary/95 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60 flex items-center gap-1"
              >
                {isPending && <RefreshCw className="w-4 h-4 animate-spin" />} Save Period
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
