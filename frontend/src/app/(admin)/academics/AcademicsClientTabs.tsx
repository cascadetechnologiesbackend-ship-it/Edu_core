"use client";

import { useState } from "react";
import ClassroomsTab from "./ClassroomsTab";
import SubjectsTab from "./SubjectsTab";
import SubjectMappingTab from "./SubjectMappingTab";
import TimetableTab from "./TimetableTab";
import AssignmentsTab from "./AssignmentsTab";
import LessonPlansTab from "./LessonPlansTab";

type ClassSubject = {
  id: string;
  classId: string;
  subjectId: string;
  assignedTeacherId: string | null;
  periodsPerWeek: number;
  isElective: boolean;
  class: {
    displayName: string;
  };
  subject: {
    name: string;
    code: string;
  };
};

type Section = {
  id: string;
  name: string;
  capacity: number;
  classTeacherId: string | null;
  roomNumber: string | null;
};

type Classroom = {
  id: string;
  gradeLevel: string;
  displayName: string;
  sortOrder: number;
  sections: Section[];
};

type Subject = {
  id: string;
  code: string;
  name: string;
  nameHindi: string | null;
  subjectType:
    | "THEORY" | "PRACTICAL" | "CO_SCHOLASTIC" | "LANGUAGE" | "ACTIVITY";
  maxMarks: number;
  passingMarks: number;
};

type Teacher = {
  id: string;
  email: string;
};

export default function AcademicsClientTabs({
  classrooms,
  subjects,
  mappings,
  teachers,
  role,
  userId,
  isAdmin,
}: {
  classrooms: Classroom[];
  subjects: Subject[];
  mappings: ClassSubject[];
  teachers: Teacher[];
  role: string;
  userId: string;
  isAdmin: boolean;
}) {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("academics_tab") || "classrooms";
    }
    return "classrooms";
  });

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (typeof window !== "undefined") {
      localStorage.setItem("academics_tab", tabId);
    }
  };

  const tabs = [
    { id: "classrooms", label: "Classrooms & Sections" },
    { id: "subjects", label: "Subject Master" },
    { id: "mapping", label: "Subject Mapping" },
    { id: "timetable", label: "Timetable Grid" },
    { id: "assignments", label: "Assignments & Grading" },
    { id: "lessons", label: "Lesson Plans" },
  ];

  return (
    <div className="space-y-6">
      {/* Tab Selectors - Horizontally scrollable on mobile with smooth touch snapping */}
      <div className="border-b border-gray-200 dark:border-slate-800 -mx-3 sm:mx-0 px-3 sm:px-0">
        <ul
          className="flex overflow-x-auto no-scrollbar gap-1 sm:gap-2 -mb-px text-sm font-medium whitespace-nowrap py-1"
          role="tablist"
        >
          {tabs.map((tab) => (
            <li key={tab.id} className="flex-shrink-0" role="presentation">
              <button
                onClick={() => handleTabChange(tab.id)}
                className={`inline-flex items-center px-3.5 py-2.5 sm:px-4 sm:py-3 border-b-2 rounded-t-lg transition font-semibold text-xs sm:text-sm min-h-[44px] select-none ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-600 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
                role="tab"
                aria-selected={activeTab === tab.id}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Tab Panels */}
      <div className="transition-all duration-150">
        {activeTab === "classrooms" && (
          <ClassroomsTab
            classrooms={classrooms}
            teachers={teachers}
            isAdmin={isAdmin}
          />
        )}
        {activeTab === "subjects" && (
          <SubjectsTab subjects={subjects} isAdmin={isAdmin} />
        )}
        {activeTab === "mapping" && (
          <SubjectMappingTab
            mappings={mappings}
            classrooms={classrooms}
            subjects={subjects}
            teachers={teachers}
            isAdmin={isAdmin}
          />
        )}
        {activeTab === "timetable" && (
          <TimetableTab
            classrooms={classrooms as any}
            subjects={subjects}
            teachers={teachers}
            isAdmin={isAdmin}
          />
        )}
        {activeTab === "assignments" && (
          <AssignmentsTab
            classrooms={classrooms as any}
            mappings={mappings}
            role={role}
            userId={userId}
          />
        )}
        {activeTab === "lessons" && (
          <LessonPlansTab mappings={mappings} role={role} />
        )}
      </div>
    </div>
  );
}
