import { AdmissionsWizard } from "./AdmissionsWizard";
import { db } from "@/db";
import { privacyNotices } from "@/db/schema";
import { desc } from "drizzle-orm";
import { CONSENT_PURPOSES } from "@schoolmitra/dpdp";

export default async function NewAdmissionPage() {
  const [latestPrivacyNotice] = await db.query.privacyNotices.findMany({
    orderBy: [desc(privacyNotices.publishedAt)],
    limit: 1,
  });

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">New Admission</h1>
        <p className="text-gray-500 mt-1">Complete the 6-step wizard to enrol a new student.</p>
      </div>

      <AdmissionsWizard 
        privacyNoticeVersion={latestPrivacyNotice?.version || "1.0"}
        consentPurposes={CONSENT_PURPOSES} 
      />
    </div>
  );
}
