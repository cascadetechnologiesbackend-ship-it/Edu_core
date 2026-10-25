"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, Users, ArrowRightLeft } from "lucide-react";
import MyDayTimeline from "@/components/teacher/MyDayTimeline";
import SectionRosters from "@/components/teacher/SectionRosters";
import SubstitutionCard from "@/components/teacher/SubstitutionCard";
import type {
  MyDayPeriodItem,
  TeacherSectionSummary,
  StudentRosterRow,
  TeacherWorkspaceScopeResult,
} from "./classesActions";
import { getTeacherSectionRosters } from "./classesActions";
import type { TeacherSubstitutionItem } from "./substitutionsActions";
import { getTeacherSubstitutions } from "./substitutionsActions";
import {
  TeacherScopeProvider,
  useTeacherScope,
} from "@/components/teacher/TeacherScopeContext";
import TeacherWorkspaceSwitcher from "@/components/teacher/TeacherWorkspaceSwitcher";
import HomeroomWorkspaceView from "@/components/teacher/HomeroomWorkspaceView";

interface TeacherClassesClientProps {
  initialTab?: "myday" | "rosters" | "substitutions" | undefined;
  timeline: MyDayPeriodItem[];
  date: string;
  dayOfWeek: string;
  sections: TeacherSectionSummary[];
  initialSelectedSectionId?: string | undefined;
  initialStudents: StudentRosterRow[];
  initialSubstitutions?: {
    incoming: TeacherSubstitutionItem[];
    outgoing: TeacherSubstitutionItem[];
  } | undefined;
  syllabusTopics?: Array<{ id: string; title: string; classSubjectId?: string }>;
  workspaceScope?: TeacherWorkspaceScopeResult | null | undefined;
  dayType?: "INSTRUCTIONAL" | "REST_DAY" | "SETUP_MISSING" | undefined;
  holidayTitle?: string | undefined;
  isSetupMissing?: boolean | undefined;
  missingAllocationsSummary?: string[] | undefined;
}

function TeacherClassesInner({
  initialTab = "myday",
  timeline,
  date,
  dayOfWeek,
  sections,
  initialSelectedSectionId,
  initialStudents,
  initialSubstitutions,
  syllabusTopics,
  workspaceScope,
  dayType,
  holidayTitle,
  isSetupMissing,
  missingAllocationsSummary,
}: TeacherClassesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeWorkspace } = useTeacherScope();

  const currentTab =
    (searchParams.get("tab") as "myday" | "rosters" | "substitutions") ||
    initialTab;
  const [activeTab, setActiveTab] =
    useState<"myday" | "rosters" | "substitutions">(currentTab);
  const [substitutions, setSubstitutions] = useState(
    initialSubstitutions || { incoming: [], outgoing: [] }
  );

  const handleTabSwitch = (tab: "myday" | "rosters" | "substitutions") => {
    setActiveTab(tab);
    router.replace(`/teacher/classes?tab=${tab}`);
  };

  const refreshSubstitutions = async () => {
    try {
      const data = await getTeacherSubstitutions();
      setSubstitutions(data);
    } catch (err) {
      console.error("Failed to refresh substitutions:", err);
    }
  };

  const pendingIncomingCount = substitutions.incoming.filter(
    (i) => i.status === "PENDING"
  ).length;

  return (
    <div className="space-y-4">
      {/* ─── Dual-Role Workspace Switcher (S16) ─────────────────────────── */}
      <TeacherWorkspaceSwitcher />

      {activeWorkspace === "homeroom" && workspaceScope?.homeroomSection ? (
        /* ─── Condition B: Class Teacher Homeroom Workspace ─────────────── */
        <HomeroomWorkspaceView homeroomSection={workspaceScope.homeroomSection} />
      ) : (
        /* ─── Condition A: Subject Teacher Workspace ───────────────────── */
        <div className="space-y-4">
          {/* Segmented Tab Switcher */}
          <div className="flex items-center p-1 rounded-2xl bg-slate-900 border border-slate-800 w-full sm:w-auto self-start shadow-sm overflow-x-auto">
            <button
              type="button"
              onClick={() => handleTabSwitch("myday")}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
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
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                activeTab === "rosters"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Section Rosters ({sections.length} Sections)
            </button>

            <button
              type="button"
              onClick={() => handleTabSwitch("substitutions")}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                activeTab === "substitutions"
                  ? "bg-amber-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Substitutions
              {pendingIncomingCount > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-400 text-slate-950 rounded-full font-bold text-[10px]">
                  {pendingIncomingCount}
                </span>
              )}
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "myday" ? (
            <MyDayTimeline
              timeline={timeline}
              date={date}
              dayOfWeek={dayOfWeek}
              dayType={dayType}
              holidayTitle={holidayTitle}
              isSetupMissing={isSetupMissing}
              missingAllocationsSummary={missingAllocationsSummary}
              {...(syllabusTopics ? { syllabusTopics } : {})}
            />
          ) : activeTab === "rosters" ? (
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
          ) : (
            <SubstitutionCard
              incoming={substitutions.incoming}
              outgoing={substitutions.outgoing}
              onRefresh={refreshSubstitutions}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function TeacherClassesClient(props: TeacherClassesClientProps) {
  const searchParams = useSearchParams();
  const initialMode =
    searchParams.get("workspace") === "homeroom"
      ? "homeroom"
      : searchParams.get("workspace") === "subject"
      ? "subject"
      : undefined;

  return (
    <TeacherScopeProvider
      initialScope={props.workspaceScope ?? null}
      {...(initialMode ? { initialMode } : {})}
    >
      <TeacherClassesInner {...props} />
    </TeacherScopeProvider>
  );
}
