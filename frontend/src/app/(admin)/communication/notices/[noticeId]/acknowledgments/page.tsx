import React from "react";
import { getNoticeAcknowledgmentReport } from "../../actions";
import { NoticeAcknowledgmentsAdminClient } from "../../NoticeAcknowledgmentsAdminClient";
import Link from "next/link";
import { AlertCircle, ChevronLeft } from "lucide-react";

interface PageProps {
  params: {
    noticeId: string;
  };
}

export default async function NoticeAcknowledgmentsPage({ params }: PageProps) {
  const res = await getNoticeAcknowledgmentReport(params.noticeId);

  if (!res.success || !res.report) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Link
          href="/admin/communication/notices"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Notices</span>
        </Link>

        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 p-8 text-center">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Notice Report Not Available
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {res.error || "The circular could not be found or you do not have permission to view this report."}
          </p>
        </div>
      </div>
    );
  }

  return <NoticeAcknowledgmentsAdminClient report={res.report} />;
}
