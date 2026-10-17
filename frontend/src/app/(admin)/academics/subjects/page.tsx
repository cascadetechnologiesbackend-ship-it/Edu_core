import { Metadata } from "next";
import { requireAuth } from "@/lib/serverAuth";
import { assertRouteAccess } from "@/lib/routeGuards";
import { redirect } from "next/navigation";
import { db, withTenant } from "@/db";
import { subjects, schools } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import SubjectsTab from "../SubjectsTab";

export const metadata: Metadata = {
  title: "Subjects Catalog | SchoolMitra ERP",
  description: "Manage master curriculum subjects and course codes",
};

export default async function SubjectsCatalogPage() {
  const ctx = await requireAuth();
  const access = assertRouteAccess(ctx.role, "/academics", {
    id: ctx.userId,
    email: ctx.email,
  });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  let schoolId = ctx.schoolId || "";
  if (!schoolId && ctx.role === "SUPER_ADMIN") {
    const activeSchool = await db.query.schools.findFirst({
      where: eq(schools.isActive, true),
      columns: { id: true },
    });
    schoolId = activeSchool?.id || "";
  }

  const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(ctx.role);

  const subjectsList = schoolId
    ? await withTenant(schoolId, async (tx) => {
        return tx.query.subjects.findMany({
          where: and(
            eq(subjects.schoolId, schoolId),
            eq(subjects.isActive, true)
          ),
          orderBy: [subjects.name],
        });
      })
    : [];

  return (
    <div className="space-y-6 max-w-[1280px] mx-auto px-4 md:px-6">
      {/* Breadcrumb Header */}
      <div className="border-b border-gray-100 dark:border-slate-800 pb-4">
        <nav className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 mb-1">
          <Link href="/dashboard" className="hover:text-primary transition">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href="/academics" className="hover:text-primary transition">
            Academics
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-700 dark:text-gray-300 font-medium">
            Subjects Catalog
          </span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Subjects Catalog
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Define master subjects, course codes, and assessment types across grades.
            </p>
          </div>
        </div>
      </div>

      <SubjectsTab subjects={subjectsList as any} isAdmin={isAdmin} />
    </div>
  );
}
