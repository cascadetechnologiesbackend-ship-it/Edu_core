import { AdmissionsWizard } from "./AdmissionsWizard";
import { db, withTenant } from "@/db";
import { privacyNotices, classes } from "@/db/schema";
import { desc, eq, asc, and } from "drizzle-orm";
import { CONSENT_PURPOSES } from "@schoolmitra/dpdp";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function NewAdmissionPage() {
  const session = await auth();
  if (!session?.user?.schoolId) {
    redirect("/login");
  }

  const schoolId = session.user.schoolId;

  const [latestPrivacyNotice, schoolClasses] = await Promise.all([
    db.query.privacyNotices.findFirst({
      orderBy: [desc(privacyNotices.publishedAt)],
    }),
    withTenant(schoolId, async (tx) =>
      tx.query.classes.findMany({
        where: and(
          eq(classes.schoolId, schoolId),
          eq(classes.isActive, true),
        ),
        orderBy: [asc(classes.sortOrder)],
      })
    ),
  ]);

  const availableGrades = schoolClasses.map((c) => ({
    grade: c.gradeLevel,
    displayName: c.displayName,
  }));

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          New Admission
        </h1>
        <p className="text-gray-500 mt-1">
          Complete the 6-step wizard to enrol a new student.
        </p>
      </div>

      <AdmissionsWizard
        privacyNoticeVersion={latestPrivacyNotice?.version || "1.0"}
        consentPurposes={CONSENT_PURPOSES as any}
        availableGrades={availableGrades}
      />
    </div>
  );
}
