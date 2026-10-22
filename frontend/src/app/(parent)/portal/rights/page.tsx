import { db } from "@/db";
import { students, rightsRequests, dpdpGrievances } from "@/db/schema";
import { eq, isNotNull, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import Link from "next/link";
import RightsPortalClient from "./RightsPortalClient";
import { decryptData } from "@/lib/encryption";

export default async function RightsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <div className="p-6">Please log in to manage subject rights.</div>;
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

  // Fetch parent's submitted rights requests
  const requests = await db.query.rightsRequests.findMany({
    where: eq(rightsRequests.requestedByUserId, parentUserId),
    orderBy: [desc(rightsRequests.createdAt)],
  });

  // Fetch parent's grievances
  const grievances = await db.query.dpdpGrievances.findMany({
    where: eq(dpdpGrievances.submittedByUserId, parentUserId),
    orderBy: [desc(dpdpGrievances.createdAt)],
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
            Data Subject Rights Portal
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            DPDP Act 2023 Sections 11–14 — Exercise your rights to access, correction, erasure, or grievances.
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
          <Link
            href="/portal/consent"
            className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
          >
            Consent Center
          </Link>
          <Link
            href="/parent/documents"
            className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
          >
            Documents
          </Link>
          <span className="px-3.5 py-2 rounded-xl font-bold bg-indigo-600 text-white shadow-md shadow-indigo-600/30 whitespace-nowrap">
            Subject Rights
          </span>
        </div>
      </div>

      <RightsPortalClient
        students={studentsWithNames}
        initialRequests={requests}
        initialGrievances={grievances}
      />
    </div>
  );
}
