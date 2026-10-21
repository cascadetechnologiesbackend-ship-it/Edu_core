import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { assertRouteAccess } from "@/lib/routeGuards";
import { redirect } from "next/navigation";
import { getUnlinkedStudents } from "@schoolmitra/backend/lib/parentLinkage";
import { ParentLinkageClient } from "../ParentLinkageClient";

export default async function ParentLinkagePage() {
  const ctx = await requireAuth();
  const access = assertRouteAccess(ctx.role, "/students", {
    id: ctx.userId,
    email: ctx.email,
  });

  if (!access.allowed || !["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(ctx.role)) {
    redirect(access.redirectUrl || "/students");
  }

  const school = await requireSchool(ctx);
  const unlinkedStudents = await getUnlinkedStudents(school.id);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <ParentLinkageClient initialUnlinkedStudents={unlinkedStudents} />
    </div>
  );
}
