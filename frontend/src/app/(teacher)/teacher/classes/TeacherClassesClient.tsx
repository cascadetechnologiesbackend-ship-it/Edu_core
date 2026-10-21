"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, Users } from "lucide-react";
import MyDayTimeline from "@/components/teacher/MyDayTimeline";
import SectionRosters from "@/components/teacher/SectionRosters";
import type {
  MyDayPeriodItem,
  TeacherSectionSummary,
  StudentRosterRow,
} from "./classesActions";
import { getTeacherSectionRosters } from "./classesActions";

interface TeacherClassesClientProps {
  initialTab?: "myday" | "rosters" | undefined;
  timeline: MyDayPeriodItem[];
  date: string;
  dayOfWeek: string;
  sections: TeacherSectionSummary[];
  initialSelectedSectionId?: string | undefined;
  initialStudents: StudentRosterRow[];
}

export default function TeacherClassesClient({
  initialTab = "myday",
  timeline,
  date,
  dayOfWeek,
  sections,
  initialSelectedSectionId,
  initialStudents,
}: TeacherClassesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = (searchParams.get("tab") as "myday" | "rosters") || initialTab;
  const [activeTab, setActiveTab] = useState<"myday" | "rosters">(currentTab);

  const handleTabSwitch = (tab: "myday" | "rosters") => {
    setActiveTab(tab);
    router.replace(`/teacher/classes?tab=${tab}`);
  };

  return (
    <div className="space-y-4">
      {/* ─── Segmented Tab Switcher ───────────────────────────────────────── */}
      <div className="flex items-center p-1 rounded-2xl bg-slate-900 border border-slate-800 w-full sm:w-auto self-start shadow-sm">
        <button
          type="button"
          onClick={() => handleTabSwitch("myday")}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === "myday"
              ? "bg-emerald-600 text-white shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          My Day Timeline ({timeline.length} Periods)
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch("rosters")}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === "rosters"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Section Rosters ({sections.length} Sections)
        </button>
      </div>

      {/* ─── Tab Content ─────────────────────────────────────────────────── */}
      {activeTab === "myday" ? (
        <MyDayTimeline timeline={timeline} date={date} dayOfWeek={dayOfWeek} />
      ) : (
        <SectionRosters
          sections={sections}
          initialSelectedSectionId={initialSelectedSectionId}
          initialStudents={initialStudents}
          onSelectSection={async (secId) => {
            const data = await getTeacherSectionRosters(secId);
            return {
              selectedSectionId: data.selectedSectionId,
              students: data.students,
            };
          }}
        />
      )}
    </div>
  );
}
