import { db, withTenant } from "@/db";
import { students, rightsRequests, dpdpGrievances } from "@/db/schema";
import { eq, and, isNotNull, desc } from "drizzle-orm";
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
        <p className="text-muted-foreground mt-2">
          No students linked to your account.
        </p>
      </div>
    );
  }

  // Fetch parent's submitted rights requests & grievances within tenant context
  const { requests, grievances } = await withTenant(schoolId, async (tx: any) => {
    const [reqs, grieves] = await Promise.all([
      tx.query.rightsRequests.findMany({
        where: and(
          eq(rightsRequests.schoolId, schoolId),
          eq(rightsRequests.requestedByUserId, parentUserId),
        ),
        orderBy: [desc(rightsRequests.createdAt)],
      }),
      tx.query.dpdpGrievances.findMany({
        where: and(
          eq(dpdpGrievances.schoolId, schoolId),
          eq(dpdpGrievances.submittedByUserId, parentUserId),
        ),
        orderBy: [desc(dpdpGrievances.createdAt)],
      }),
    ]);
    return { requests: reqs, grievances: grieves };
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
          <p className="text-xs text-muted-foreground mt-0.5">
            DPDP Act 2023 Sections 11–14 — Exercise your rights to access, correction, erasure, or grievances.
          </p>
        </div>

        {/* Dedicated Horizontal Pill Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 rounded-2xl bg-muted/40 border border-border/40 no-scrollbar text-xs w-fit">
          <Link
            href="/portal"
            className="px-3.5 py-2 min-h-[40px] flex items-center rounded-xl font-semibold text-muted-foreground hover:text-foreground whitespace-nowrap transition"
          >
            Fees &amp; Dues
          </Link>
          <Link
            href="/portal/report-cards"
            className="px-3.5 py-2 min-h-[40px] flex items-center rounded-xl font-semibold text-muted-foreground hover:text-foreground whitespace-nowrap transition"
          >
            Report Cards
          </Link>
          <Link
            href="/portal/consent"
            className="px-3.5 py-2 min-h-[40px] flex items-center rounded-xl font-semibold text-muted-foreground hover:text-foreground whitespace-nowrap transition"
          >
            Consent Center
          </Link>
          <Link
            href="/parent/documents"
            className="px-3.5 py-2 min-h-[40px] flex items-center rounded-xl font-semibold text-muted-foreground hover:text-foreground whitespace-nowrap transition"
          >
            Documents
          </Link>
          <span className="px-3.5 py-2 min-h-[40px] flex items-center rounded-xl font-bold bg-card text-[#008299] dark:text-[#30B0C7] shadow-sm whitespace-nowrap">
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
