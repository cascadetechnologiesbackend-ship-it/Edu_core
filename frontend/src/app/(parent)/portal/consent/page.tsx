import { db, withTenant } from "@/db";
import { students, consentPurposes, consentRecords } from "@/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import Link from "next/link";
import ConsentPortalClient from "./ConsentPortalClient";
import { decryptData } from "@/lib/encryption";

export default async function ConsentPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <div className="p-6">Please log in to view consent records.</div>;
  }

  const parentUserId = session.user.id;
  const schoolId = (session.user as any).schoolId;

  const { resolveParentWards } = await import("@schoolmitra/backend/parentEventEngine/resolveParentWards");
  const myStudents = await resolveParentWards(
    { role: session.user.role, userId: parentUserId },
    schoolId,
  );

  if (myStudents.length === 0) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-red-650">Access Restricted</h2>
        <p className="text-slate-500 mt-2">
          No students linked to your account.
        </p>
      </div>
    );
  }

  // Load consent purposes and latest records within tenant context
  const { purposes, latestRecords } = await withTenant(schoolId, async (tx: any) => {
    const dbPurposes = await tx.query.consentPurposes.findMany({
      where: eq(consentPurposes.isActive, true),
    });

    const activePurposes = dbPurposes.length > 0 ? dbPurposes : [
      {
        id: "admission_data",
        purposeId: "admission_data",
        labelEn: "Admission & Enrolment Data",
        labelHi: "प्रवेश और नामांकन डेटा",
        descriptionEn: "Collection and processing of student details for official enrolment.",
        descriptionHi: "आधिकारिक नामांकन के लिए छात्र विवरण का संग्रह और प्रसंस्करण।",
        mandatory: true,
      },
      {
        id: "academic_records",
        purposeId: "academic_records",
        labelEn: "Academic Records & Report Cards",
        labelHi: "शैक्षणिक अभिलेख और रिपोर्ट कार्ड",
        descriptionEn: "Maintaining marks, grades, and academic progression records.",
        descriptionHi: "अंक, ग्रेड और शैक्षणिक प्रगति के रिकॉर्ड बनाए रखना।",
        mandatory: true,
      },
      {
        id: "attendance",
        purposeId: "attendance",
        labelEn: "Daily Attendance Tracking",
        labelHi: "दैनिक उपस्थिति ट्रैकिंग",
        descriptionEn: "Tracking daily attendance for school records and student safety.",
        descriptionHi: "स्कूल रिकॉर्ड और छात्र सुरक्षा के लिए दैनिक उपस्थिति की निगरानी।",
        mandatory: true,
      },
      {
        id: "communications",
        purposeId: "communications",
        labelEn: "SMS & WhatsApp Updates",
        labelHi: "एसएमएस और व्हाट्सएप अपडेट",
        descriptionEn: "Receiving circulars, notices, fee receipts, and emergency alerts.",
        descriptionHi: "परिपत्र, नोटिस, शुल्क रसीदें और आपातकालीन अलर्ट प्राप्त करना।",
        mandatory: false,
      },
      {
        id: "photos_media",
        purposeId: "photos_media",
        labelEn: "School Publications & Media",
        labelHi: "स्कूल प्रकाशन और मीडिया",
        descriptionEn: "Celebrating achievements in annual magazines, newsletter, and school website.",
        descriptionHi: "वार्षिक पत्रिका, समाचार पत्र और स्कूल वेबसाइट में उपलब्धियों का प्रदर्शन।",
        mandatory: false,
      },
    ];

    const records: any[] = [];
    for (const student of myStudents) {
      for (const p of activePurposes) {
        const rec = await tx.query.consentRecords.findFirst({
          where: and(
            eq(consentRecords.schoolId, schoolId),
            eq(consentRecords.studentId, student.id),
            eq(consentRecords.purposeId, p.purposeId),
          ),
          orderBy: (t: any, { desc }: any) => [desc(t.grantedAt)],
        });
        if (rec) {
          records.push(rec);
        }
      }
    }

    return { purposes: activePurposes, latestRecords: records };
  });

  const studentsWithNames = myStudents.map((s) => ({
    ...s,
    displayName: s.fullName || "Student",
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Parent Consent Center
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            DPDP Act 2023 Compliance — Manage consent settings and verify data processing choices.
          </p>
        </div>

        {/* Dedicated Horizontal Pill Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          <Link
            href="/portal"
            className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
          >
            Fees &amp; Dues
          </Link>
          <Link
            href="/portal/report-cards"
            className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
          >
            Report Cards
          </Link>
          <span className="px-3.5 py-2 rounded-xl font-bold bg-indigo-600 text-white shadow-md shadow-indigo-600/30 whitespace-nowrap">
            Consent Center
          </span>
          <Link
            href="/parent/documents"
            className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
          >
            Documents
          </Link>
          <Link
            href="/portal/rights"
            className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
          >
            Subject Rights
          </Link>
        </div>
      </div>

      <ConsentPortalClient
        students={studentsWithNames}
        purposes={purposes}
        initialConsentRecords={latestRecords}
      />
    </div>
  );
}
