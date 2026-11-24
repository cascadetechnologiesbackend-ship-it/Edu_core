"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  Users,
  KeyRound,
  UserX,
  UserCheck,
  Plus,
  Edit2,
  Lock,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  Table,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDestructive } from "@/components/finance/ConfirmDestructive";
import {
  createRole,
  updateRole,
  assignUserRole,
  removeUserRole,
  toggleUserAccess,
  resetStaffCredentialAction,
} from "./actions";
import {
  BASELINE_PERMISSION_MATRIX,
  type UserRole,
  type PermissionMatrixRow,
  ROLE_CONFIGS,
} from "@/lib/roleConfig";

interface RoleItem {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  isSystemRole: boolean;
  createdAt: Date | null;
  userCount: number;
}

interface UserItem {
  id: string;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date | null;
  staffFirstName: string | null;
  staffLastName: string | null;
  staffEmployeeId: string | null;
  designationName: string | null;
  designationMappedRole: string | null;
  departmentName: string | null;
  assignedRoles: Array<{
    id: string;
    roleId: string;
    name: string;
    displayName: string;
  }>;
}

interface RolesManagementClientProps {
  initialRoles: RoleItem[];
  initialUsers: UserItem[];
  currentUserRole: string;
  isSuperAdmin: boolean;
}

