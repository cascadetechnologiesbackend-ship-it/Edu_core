import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { assertRouteAccess } from "@/lib/routeGuards";
import { redirect } from "next/navigation";
import { getStudentAccessQueue } from "@schoolmitra/backend/lib/studentAccess";
import { StudentAccessClient } from "./StudentAccessClient";

export default async function StudentAccessPage() {
  const ctx = await requireAuth();
  const access = assertRouteAccess(ctx.role, "/students", {
    id: ctx.userId,
    email: ctx.email,
  });

  if (!access.allowed || !["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(ctx.role)) {
    redirect(access.redirectUrl || "/students");
  }

  const school = await requireSchool(ctx);
  const initialItems = await getStudentAccessQueue(school.id);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <StudentAccessClient initialItems={initialItems} />
    </div>
  );
}
