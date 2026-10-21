import { Metadata } from "next";
import { Suspense } from "react";
import TeacherClassesClient from "./TeacherClassesClient";
import {
  getTeacherMyDayTimeline,
  getTeacherSectionRosters,
  MyDayPeriodItem,
  TeacherSectionSummary,
  StudentRosterRow,
} from "./classesActions";
import {
  getTeacherSubstitutions,
  TeacherSubstitutionItem,
} from "./substitutionsActions";

export const metadata: Metadata = {
  title: "My Classes & Rosters | Educator PWA",
  description: "View timetable periods, bell schedule, student rosters, and Student 360 profiles.",
};

export default async function TeacherClassesPage({
  searchParams,
}: {
  searchParams?:
    | Promise<{ tab?: string; sectionId?: string; date?: string }>
    | { tab?: string; sectionId?: string; date?: string };
}) {
  const resolvedParams =
    searchParams instanceof Promise ? await searchParams : searchParams || {};

  const activeTab =
    (resolvedParams.tab as "myday" | "rosters" | "substitutions") || "myday";

  // 1. Fetch My Day Timeline
  let timeline: MyDayPeriodItem[] = [];
  let dayOfWeek = "Today";
  let date = new Date().toISOString().slice(0, 10);

  try {
    const timelineData = await getTeacherMyDayTimeline(resolvedParams.date);
    timeline = timelineData.timeline;
    dayOfWeek = timelineData.dayOfWeek;
    date = timelineData.date;
  } catch (err) {
    console.error("[TeacherClassesPage] Error fetching timeline:", err);
  }

  // 2. Fetch Section Rosters
  let sections: TeacherSectionSummary[] = [];
  let selectedSectionId = resolvedParams.sectionId;
  let students: StudentRosterRow[] = [];

  try {
    const rosterData = await getTeacherSectionRosters(resolvedParams.sectionId);
    sections = rosterData.sections;
    selectedSectionId = rosterData.selectedSectionId;
    students = rosterData.students;
  } catch (err) {
    console.error("[TeacherClassesPage] Error fetching rosters:", err);
  }

  // 3. Fetch Substitutions
  let substitutions: {
    incoming: TeacherSubstitutionItem[];
    outgoing: TeacherSubstitutionItem[];
  } = { incoming: [], outgoing: [] };

  try {
    substitutions = await getTeacherSubstitutions();
  } catch (err) {
    console.error("[TeacherClassesPage] Error fetching substitutions:", err);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
          My Classes &amp; Student Rosters
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Event-driven timetable timeline, one-tap lesson progress, and privacy-shielded Student 360 profiles.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="p-8 text-center text-xs text-slate-400">
            Loading timetable and classroom rosters...
          </div>
        }
      >
        <TeacherClassesClient
          initialTab={activeTab}
          timeline={timeline}
          date={date}
          dayOfWeek={dayOfWeek}
          sections={sections}
          initialSelectedSectionId={selectedSectionId}
          initialStudents={students}
          initialSubstitutions={substitutions}
        />
      </Suspense>
    </div>
  );
}