export function RolesManagementClient({
  initialRoles,
  initialUsers,
  currentUserRole,
  isSuperAdmin,
}: RolesManagementClientProps) {
  const [activeTab, setActiveTab] = useState<"users" | "roles" | "matrix">("users");
  const [rolesList, setRolesList] = useState<RoleItem[]>(initialRoles);
  const [usersList, setUsersList] = useState<UserItem[]>(initialUsers);
  const [isPending, setIsPending] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  // Destructive Action Modal States
  const [destructiveModal, setDestructiveModal] = useState<{
    isOpen: boolean;
    type: "DEACTIVATE" | "RESET_CREDENTIALS" | "REMOVE_ROLE";
    targetUserId?: string;
    targetRoleId?: string;
    targetName?: string;
    title: string;
    description: string;
    confirmLabel: string;
  }>({
    isOpen: false,
    type: "DEACTIVATE",
    title: "",
    description: "",
    confirmLabel: "",
  });

  // Assign Role Modal
  const [assignRoleModal, setAssignRoleModal] = useState<{
    isOpen: boolean;
    userId: string;
    userEmail: string;
    selectedRoleId: string;
  }>({
    isOpen: false,
    userId: "",
    userEmail: "",
    selectedRoleId: "",
  });

  // Manual Credentials Modal (for SMS fallback)
  const [credentialModal, setCredentialModal] = useState<{
    isOpen: boolean;
    email: string;
    tempPassword: string;
    roleDisplayName: string;
    dashboardUrl: string;
    warning?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Role Create / Edit Modal
  const [roleModal, setRoleModal] = useState<{
    isOpen: boolean;
    mode: "CREATE" | "EDIT";
    roleId?: string;
    name: UserRole;
    displayName: string;
    description: string;
  }>({
    isOpen: false,
    mode: "CREATE",
    name: "SCHOOL_ADMIN",
    displayName: "",
    description: "",
  });

  // Filtered Users
  const filteredUsers = usersList.filter((u) => {
    const nameMatch = `${u.staffFirstName || ""} ${u.staffLastName || ""} ${u.email} ${u.staffEmployeeId || ""}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const roleMatch =
      roleFilter === "ALL" || u.assignedRoles.some((r) => r.name === roleFilter);
    return nameMatch && roleMatch;
  });

  // Handle Destructive Actions
  const handleDestructiveConfirm = async (reason: string) => {
    setIsPending(true);
    try {
      if (destructiveModal.type === "DEACTIVATE" && destructiveModal.targetUserId) {
        const target = usersList.find((u) => u.id === destructiveModal.targetUserId);
        const nextState = !target?.isActive;
        const res = await toggleUserAccess({
          userId: destructiveModal.targetUserId,
          isActive: nextState,
          reason,
        });
        if (res.success) {
          toast.success(res.message);
          setUsersList((prev) =>
            prev.map((u) =>
              u.id === destructiveModal.targetUserId ? { ...u, isActive: nextState } : u,
            ),
          );
        } else {
          toast.error(res.message);
        }
      } else if (
        destructiveModal.type === "RESET_CREDENTIALS" &&
        destructiveModal.targetUserId
      ) {
        const res = await resetStaffCredentialAction({
          userId: destructiveModal.targetUserId,
          reason,
        });
        if (res.success) {
          if (res.credentials) {
            toast.warning(res.warning || "SMS not delivered.");
            setCredentialModal({
              isOpen: true,
              email: res.credentials.email,
              tempPassword: res.credentials.tempPassword,
              roleDisplayName: res.credentials.roleDisplayName,
              dashboardUrl: res.credentials.dashboardUrl,
              warning: res.warning,
            });
          } else {
            toast.success(res.message || "Credentials reset successfully.");
          }
        } else {
          toast.error(res.message);
        }
      } else if (
        destructiveModal.type === "REMOVE_ROLE" &&
        destructiveModal.targetUserId &&
        destructiveModal.targetRoleId
      ) {
        const res = await removeUserRole({
          userId: destructiveModal.targetUserId,
          roleId: destructiveModal.targetRoleId,
          reason,
        });
        if (res.success) {
          toast.success(res.message);
          setUsersList((prev) =>
            prev.map((u) => {
              if (u.id !== destructiveModal.targetUserId) return u;
              return {
                ...u,
                assignedRoles: u.assignedRoles.filter(
                  (r) => r.roleId !== destructiveModal.targetRoleId,
                ),
              };
            }),
          );
          setRolesList((prev) =>
            prev.map((r) =>
              r.id === destructiveModal.targetRoleId
                ? { ...r, userCount: Math.max(0, r.userCount - 1) }
                : r,
            ),
          );
        } else {
          toast.error(res.message);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Operation failed.");
    } finally {
      setIsPending(false);
      setDestructiveModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  // Handle Assign Role
  const handleAssignRole = async () => {
    if (!assignRoleModal.selectedRoleId) {
      toast.error("Please select a role to assign.");
      return;
    }
    setIsPending(true);
    try {
      const res = await assignUserRole({
        userId: assignRoleModal.userId,
        roleId: assignRoleModal.selectedRoleId,
        reason: "Administrative assignment via Role Management",
      });
      if (res.success) {
        toast.success(res.message);
        const assignedRoleObj = rolesList.find(
          (r) => r.id === assignRoleModal.selectedRoleId,
        );
        if (assignedRoleObj) {
          setUsersList((prev) =>
            prev.map((u) => {
              if (u.id !== assignRoleModal.userId) return u;
              return {
                ...u,
                assignedRoles: [
                  ...u.assignedRoles,
                  {
                    id: crypto.randomUUID(),
                    roleId: assignedRoleObj.id,
                    name: assignedRoleObj.name,
                    displayName: assignedRoleObj.displayName,
                  },
                ],
              };
            }),
          );
          setRolesList((prev) =>
            prev.map((r) =>
              r.id === assignedRoleObj.id
                ? { ...r, userCount: r.userCount + 1 }
                : r,
            ),
          );
        }
        setAssignRoleModal({ isOpen: false, userId: "", userEmail: "", selectedRoleId: "" });
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to assign role.");
    } finally {
      setIsPending(false);
    }
  };

  // Handle Create / Edit Role
  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleModal.displayName.trim()) {
      toast.error("Display name is required.");
      return;
    }
    setIsPending(true);
    try {
      if (roleModal.mode === "CREATE") {
        const res = await createRole({
          name: roleModal.name,
          displayName: roleModal.displayName,
          description: roleModal.description,
        });
        if (res.success) {
          toast.success(res.message);
          window.location.reload();
        } else {
          toast.error(res.message);
        }
      } else if (roleModal.mode === "EDIT" && roleModal.roleId) {
        const res = await updateRole({
          roleId: roleModal.roleId,
          displayName: roleModal.displayName,
          description: roleModal.description,
        });
        if (res.success) {
          toast.success(res.message);
          setRolesList((prev) =>
            prev.map((r) =>
              r.id === roleModal.roleId
                ? {
                    ...r,
                    displayName: roleModal.displayName.trim(),
                    description: roleModal.description.trim() || null,
                  }
                : r,
            ),
          );
          setRoleModal((prev) => ({ ...prev, isOpen: false }));
        } else {
          toast.error(res.message);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save role.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-[#007AFF]/10 dark:bg-[#0A84FF]/10 text-[#007AFF] dark:text-[#0A84FF] dark:text-[#007AFF] dark:text-[#0A84FF]">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-foreground">
              Role & Access Management
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-muted/50 text-muted-foreground dark:bg-muted/60 dark:text-muted-foreground">
              {currentUserRole}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Authoritative RBAC governance, staff role allocations, and security credentials management.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 bg-muted/60/80 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === "users"
                ? "bg-card text-[#007AFF] dark:text-[#0A84FF] dark:text-[#007AFF] dark:text-[#0A84FF] shadow-sm"
                : "text-muted-foreground hover:text-gray-900"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            User Access ({usersList.length})
          </button>
          <button
            onClick={() => setActiveTab("roles")}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === "roles"
                ? "bg-card text-[#007AFF] dark:text-[#0A84FF] dark:text-[#007AFF] dark:text-[#0A84FF] shadow-sm"
                : "text-muted-foreground hover:text-gray-900"
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            Configured Roles ({rolesList.length})
          </button>
          <button
            onClick={() => setActiveTab("matrix")}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === "matrix"
                ? "bg-card text-[#007AFF] dark:text-[#0A84FF] dark:text-[#007AFF] dark:text-[#0A84FF] shadow-sm"
                : "text-muted-foreground hover:text-gray-900"
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            Permission Matrix
          </button>
        </div>
      </div>

      {/* TAB 1: USERS ACCESS & ASSIGNMENTS */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search staff by name, email, employee ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-80 px-3 py-2 text-sm rounded-lg border border-border/60 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-[#007AFF] dark:focus:ring-[#0A84FF]"
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-border/60 bg-card text-foreground"
              >
                <option value="ALL">All Roles</option>
                {rolesList.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-muted-foreground self-end sm:self-auto">
              Showing {filteredUsers.length} of {usersList.length} users
            </div>
          </div>

          {/* Table */}
          <div className="border border-border/40 rounded-xl overflow-hidden bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-4">User / Staff Member</th>
                    <th className="py-3 px-4">Designation & Department</th>
                    <th className="py-3 px-4">Assigned Roles</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-sm">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        No users matching filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const fullName =
                        user.staffFirstName || user.staffLastName
                          ? `${user.staffFirstName || ""} ${user.staffLastName || ""}`.trim()
                          : "User";

                      return (
                        <tr
                          key={user.id}
                          className="hover:bg-muted/40 transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-foreground">
                              {fullName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {user.email}
                              {user.staffEmployeeId && (
                                <span className="ml-1.5 px-1.5 py-0.2 text-[10px] bg-muted/50 dark:bg-muted/60 rounded font-mono">
                                  {user.staffEmployeeId}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            <div className="font-medium text-foreground">
                              {user.designationName || "—"}
                            </div>
                            <div className="text-muted-foreground">
                              {user.departmentName || "General"}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {user.assignedRoles.length === 0 ? (
                                <span className="text-xs text-rose-500 font-medium bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded">
                                  No Role (403)
                                </span>
                              ) : (
                                user.assignedRoles.map((r) => (
                                  <span
                                    key={r.id}
                                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[#007AFF]/10 dark:bg-[#0A84FF]/10 text-[#007AFF] dark:text-[#0A84FF] dark:text-[#007AFF] dark:text-[#0A84FF] border border-[#007AFF]/20 dark:border-[#007AFF]/30"
                                  >
                                    {r.displayName}
                                    <button
                                      title="Revoke Role"
                                      disabled={isPending}
                                      onClick={() =>
                                        setDestructiveModal({
                                          isOpen: true,
                                          type: "REMOVE_ROLE",
                                          targetUserId: user.id,
                                          targetRoleId: r.roleId,
                                          targetName: `${r.displayName} from ${user.email}`,
                                          title: "Revoke Assigned Role",
                                          description: `Are you sure you want to revoke the role "${r.displayName}" from ${user.email}? The user will immediately lose access to associated modules.`,
                                          confirmLabel: "Revoke Role",
                                        })
                                      }
                                      className="hover:text-rose-600 transition-colors ml-0.5"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))
                              )}
                              <button
                                title="Assign Role"
                                onClick={() =>
                                  setAssignRoleModal({
                                    isOpen: true,
                                    userId: user.id,
                                    userEmail: user.email,
                                    selectedRoleId: "",
                                  })
                                }
                                className="inline-flex items-center gap-0.5 text-xs text-[#007AFF] dark:text-[#0A84FF] hover:text-[#007AFF] dark:text-[#0A84FF] font-medium px-1.5 py-0.5 rounded border border-dashed border-[#007AFF]/30 dark:border-[#007AFF]/40 hover:bg-muted/20 dark:hover:bg-[#0A84FF]/20 transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                                Add
                              </button>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                                  user.isActive
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                                    : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                                }`}
                              >
                                {user.isActive ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3" />
                                    Active
                                  </>
                                ) : (
                                  <>
                                    <UserX className="w-3 h-3" />
                                    Suspended
                                  </>
                                )}
                              </span>
                              {user.mustChangePassword && (
                                <span
                                  title="Password change required on next login"
                                  className="text-[10px] px-1.5 py-0.2 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 rounded border border-amber-200 dark:border-amber-800"
                                >
                                  Pwd Reset Req
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Reset Credentials Button */}
                              <button
                                title="Reset Credentials & Send SMS"
                                onClick={() =>
                                  setDestructiveModal({
                                    isOpen: true,
                                    type: "RESET_CREDENTIALS",
                                    targetUserId: user.id,
                                    targetName: user.email,
                                    title: "Reset Staff Credentials",
                                    description: `Generate a new secure temporary password for ${user.email}, revoke all active sessions, and dispatch credential SMS. A mandatory audit reason is required.`,
                                    confirmLabel: "Reset Password & Send SMS",
                                  })
                                }
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-[#007AFF] dark:text-[#0A84FF] hover:bg-[#007AFF]/10 dark:text-muted-foreground dark:hover:bg-muted/60 transition-colors"
                              >
                                <KeyRound className="w-4 h-4" />
                              </button>

                              {/* Toggle Active Button */}
                              <button
                                title={user.isActive ? "Deactivate User Access" : "Activate User Access"}
                                onClick={() =>
                                  setDestructiveModal({
                                    isOpen: true,
                                    type: "DEACTIVATE",
                                    targetUserId: user.id,
                                    targetName: user.email,
                                    title: user.isActive ? "Deactivate User Access" : "Activate User Access",
                                    description: user.isActive
                                      ? `Suspend login access for ${user.email} and revoke all current active sessions. Last SUPER_ADMIN cannot be deactivated.`
                                      : `Restore login access for ${user.email}.`,
                                    confirmLabel: user.isActive ? "Deactivate Access" : "Activate Access",
                                  })
                                }
                                className={`p-1.5 rounded-lg transition-colors ${
                                  user.isActive
                                    ? "text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:text-muted-foreground dark:hover:bg-rose-950/40"
                                    : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                }`}
                              >
                                {user.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                              </button>
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
      )}

      {/* TAB 2: CONFIGURED ROLES */}
      {activeTab === "roles" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              System and custom roles registered for this tenant. System roles are pre-seeded with authoritative guards.
            </p>
            {isSuperAdmin && (
              <button
                onClick={() =>
                  setRoleModal({
                    isOpen: true,
                    mode: "CREATE",
                    name: "SCHOOL_ADMIN",
                    displayName: "",
                    description: "",
                  })
                }
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#007AFF] dark:bg-[#0A84FF] text-white hover:opacity-90 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                New Role
              </button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rolesList.map((r) => {
              const config = ROLE_CONFIGS[r.name as UserRole];

              return (
                <div
                  key={r.id}
                  className="p-4 rounded-xl border border-border/40 bg-card shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-foreground flex items-center gap-1.5">
                          {r.displayName}
                        </h3>
                        <span className="text-xs font-mono text-gray-400">{r.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {r.isSystemRole ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-muted/50 text-muted-foreground dark:bg-muted/60 dark:text-muted-foreground">
                            System
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                            Custom
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {r.description || `Default permissions and landing dashboard for ${r.displayName}.`}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      <strong className="text-foreground font-semibold">
                        {r.userCount}
                      </strong>{" "}
                      users assigned
                    </span>

                    <div className="flex items-center gap-1">
                      {isSuperAdmin && !r.isSystemRole && (
                        <button
                          onClick={() =>
                            setRoleModal({
                              isOpen: true,
                              mode: "EDIT",
                              roleId: r.id,
                              name: r.name as UserRole,
                              displayName: r.displayName,
                              description: r.description || "",
                            })
                          }
                          className="p-1 rounded text-muted-foreground hover:text-[#007AFF] dark:text-[#0A84FF] hover:bg-muted/50 dark:hover:bg-muted/60"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <span className="text-[11px] text-gray-400 font-mono">
                        {config?.defaultDashboard || "/dashboard"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: AUTHORITATIVE PERMISSION MATRIX */}
      {activeTab === "matrix" && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Authoritative Baseline Matrix:</span> This reference table mirrors the server-side action guards enforced across Finance, HR, and Security APIs. Automated tests continuously assert that UI buttons and server matrix guards never diverge.
            </div>
          </div>

          <div className="border border-border/40 rounded-xl overflow-hidden bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/40 font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-4">Domain / Module</th>
                    <th className="py-3 px-4">Protected Action</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Authorized Roles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {BASELINE_PERMISSION_MATRIX.map((row: PermissionMatrixRow, idx: number) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="py-3 px-4 font-semibold text-foreground whitespace-nowrap">
                        {row.module}
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">
                        {row.action}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {row.description}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {row.allowedRoles.map((role: UserRole) => (
                            <span
                              key={role}
                              className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold ${
                                role === "SUPER_ADMIN"
                                  ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                                  : role === "SCHOOL_ADMIN"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                  : role === "ACCOUNTANT"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  : "bg-muted/50 text-foreground dark:bg-muted/60 dark:text-muted-foreground"
                              }`}
                            >
                              {role}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DESTRUCTIVE MODAL */}
      <ConfirmDestructive
        isOpen={destructiveModal.isOpen}
        onClose={() => setDestructiveModal((prev) => ({ ...prev, isOpen: false }))}
        title={destructiveModal.title}
        description={destructiveModal.description}
        confirmLabel={destructiveModal.confirmLabel}
        requireReason={true}
        reasonPlaceholder="Mandatory audit justification required by DPDP / ERP governance..."
        isPending={isPending}
        onConfirm={handleDestructiveConfirm}
      />

      {/* ASSIGN ROLE MODAL */}
      {assignRoleModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-card border border-border/40 rounded-2xl shadow-2xl p-5 space-y-4">
            <h3 className="text-base font-bold text-foreground">
              Assign Role to User
            </h3>
            <p className="text-xs text-muted-foreground">
              Grant an additional ERP role to <strong className="text-foreground">{assignRoleModal.userEmail}</strong>.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                Select Role:
              </label>
              <select
                value={assignRoleModal.selectedRoleId}
                onChange={(e) =>
                  setAssignRoleModal((prev) => ({ ...prev, selectedRoleId: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-border/60 bg-card text-foreground"
              >
                <option value="">-- Choose a Role --</option>
                {rolesList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.displayName} ({r.name})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() =>
                  setAssignRoleModal({ isOpen: false, userId: "", userEmail: "", selectedRoleId: "" })
                }
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-muted-foreground hover:bg-gray-100 dark:hover:bg-muted/60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending || !assignRoleModal.selectedRoleId}
                onClick={handleAssignRole}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#007AFF] dark:bg-[#0A84FF] text-white hover:opacity-90 disabled:opacity-50 transition-colors shadow-sm"
              >
                {isPending ? "Assigning..." : "Assign Role"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL CREDENTIALS MODAL (SMS FALLBACK) */}
      {credentialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-card border border-border/40 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-5 h-5" />
              <h3 className="text-base font-bold text-foreground">
                Credentials Generated (Manual Copy)
              </h3>
            </div>
            {credentialModal.warning && (
              <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800">
                {credentialModal.warning}
              </p>
            )}

            <div className="p-3.5 rounded-xl bg-muted/30 dark:bg-muted/40 border border-border/40 dark:border-border/40 font-mono text-xs space-y-2">
              <div>
                <span className="text-gray-400">Login Email:</span>{" "}
                <strong className="text-foreground select-all">
                  {credentialModal.email}
                </strong>
              </div>
              <div>
                <span className="text-gray-400">Temp Password:</span>{" "}
                <strong className="text-[#007AFF] dark:text-[#0A84FF] dark:text-[#007AFF] dark:text-[#0A84FF] font-bold text-sm select-all">
                  {credentialModal.tempPassword}
                </strong>
              </div>
              <div>
                <span className="text-gray-400">Role:</span>{" "}
                <span className="text-foreground">
                  {credentialModal.roleDisplayName}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Dashboard Landing:</span>{" "}
                <span className="text-foreground">
                  {credentialModal.dashboardUrl}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Login: ${credentialModal.email}\nTemp Password: ${credentialModal.tempPassword}\nDashboard: ${credentialModal.dashboardUrl}`,
                  );
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#007AFF]/20 dark:border-[#007AFF]/30 text-[#007AFF] dark:text-[#0A84FF] dark:text-[#007AFF] dark:text-[#0A84FF] hover:bg-[#007AFF]/10 dark:hover:bg-[#0A84FF]/20 flex items-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy Credentials"}
              </button>

              <button
                type="button"
                onClick={() => setCredentialModal(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#007AFF] dark:bg-[#0A84FF] text-white hover:opacity-90 shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT ROLE MODAL (SUPER_ADMIN) */}
      {roleModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <form
            onSubmit={handleSaveRole}
            className="w-full max-w-md bg-card border border-border/40 rounded-2xl shadow-2xl p-5 space-y-4"
          >
            <h3 className="text-base font-bold text-foreground">
              {roleModal.mode === "CREATE" ? "Create New Tenant Role" : "Edit Role"}
            </h3>

            {roleModal.mode === "CREATE" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Role Schema Enum:
                </label>
                <select
                  value={roleModal.name}
                  onChange={(e) =>
                    setRoleModal((prev) => ({ ...prev, name: e.target.value as UserRole }))
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border/60 bg-card text-foreground"
                >
                  {Object.keys(ROLE_CONFIGS).map((key) => (
                    <option key={key} value={key}>
                      {key} ({ROLE_CONFIGS[key as UserRole].displayName})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Display Name:
              </label>
              <input
                type="text"
                required
                value={roleModal.displayName}
                onChange={(e) =>
                  setRoleModal((prev) => ({ ...prev, displayName: e.target.value }))
                }
                placeholder="e.g. Senior Bursar / Accounts Head"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border/60 bg-card text-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Description:
              </label>
              <textarea
                rows={3}
                value={roleModal.description}
                onChange={(e) =>
                  setRoleModal((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Operational purpose and scope of this role..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-border/60 bg-card text-foreground"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRoleModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-muted-foreground hover:bg-gray-100 dark:hover:bg-muted/60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#007AFF] dark:bg-[#0A84FF] text-white hover:opacity-90 disabled:opacity-50 transition-colors shadow-sm"
              >
                {isPending ? "Saving..." : "Save Role"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
