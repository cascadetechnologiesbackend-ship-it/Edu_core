import { db } from "@/db";
import { students, consentPurposes, consentRecords } from "@/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import Link from "next/link";
import ConsentPortalClient from "./ConsentPortalClient";

export default async function ConsentPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <div className="p-6">Please log in to view consent records.</div>;
  }

  const parentUserId = session.user.id;
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(session.user.role);

  // Find students linked to this parent
  let myStudents = await db.query.students.findMany({
    where: eq(students.primaryParentUserId, parentUserId),
  });

  // If Admin and no students, fetch a demo student for preview
  if (myStudents.length === 0 && isAdmin) {
    const demoStudent = await db.query.students.findFirst({
      where: isNotNull(students.primaryParentUserId),
    });
    if (demoStudent) myStudents = [demoStudent];
  }

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

  // Load consent purposes
  const purposes = await db.query.consentPurposes.findMany({
    where: eq(consentPurposes.isActive, true),
  });

  // Load latest consent records for all purposes for all students
  const latestRecords = [];
  for (const student of myStudents) {
    for (const p of purposes) {
      const rec = await db.query.consentRecords.findFirst({
        where: and(
          eq(consentRecords.studentId, student.id),
          eq(consentRecords.purposeId, p.purposeId),
        ),
        orderBy: (t, { desc }) => [desc(t.grantedAt)],
      });
      if (rec) {
        latestRecords.push(rec);
      }
    }
  }

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
            href="/portal/rights"
            className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
          >
            Subject Rights
          </Link>
        </div>
      </div>

      <ConsentPortalClient
        students={myStudents}
        purposes={purposes}
        initialConsentRecords={latestRecords}
      />
    </div>
  );
}
