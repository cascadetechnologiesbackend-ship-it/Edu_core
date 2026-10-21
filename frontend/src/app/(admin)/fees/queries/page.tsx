import { getAdminFeeQueries } from "./actions";
import { FeeQueriesAdminClient } from "./FeeQueriesAdminClient";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Fee Query Inbox | Accounts & Admin",
  description: "Accountant and administrative fee query management inbox with 48h SLA tracking.",
};

export default async function AdminFeeQueriesPage() {
  const res = await getAdminFeeQueries("ALL");

  if (!res.success) {
    if (res.error?.includes("Unauthorized") || res.error?.includes("authentication") || res.error?.includes("login")) {
      redirect("/login");
    }
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl">
          <h2 className="text-lg font-bold">Error loading fee queries</h2>
          <p className="text-sm mt-1">{res.error || "Unable to load inbox."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <FeeQueriesAdminClient
          initialQueries={res.queries || []}
          counts={
            res.counts || {
              all: 0,
              open: 0,
              slaBreached: 0,
              answered: 0,
              resolved: 0,
              escalated: 0,
            }
          }
        />
      </div>
    </div>
  );
}
