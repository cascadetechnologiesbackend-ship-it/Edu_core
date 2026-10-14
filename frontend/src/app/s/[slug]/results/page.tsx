import { db } from "@/db";
import {
  schools,
  reportCardSetups,
  resultSettings,
  resultSnapshots,
  students,
  classes,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { decryptData } from "@/lib/encryption";
import { PublicResultPortalClient } from "./PublicResultPortalClient";

interface PublicResultsPageProps {
  params: { slug: string };
}

export async function generateMetadata({
  params,
}: PublicResultsPageProps): Promise<Metadata> {
  const school = await db.query.schools.findFirst({
    where: eq(schools.slug, params.slug),
  });

  if (!school) {
    return {
      title: "Results Not Found | SchoolMitra ERP",
    };
  }

  return {
    title: `${school.name} - Official Examination Results`,
    description: `Official public examination results, marksheets, and topper honors board for ${school.name}`,
  };
}

export default async function PublicResultsPage({
  params,
}: PublicResultsPageProps) {
  const school = await db.query.schools.findFirst({
    where: eq(schools.slug, params.slug),
  });

  if (!school) {
    notFound();
  }

  // Fetch setups for this school
  const rawSetups = await db.query.reportCardSetups.findMany({
    where: eq(reportCardSetups.schoolId, school.id),
    orderBy: [desc(reportCardSetups.createdAt)],
  });

  // Amendment 6: Default to most recently published/active setup
  const defaultSetup =
    rawSetups.find((s) => s.isActive) || rawSetups[0] || null;

  let isToppersEnabled = false;
  let top3Toppers: Array<{
    rank: number;
    studentName: string;
    className: string;
    percentage: number;
    overallGrade: string;
  }> = [];

  if (defaultSetup) {
    const settings = await db.query.resultSettings.findFirst({
      where: and(
        eq(resultSettings.schoolId, school.id),
        eq(resultSettings.setupId, defaultSetup.id),
      ),
    });

    isToppersEnabled = Boolean(settings?.publicToppersEnabled);

    if (isToppersEnabled) {
      const [snapshots, allStudents, allClasses] = await Promise.all([
        db.query.resultSnapshots.findMany({
          where: and(
            eq(resultSnapshots.schoolId, school.id),
            eq(resultSnapshots.setupId, defaultSetup.id),
            eq(resultSnapshots.isCurrent, true),
          ),
        }),
        db.query.students.findMany({
          where: eq(students.schoolId, school.id),
        }),
        db.query.classes.findMany({
          where: eq(classes.schoolId, school.id),
        }),
      ]);

      const studentMap = new Map(allStudents.map((s) => [s.id, s]));
      const classMap = new Map(allClasses.map((c) => [c.id, c.displayName]));

      const passedCandidates = snapshots
        .filter((snap) => {
          const payload = snap.payload as any;
          return payload?.summary?.resultStatus === "PASSED";
        })
        .map((snap) => {
          const payload = snap.payload as any;
          const st = studentMap.get(snap.studentId);
          const first = st ? decryptData(st.firstNameEncrypted) || "" : "";
          const last = st ? decryptData(st.lastNameEncrypted) || "" : "";
          const fullName = `${first} ${last}`.trim() || "Student";
          const className =
            st?.currentClassId && classMap.has(st.currentClassId)
              ? classMap.get(st.currentClassId)!
              : "Standard";

          return {
            rank: payload?.summary?.rank || 999,
            studentName: fullName,
            className,
            percentage: payload?.summary?.percentage || 0,
            overallGrade: payload?.summary?.overallGrade || "—",
          };
        });

      passedCandidates.sort((a, b) => a.rank - b.rank);
      top3Toppers = passedCandidates.slice(0, 3);
    }
  }

  return (
    <PublicResultPortalClient
      slug={params.slug}
      school={{
        id: school.id,
        name: school.name,
        code: school.udiseCode,
        address: school.address,
      }}
      setups={rawSetups.map((s) => ({
        id: s.id,
        name: s.name,
        isActive: s.isActive,
      }))}
      defaultSetupId={defaultSetup?.id || ""}
      toppers={top3Toppers}
      isToppersEnabled={isToppersEnabled}
    />
  );
}
