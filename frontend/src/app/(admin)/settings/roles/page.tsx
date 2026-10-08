import { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/serverAuth";
import { assertRouteAccess } from "@/lib/routeGuards";
import { getRolesAndUserAccess } from "./actions";
import { RolesManagementClient } from "./RolesManagementClient";

export const metadata: Metadata = {
  title: "Role & Access Management | SchoolMitra ERP",
  description: "Manage tenant roles, user memberships, and security credentials.",
};

export default async function RolesManagementPage() {
  const ctx = await requireAuth();
  const access = assertRouteAccess(ctx.role, "/settings/roles", { id: ctx.userId, email: ctx.email });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  const result = await getRolesAndUserAccess();

  if (!result.success) {
    if (result.message?.includes("UNAUTHORIZED") || result.message?.includes("FORBIDDEN")) {
      redirect("/dashboard");
    }

    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          Failed to load roles: {result.message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <RolesManagementClient
        initialRoles={result.roles || []}
        initialUsers={result.users || []}
        currentUserRole={result.currentUserRole || "SCHOOL_ADMIN"}
        isSuperAdmin={result.isSuperAdmin || false}
      />
    </div>
  );
}
