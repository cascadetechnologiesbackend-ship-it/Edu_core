import { db } from "@/db";
import { schools, students, staff, academicYears } from "@/db/schema";
import { count, eq, desc } from "drizzle-orm";
import Link from "next/link";
import {
  Building2,
  Users,
  UserCheck,
  Search,
  Filter,
  Eye,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Calendar,
} from "lucide-react";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { signImpersonationToken } from "@/lib/impersonation";

export const metadata = {
  title: "School Tenants Directory | Super Admin",
  description: "Manage, inspect, and impersonate multi-tenant school instances.",
};

// Server action for Impersonation
async function startImpersonationAction(formData: FormData) {
  "use server";
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized: Super Admin access required.");
  }

  const schoolId = formData.get("schoolId") as string;
  const schoolName = formData.get("schoolName") as string;

  if (!schoolId) return;

  const token = signImpersonationToken(
    {
      superAdminId: session.user.id,
      superAdminEmail: session.user.email ?? "",
      schoolId,
      schoolName: schoolName || "School Instance",
      role: "SCHOOL_ADMIN",
    },
    60,
  );

  const cookieStore = cookies();
  cookieStore.set("sm_impersonation", token, {
    path: "/",
    maxAge: 3600, // 60 mins hard TTL
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  redirect("/dashboard");
}

// Server action for Status Lifecycle (R-14 Generic Administrative Suspension)
async function toggleSchoolStatusAction(formData: FormData) {
  "use server";
  const schoolId = formData.get("schoolId") as string;
  const currentStatus = formData.get("currentStatus") as string;
  const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

  if (!schoolId) return;

  await db
    .update(schools)
    .set({
      status: newStatus,
      suspensionReason:
        newStatus === "SUSPENDED"
          ? "Administrative review pending by platform operator"
          : null,
      updatedAt: new Date(),
    })
    .where(eq(schools.id, schoolId));

  revalidatePath("/super-admin/schools");
}

export default async function SchoolsPage({
  searchParams,
}: {
  searchParams?: { q?: string; board?: string; status?: string };
}) {
  const allSchools = await db.query.schools.findMany({
    orderBy: [desc(schools.createdAt)],
  });

  const query = searchParams?.q?.toLowerCase() ?? "";
  const boardFilter = searchParams?.board ?? "ALL";
  const statusFilter = searchParams?.status ?? "ALL";

  const filteredSchools = allSchools.filter((s) => {
    const matchesQuery =
      !query ||
      s.name.toLowerCase().includes(query) ||
      s.city.toLowerCase().includes(query) ||
      s.udiseCode.includes(query) ||
      (s.slug && s.slug.toLowerCase().includes(query));

    const matchesBoard = boardFilter === "ALL" || s.board === boardFilter;
    const matchesStatus = statusFilter === "ALL" || (s.status ?? "ACTIVE") === statusFilter;

    return matchesQuery && matchesBoard && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-indigo-400" /> School Tenant Directory
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Governing {allSchools.length} registered school instances across all educational boards.
          </p>
        </div>

      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <form method="GET" className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            name="q"
            defaultValue={searchParams?.q ?? ""}
            placeholder="Search by school, city, or UDISE..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
          />
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto text-xs">
          <Link
            href="/super-admin/schools"
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              statusFilter === "ALL"
                ? "bg-indigo-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            All ({allSchools.length})
          </Link>
          <Link
            href="/super-admin/schools?status=ACTIVE"
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              statusFilter === "ACTIVE"
                ? "bg-emerald-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            Active ({allSchools.filter((s) => (s.status ?? "ACTIVE") === "ACTIVE").length})
          </Link>
          <Link
            href="/super-admin/schools?status=SUSPENDED"
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              statusFilter === "SUSPENDED"
                ? "bg-amber-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            Suspended ({allSchools.filter((s) => s.status === "SUSPENDED").length})
          </Link>
        </div>
      </div>

      {/* Schools Grid / Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">School Profile</th>
                <th className="py-3.5 px-4">Board & Curriculum</th>
                <th className="py-3.5 px-4">Location</th>
                <th className="py-3.5 px-4">UDISE / Slug</th>
                <th className="py-3.5 px-4">Lifecycle Status</th>
                <th className="py-3.5 px-4 text-right">Operator Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredSchools.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No schools match the specified search or filter criteria.
                  </td>
                </tr>
              ) : (
                filteredSchools.map((s) => {
                  const isActive = (s.status ?? "ACTIVE") === "ACTIVE";

                  return (
                    <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-sm">
                            {s.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm">{s.name}</div>
                            <div className="text-[11px] text-slate-400">
                              Principal: {s.principalName ?? "Not Assigned"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                          {s.board}
                        </span>
                        <div className="text-[11px] text-slate-500 mt-1">
                          {s.schoolType ?? "Standard"}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-slate-300">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          <span>{s.city}, {s.state}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">{s.phone}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-mono text-slate-300">{s.udiseCode}</div>
                        <div className="text-[11px] text-indigo-400 font-mono">
                          /{s.slug ?? s.id.slice(0, 8)}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            <AlertCircle className="w-3 h-3" />
                            SUSPENDED
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          {/* 1-Click Impersonate Button */}
                          <form action={startImpersonationAction}>
                            <input type="hidden" name="schoolId" value={s.id} />
                            <input type="hidden" name="schoolName" value={s.name} />
                            <button
                              type="submit"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-medium transition text-xs active:scale-95 shadow-sm"
                              title="Enter school with Superadmin Impersonation Token"
                            >
                              <Eye className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Impersonate</span>
                            </button>
                          </form>

                          {/* Lifecycle Suspend / Reactivate (R-14) */}
                          <form action={toggleSchoolStatusAction}>
                            <input type="hidden" name="schoolId" value={s.id} />
                            <input type="hidden" name="currentStatus" value={s.status ?? "ACTIVE"} />
                            <button
                              type="submit"
                              className={`p-1.5 rounded-lg border text-xs transition ${
                                isActive
                                  ? "border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                                  : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                              }`}
                              title={isActive ? "Suspend School Instance" : "Reactivate School Instance"}
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
