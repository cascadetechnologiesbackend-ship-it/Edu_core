import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { classes, sections, subjects, classSubjects, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import ClassroomsTab from "./ClassroomsTab";
import SubjectsTab from "./SubjectsTab";
import SubjectMappingTab from "./SubjectMappingTab";
import TimetableTab from "./TimetableTab";
import AssignmentsTab from "./AssignmentsTab";
import LessonPlansTab from "./LessonPlansTab";
import AcademicsClientTabs from "./AcademicsClientTabs";

export const metadata: Metadata = {
  title: "Academic Management",
  description: "Manage classes, timetables, lesson plans and homework.",
};

export default async function AcademicsPage() {
  const session = await auth();
  const role = session?.user?.role || "STUDENT";
  const userId = session?.user?.id || "";

  // Fetch initial master lists for tabs
  const classroomsList = await db.query.classes.findMany({
    where: eq(classes.isActive, true),
    orderBy: [classes.sortOrder],
    with: {
      sections: {
        where: eq(sections.isActive, true),
      },
    },
  });

  const subjectsList = await db.query.subjects.findMany({
    where: eq(subjects.isActive, true),
    orderBy: [subjects.name],
  });

  const mappingsList = await db.query.classSubjects.findMany({
    with: {
      class: true,
      subject: true,
    },
  });

  const teachersList = await db.query.users.findMany({
    where: eq(users.isActive, true),
  });

  // Filter mappings and classrooms depending on RBAC if not Admin/Principal
  const isTeacher = role === "TEACHER";
  const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(role);

  // If teacher, only map class subjects they actually teach
  const filteredMappings = isTeacher
    ? mappingsList.filter((m) => m.assignedTeacherId === userId)
    : mappingsList;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Academic Management
        </h1>
        <p className="text-gray-500 mt-1">
          Manage and monitor classes, timetables, subjects, and assignments.
        </p>
      </div>

      <AcademicsClientTabs
        classrooms={classroomsList as any}
        subjects={subjectsList as any}
        mappings={filteredMappings as any}
        teachers={teachersList as any}
        role={role}
        userId={userId}
        isAdmin={isAdmin}
      />
    </div>
  );
}
