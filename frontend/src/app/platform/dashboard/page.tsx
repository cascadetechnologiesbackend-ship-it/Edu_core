import { db } from "@/db";
import { schools } from "@/db/schema";
import { count } from "drizzle-orm";

export default async function PlatformDashboard() {
  const result = await db.select({ count: count() }).from(schools);
  const totalSchools = result[0]?.count ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Platform Dashboard</h1>
      <p className="text-muted-foreground">Manage all SchoolMitra tenant instances.</p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card text-card-foreground shadow rounded-xl border">
          <div className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Total Active Schools</h3>
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold">{totalSchools}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
