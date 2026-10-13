import { db } from "@/db";
import { schools } from "@/db/schema";
import { desc } from "drizzle-orm";
import { SchoolManagementClient, SchoolItem } from "./SchoolManagementClient";

export const metadata = {
  title: "School Tenants Directory | Super Admin",
  description: "Manage, inspect, and provision multi-tenant school instances with complete CRUD operations.",
};

export const dynamic = "force-dynamic";

export default async function SchoolsPage() {
  const allSchools = await db.query.schools.findMany({
    orderBy: [desc(schools.createdAt)],
  });

  const serializedSchools: SchoolItem[] = allSchools.map((s) => ({
    id: s.id,
    name: s.name,
    board: s.board as any,
    udiseCode: s.udiseCode,
    address: s.address,
    city: s.city,
    state: s.state,
    pincode: s.pincode,
    phone: s.phone,
    email: s.email,
    principalName: s.principalName,
    establishedYear: s.establishedYear,
    schoolType: s.schoolType,
    website: s.website,
    slug: s.slug,
    status: s.status ?? "ACTIVE",
    isActive: s.isActive ?? true,
    createdAt: s.createdAt,
    deletedAt: s.deletedAt,
  }));

  return <SchoolManagementClient initialSchools={serializedSchools} />;
}
