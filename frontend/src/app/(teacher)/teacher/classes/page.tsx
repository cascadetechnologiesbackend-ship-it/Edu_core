import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db } from "@/db";
import {
  classes,
  sections,
  classSubjects,
  sectionSubjectTeachers,
  timetablePeriods,
  students,
} from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import {
  BookOpen,
  Users,
  Clock,
  MapPin,
  Calendar,
  AlertCircle,
  GraduationCap,
} from "lucide-react";

export const metadata = {
  title: "My Classes & Rosters | Educator PWA",
  description: "View assigned classroom rosters, student listings, and timetable schedule.",
};

export default async function TeacherClassesPage() {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);
  const schoolId = school.id;
  const userId = ctx.userId;

  // 1. Fetch Class Teacher Sections
  const classTeacherSections = await db.query.sections.findMany({
    where: and(
      eq(sections.schoolId, schoolId),
      eq(sections.classTeacherId, userId),
      eq(sections.isActive, true)
    ),
    with: {
      class: true,
    },
  });

  // 2. Fetch Subject Allocations
  const assignedMappings = await db.query.classSubjects.findMany({
    where: and(
      eq(classSubjects.schoolId, schoolId),
      eq(classSubjects.assignedTeacherId, userId)
    ),
    with: {
      class: true,
      subject: true,
    },
  });

  // 3. Fetch Section-Subject Overrides
  const sectionSubjectAllocations = await db.query.sectionSubjectTeachers.findMany({
    where: and(
      eq(sectionSubjectTeachers.schoolId, schoolId),
      eq(sectionSubjectTeachers.teacherId, userId),
      eq(sectionSubjectTeachers.isActive, true)
    ),
    with: {
      section: {
        with: {
          class: true,
        },
      },
      classSubject: {
        with: {
          subject: true,
        },
      },
    },
  });

  // Aggregate section IDs
  const sectionIdSet = new Set<string>();
  classTeacherSections.forEach((s) => sectionIdSet.add(s.id));
  sectionSubjectAllocations.forEach((ssa) => {
    if (ssa.section?.id) sectionIdSet.add(ssa.section.id);
  });

  const assignedClassIds = assignedMappings.map((m) => m.classId).filter(Boolean);
  if (assignedClassIds.length > 0) {
    const classSections = await db.query.sections.findMany({
      where: and(
        eq(sections.schoolId, schoolId),
        inArray(sections.classId, assignedClassIds),
        eq(sections.isActive, true)
      ),
    });
    classSections.forEach((s) => sectionIdSet.add(s.id));
  }

  const assignedSectionIds = Array.from(sectionIdSet);

  // 4. Fetch Details of these Sections
  const allSections = assignedSectionIds.length > 0
    ? await db.query.sections.findMany({
        where: and(
          eq(sections.schoolId, schoolId),
          inArray(sections.id, assignedSectionIds),
          eq(sections.isActive, true)
        ),
        with: {
          class: true,
        },
      })
    : [];

  // 5. Fetch Students in these Sections
  const enrolledStudents = assignedSectionIds.length > 0
    ? await db.query.students.findMany({
        where: and(
          eq(students.schoolId, schoolId),
          inArray(students.currentSectionId, assignedSectionIds),
          eq(students.isActive, true)
        ),
        orderBy: [students.admissionNumber],
      })
    : [];

  // 6. Fetch Timetable Periods for this Teacher
  const teacherPeriods = assignedSectionIds.length > 0
    ? await db.query.timetablePeriods.findMany({
        where: and(
          eq(timetablePeriods.schoolId, schoolId),
          inArray(timetablePeriods.sectionId, assignedSectionIds),
          eq(timetablePeriods.isActive, true)
        ),
        with: {
          subject: true,
          section: {
            with: {
              class: true,
            },
          },
        },
        orderBy: [timetablePeriods.dayOfWeek, timetablePeriods.periodNumber],
      })
    : [];

  const hasAllocations = allSections.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
          My Classes &amp; Student Rosters
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Review class sections, enrolled students, and weekly timetable periods.
        </p>
      </div>

      {!hasAllocations ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white">No Assigned Classes Found</h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            You do not currently have any class sections or subject allocations mapped in the academic master catalog.
          </p>
        </div>
      ) : (
        <>
          {/* Section Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {allSections.map((sec) => {
              const secStudents = enrolledStudents.filter(
                (st) => st.currentSectionId === sec.id
              );
              const isClassTeacher = sec.classTeacherId === userId;

              return (
                <div
                  key={sec.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-base font-extrabold text-white">
                          {sec.class?.displayName || "Class"}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          Section {sec.name}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Room: {sec.roomNumber || "Main Building"} • Capacity: {sec.capacity}
                      </div>
                    </div>

                    {isClassTeacher && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Class Teacher
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                    <span className="text-slate-400">Enrolled Students:</span>
                    <span className="font-bold text-white">{secStudents.length}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Student Roster Table */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">
                Classroom Student Roster ({enrolledStudents.length})
              </h2>
            </div>

            {enrolledStudents.length === 0 ? (
              <p className="text-xs text-slate-400">No active students in your sections.</p>
            ) : (
              <div className="space-y-2">
                {enrolledStudents.map((st, idx) => {
                  const studentName = `${decryptData(st.firstNameEncrypted)} ${decryptData(st.lastNameEncrypted)}`.trim();
                  return (
                    <div
                      key={st.id}
                      className="p-3 rounded-xl border border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 font-bold flex items-center justify-center text-[11px]">
                          {st.rollNumber || idx + 1}
                        </div>
                        <div>
                          <div className="font-bold text-white">{studentName}</div>
                          <div className="text-[10px] text-slate-400">
                            Adm #{st.admissionNumber}
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        Enrolled
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Weekly Timetable Periods */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">
                Weekly Teaching Schedule ({teacherPeriods.length} Periods)
              </h2>
            </div>

            {teacherPeriods.length === 0 ? (
              <p className="text-xs text-slate-400">
                No active timetable periods scheduled for your classes.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {teacherPeriods.map((period) => (
                  <div
                    key={period.id}
                    className="p-3 rounded-xl border border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">
                        {period.dayOfWeek} • Period {period.periodNumber}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {period.subject?.name || "Subject"} ({period.startTime} - {period.endTime})
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300">
                      {period.section?.class?.displayName} - {period.section?.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
