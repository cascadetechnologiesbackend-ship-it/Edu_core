import { db } from "@/db";
import { students, rightsRequests, dpdpGrievances } from "@/db/schema";
import { eq, isNotNull, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import RightsPortalClient from "./RightsPortalClient";

export default async function RightsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <div className="p-6">Please log in to manage subject rights.</div>;
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
        <p className="text-slate-500 mt-2">No students linked to your account.</p>
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Data Subject Rights Portal
        </h1>
        <p className="text-sm text-slate-500">
          DPDP Act 2023 Sections 11–14 — Exercise your rights to access, correction, erasure, or grievances.
        </p>
      </div>

      <RightsPortalClient
        students={myStudents}
        initialRequests={requests}
        initialGrievances={grievances}
      />
    </div>
  );
}
