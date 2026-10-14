export const dynamic = "force-dynamic";

import { fetchParentStudentDocuments } from "@/app/(parent)/portal/actions";
import ParentDocumentsClient from "./ParentDocumentsClient";
import Link from "next/link";
import { FolderCheck, AlertCircle } from "lucide-react";

export const metadata = {
  title: "Documents & Certificates | Parent Companion",
  description: "View and upload verified student certificates and documents.",
};

export default async function ParentDocumentsPage({
  searchParams,
}: {
  searchParams?: { studentId?: string };
}) {
  const result = await fetchParentStudentDocuments(searchParams?.studentId);

  if (!result.success || !result.students || result.students.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Document Center
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Upload and view official school documents for your child.
          </p>
        </div>

        <div className="rounded-2xl border border-rose-900/40 bg-rose-950/20 p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-rose-300">No Student Profile Linked</h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {result.message ||
              "No students are currently linked to your parent account. If your child recently enrolled, please contact the school administration office."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <FolderCheck className="w-6 h-6 text-indigo-400" />
              <span>Ward Documents</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload and manage statutory certificates (Birth certificate, Aadhaar, TC, Photos, Medical records).
            </p>
          </div>
        </div>

        {/* Portal Horizontal Pill Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          <Link
            href="/portal"
            className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
          >
            Fees &amp; Dues
          </Link>
          <Link
            href="/portal/report-cards"
            className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
          >
            Report Cards
          </Link>
          <Link
            href="/portal/consent"
            className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
          >
            Consent Center
          </Link>
          <span className="px-3.5 py-2 rounded-xl font-bold bg-indigo-600 text-white shadow-md shadow-indigo-600/30 whitespace-nowrap">
            Documents
          </span>
          <Link
            href="/portal/rights"
            className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
          >
            DPDP Privacy Rights
          </Link>
        </div>
      </div>

      {/* Main Interactive Client Component */}
      <ParentDocumentsClient
        students={result.students}
        initialSelectedStudentId={result.selectedStudentId || result.students[0]?.id || ""}
        initialDocuments={result.documents || []}
      />
    </div>
  );
}
