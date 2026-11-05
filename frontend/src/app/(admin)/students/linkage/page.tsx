import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { assertRouteAccess } from "@/lib/routeGuards";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUnlinkedStudents } from "@schoolmitra/backend/lib/parentLinkage";
import { getClaimTrackingQueue } from "@schoolmitra/backend/lib/claimDistribution";
import { ParentLinkageClient } from "../ParentLinkageClient";
import { ClaimTrackingClient } from "./ClaimTrackingClient";
import { KeyRound, Users, ArrowLeft } from "lucide-react";

export default async function ParentLinkagePage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }> | { tab?: string };
}) {
  const resolvedSearchParams = await searchParams;
  const activeTab = resolvedSearchParams?.tab === "unlinked" ? "unlinked" : "tracking";

  const ctx = await requireAuth();
  const access = assertRouteAccess(ctx.role, "/students", {
    id: ctx.userId,
    email: ctx.email,
  });

  if (!access.allowed || !["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(ctx.role)) {
    redirect(access.redirectUrl || "/students");
  }

  const school = await requireSchool(ctx);
  const [unlinkedStudents, queueData] = await Promise.all([
    getUnlinkedStudents(school.id),
    getClaimTrackingQueue(school.id),
  ]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Header: Mandatory Law F1 (H1 names the job) ────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/day-one"
              className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Day One Cockpit</span>
            </Link>
            <span className="text-slate-600">·</span>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-primary">
              Day One Check 8
            </span>
          </div>
          <h1
            data-testid="claim-tracking-h1"
            className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1"
          >
            Parent Claim Distribution & Tracking
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Distribute parent verification credentials, monitor real-time claim status per student,
            download printable class sheets, and dispatch certified SMS reminders.
          </p>
        </div>

        {/* Quick Nav to Student Access */}
        <div className="shrink-0">
          <Link
            href="/students/access"
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 border border-slate-700 transition"
          >
            <span>Student Portal Access Queue</span>
          </Link>
        </div>
      </div>

      {/* ── Sub-Navigation Tabs ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-px">
        <Link
          href="/students/linkage?tab=tracking"
          className={`px-4 py-2.5 text-xs font-bold inline-flex items-center gap-2 border-b-2 transition ${
            activeTab === "tracking"
              ? "border-primary text-white"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Claim Tracking Queue ({queueData.summary.totalEnrolled})</span>
        </Link>
        <Link
          href="/students/linkage?tab=unlinked"
          className={`px-4 py-2.5 text-xs font-bold inline-flex items-center gap-2 border-b-2 transition ${
            activeTab === "unlinked"
              ? "border-primary text-white"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Unlinked Students & Repair ({unlinkedStudents.length})</span>
        </Link>
      </div>

      {/* ── Tab Content ────────────────────────────────────────────────────── */}
      {activeTab === "tracking" ? (
        <ClaimTrackingClient
          initialSummary={queueData.summary}
          initialItems={queueData.items}
        />
      ) : (
        <ParentLinkageClient initialUnlinkedStudents={unlinkedStudents} />
      )}
    </div>
  );
}
