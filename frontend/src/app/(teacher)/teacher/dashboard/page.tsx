export const dynamic = "force-dynamic";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import { staff, sections, subjects, classSubjects, sectionSubjectTeachers } from "@/db/schema";
import { eq, and, or, inArray } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import { assembleTeacherSnapshot } from "@/lib/teacherEventEngine/snapshotAssembler";
import { deriveTeacherFeed } from "@/lib/teacherEventEngine/deriveTeacherFeed";
import { syncTeacherFeedCards } from "@/lib/teacherEventEngine/feedPersistence";
import { resolveTeacherScope } from "@/lib/teacherEventEngine/scopeResolver";
import { TeacherFeedContainer } from "@/components/teacher/TeacherFeedContainer";

export const metadata = {
  title: "Educator Feed | SchoolMitra ERP",
  description: "High-intent event-driven operating feed for daily roll calls, grading, and timetable.",
};

export default async function TeacherDashboardPage({
  searchParams,
}: {
  searchParams?: { locale?: string };
}) {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);
  const schoolId = school.id;
  const userId = ctx.userId;
  const locale = searchParams?.locale || "en";
  const now = new Date();

  // Execute snapshot assembly, feed derivation, and profile query inside tenant boundary
  const { initialCards, teacherProfile, daySummary, dayCompleteSummary } = await withTenant(
    schoolId,
    async (tx) => {
      // 1. Resolve Scope & Snapshot
      const scope = await resolveTeacherScope(userId, { tx, schoolId });
      const snapshot = await assembleTeacherSnapshot(schoolId, userId, now, tx);

      // 2. Derive Cards & Persist
      const cards = deriveTeacherFeed(userId, now, snapshot);
      await syncTeacherFeedCards(schoolId, userId, cards, tx);

      // 3. Resolve Teacher Identity & Teaching Allocations
      const staffMember = await tx.query.staff.findFirst({
        where: and(eq(staff.userId, userId), eq(staff.schoolId, schoolId)),
      });

      let teacherName = "Educator";
      if (staffMember) {
        try {
          const first = decryptData(staffMember.firstNameEncrypted);
          const last = decryptData(staffMember.lastNameEncrypted);
          teacherName = `${first} ${last}`.trim();
        } catch {
          teacherName = "Educator";
        }
      }

      // Section names & class names
      const sectionRows =
        scope.allSectionIds.length > 0
          ? await tx.query.sections.findMany({
              where: and(eq(sections.schoolId, schoolId), inArray(sections.id, scope.allSectionIds)),
              with: { class: true },
            })
          : [];

      const sectionNames = sectionRows.map((s) => `${s.class?.displayName || ""}-${s.name}`);

      // Subjects taught
      const subjectIds = Array.from(new Set(scope.teachingSections.map((ts) => ts.subjectId)));
      const subjectRows =
        subjectIds.length > 0
          ? await tx.query.subjects.findMany({
              where: and(eq(subjects.schoolId, schoolId), inArray(subjects.id, subjectIds)),
            })
          : [];
      const subjectNames = subjectRows.map((s) => s.name);

      const isClassTeacher = scope.classTeacherSections.length > 0;
      const classTeacherSection = sectionRows.find((s) =>
        scope.classTeacherSections.includes(s.id)
      );
      const classTeacherSectionName = classTeacherSection
        ? `${classTeacherSection.class?.displayName || ""}-${classTeacherSection.name}`
        : undefined;

      // 4. Day Summary & Day Complete calculation
      const totalSections = snapshot.attendanceSections?.length || 0;
      const markedSections = snapshot.attendanceSections?.filter((s) => s.isMarked).length || 0;
      const totalStudents = snapshot.attendanceSections?.reduce(
        (sum, s) => sum + s.totalStudents,
        0
      ) || 0;

      let daySummaryText = "";
      if (totalSections > 0 && markedSections < totalSections) {
        daySummaryText =
          locale === "hi"
            ? `${totalSections} में से ${markedSections} कक्षाओं की उपस्थिति दर्ज`
            : `Attendance marked for ${markedSections} of ${totalSections} sections`;
      }

      const dayCompleteText =
        locale === "hi"
          ? `सभी ${totalSections} कक्षाएं पूर्ण। ${totalStudents} विद्यार्थी दर्ज।`
          : `All ${totalSections} sections marked. ${totalStudents} students accounted for.`;

      return {
        initialCards: cards,
        teacherProfile: {
          teacherName,
          schoolName: school.name,
          sectionsTaught: sectionNames,
          subjectsTaught: subjectNames,
          isClassTeacher,
          classTeacherSectionName,
        },
        daySummary: daySummaryText,
        dayCompleteSummary: dayCompleteText,
      };
    }
  );

  return (
    <TeacherFeedContainer
      initialCards={initialCards}
      teacherName={teacherProfile.teacherName}
      schoolName={teacherProfile.schoolName}
      sectionsTaught={teacherProfile.sectionsTaught}
      subjectsTaught={teacherProfile.subjectsTaught}
      isClassTeacher={teacherProfile.isClassTeacher}
      classTeacherSectionName={teacherProfile.classTeacherSectionName}
      locale={locale}
      now={now}
      daySummary={daySummary}
      dayCompleteSummary={dayCompleteSummary}
    />
  );
}
