import { db } from "@/db";
import { schools } from "@/db/schema";

import Link from "next/link";
import { Plus } from "lucide-react";

export default async function TenantSchoolsList() {
  const tenants = await db.select().from(schools).orderBy(schools.name);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Tenant Schools</h1>
        <Link
          href="/platform/schools/new"
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
        >
          <Plus className="mr-2 h-4 w-4" /> Provision New School
        </Link>
      </div>

      <div className="border rounded-md">
        <table className="w-full text-sm text-left text-muted-foreground">
          <thead className="text-xs uppercase bg-muted/50 border-b">
            <tr>
              <th className="px-6 py-3">School Name</th>
              <th className="px-6 py-3">UDISE Code</th>
              <th className="px-6 py-3">Location</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((school) => (
              <tr key={school.id} className="border-b last:border-b-0 bg-card">
                <td className="px-6 py-4 font-medium text-foreground">
                  {school.name}
                </td>
                <td className="px-6 py-4">{school.udiseCode}</td>
                <td className="px-6 py-4">
                  {school.city}, {school.state}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${school.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {school.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center">
                  No tenant schools provisioned yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
