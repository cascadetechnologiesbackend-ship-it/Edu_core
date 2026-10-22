export const dynamic = "force-dynamic";

import React from "react";
import { getStudentFeesAction } from "./feesActions";
import { StudentFeesClient } from "@/components/student/fees/StudentFeesClient";
import { ShieldAlert } from "lucide-react";

export const metadata = {
  title: "Fees & Payment Receipts | Student Companion",
  description: "View school fee invoices, term breakdowns, balance dues, and payment history.",
};

export default async function StudentFeesPage({
  searchParams,
}: {
  searchParams?: { studentId?: string };
}) {
  const result = await getStudentFeesAction(searchParams?.studentId);

  if (!result.success) {
    return (
      <div className="py-8">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-6 text-center space-y-2">
          <ShieldAlert className="w-8 h-8 text-amber-400 mx-auto" />
          <h2 className="text-base font-bold text-amber-200">Fee Records Unavailable</h2>
          <p className="text-xs text-amber-300/80 max-w-sm mx-auto">
            {result.error || "Unable to retrieve student fee records at this time."}
          </p>
        </div>
      </div>
    );
  }

  return <StudentFeesClient data={result} />;
}
