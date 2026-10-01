import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { getStaff360, getDepartments, getDesignations } from "../../actions";
import { Staff360Client } from "./Staff360Client";

export const metadata: Metadata = {
  title: "Staff 360 | SchoolMitra ERP",
  description: "Comprehensive staff profile, lifecycle, and academic assignments",
};

export default async function Staff360Page({
  params,
}: {
  params: { id: string };
}) {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "HR_MANAGER",
    "PRINCIPAL",
  ] as const);
  const school = await requireSchool(ctx);

  const res = await getStaff360(params.id);
  if (!res.success || !res.profile) {
    notFound();
  }

  const [deptRes, desigRes] = await Promise.all([
    getDepartments(),
    getDesignations(),
  ]);

  return (
    <Staff360Client
      profile={res.profile}
      departments={deptRes.departments || []}
      designations={desigRes.designations || []}
      userRole={ctx.role}
      schoolName={school.name}
    />
  );
}
