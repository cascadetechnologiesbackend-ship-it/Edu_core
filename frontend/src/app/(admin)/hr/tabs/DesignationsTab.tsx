"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, PlusCircle, Trash2, Award } from "lucide-react";
import { toast } from "sonner";
import { AppModal } from "@/components/ui/AppModal";
import { Combobox, type ComboboxOption } from "@/components/forms/Combobox";
import {
  createDesignation,
  updateDesignation,
  archiveDesignation,
  deleteDesignation,
  getTeachingStaffDiagnostics,
  type TeachingStaffDiagnostics,
} from "../actions";

interface DesignationsTabProps {
  designations: any[];
  departments: any[];
  isAuthorizedHR: boolean;
  onRefresh?: () => void;
}

export function DesignationsTab({
  designations,
  departments,
  isAuthorizedHR,
  onRefresh,
}: DesignationsTabProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [modalType, setModalType] = useState<"create" | "edit" | null>(null);
  const [diagnostics, setDiagnostics] = useState<TeachingStaffDiagnostics | null>(null);
  const [fixingDesigId, setFixingDesigId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getTeachingStaffDiagnostics().then((res) => {
      if (isMounted && res.success && res.diagnostics) {
        setDiagnostics(res.diagnostics);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [designations]);

  const [desigForm, setDesigForm] = useState<{
    id?: string;
    name: string;
    departmentId: string;
    isTeaching: boolean;
    mappedRole?: string;
  }>({
    name: "",
    departmentId: departments[0]?.id || "",
    isTeaching: false,
    mappedRole: "STAFF",
  });

  const departmentOptions: ComboboxOption[] = useMemo(() => {
    return departments.map((d) => ({
      value: d.id,
      label: d.name,
    }));
  }, [departments]);

  const deptFilterOptions: ComboboxOption[] = useMemo(() => {
    return [
      { value: "ALL", label: "All Departments" },
      ...departments.map((d) => ({ value: d.id, label: d.name })),
    ];
  }, [departments]);

  const filteredDesignations = useMemo(() => {
    return designations.filter((d) => {
      if (deptFilter !== "ALL" && d.departmentId !== deptFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = d.name.toLowerCase().includes(q);
        const matchDept = d.department?.name && d.department.name.toLowerCase().includes(q);
        const matchRole = d.mappedRole && d.mappedRole.toLowerCase().includes(q);
        if (!matchName && !matchDept && !matchRole) return false;
      }
      return true;
    });
  }, [designations, searchQuery, deptFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desigForm.departmentId) {
      toast.error("Please select a department.");
      return;
    }
    setLoading(true);
    const res = await createDesignation({
      name: desigForm.name,
      departmentId: desigForm.departmentId,
      isTeaching: desigForm.isTeaching,
      mappedRole: desigForm.isTeaching ? "TEACHER" : desigForm.mappedRole,
    });
    setLoading(false);
    if (res.success) {
      toast.success(`Designation "${desigForm.name}" created successfully!`);
      setDesigForm({
        name: "",
        departmentId: departments[0]?.id || "",
        isTeaching: false,
        mappedRole: "STAFF",
      });
      setModalType(null);
      router.refresh();
      onRefresh?.();
    } else {
      toast.error(res.message || "Failed to create designation");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desigForm.id) return;
    setLoading(true);
    const res = await updateDesignation(desigForm.id, {
      name: desigForm.name,
      departmentId: desigForm.departmentId,
      isTeaching: desigForm.isTeaching,
      mappedRole: desigForm.isTeaching ? "TEACHER" : desigForm.mappedRole,
    });
    setLoading(false);
    if (res.success) {
      toast.success("Designation updated successfully!");
      setModalType(null);
      router.refresh();
      onRefresh?.();
    } else {
      toast.error(res.message || "Failed to update designation");
    }
  };

  const handleArchive = async (id: string, currentlyActive: boolean) => {
    const actionName = currentlyActive ? "archive" : "activate";
    if (!confirm(`Are you sure you want to ${actionName} this designation?`)) return;
    setLoading(true);
    const res = await archiveDesignation(id, currentlyActive);
    setLoading(false);
    if (res.success) {
      toast.success(`Designation ${actionName}d successfully!`);
      router.refresh();
      onRefresh?.();
    } else {
      toast.error(res.message || `Failed to ${actionName} designation`);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) return;
    setLoading(true);
    const res = await deleteDesignation(id);
    setLoading(false);
    if (res.success) {
      toast.success("Designation deleted successfully!");
      router.refresh();
      onRefresh?.();
    } else {
      toast.error(res.message || "Failed to delete designation");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap flex-1 max-w-xl">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search designations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-slate-800 rounded-xl text-xs md:text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-hidden focus:border-primary"
            />
          </div>

          <div className="w-52">
            <Combobox
              options={deptFilterOptions}
              value={deptFilter}
              onChange={setDeptFilter}
              placeholder="Filter by Department..."
              clearable={false}
            />
          </div>
        </div>

        {isAuthorizedHR && (
          <button
            type="button"
            onClick={() => {
              setDesigForm({
                name: "",
                departmentId: departments[0]?.id || "",
                isTeaching: false,
                mappedRole: "STAFF",
              });
              setModalType("create");
            }}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md self-start md:self-auto"
          >
            <PlusCircle className="w-4 h-4" />
            Add Designation
          </button>
        )}
      </div>

      {/* Classification Conflict Alert Banner (S14-F01) */}
      {diagnostics && diagnostics.conflictCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 animate-fade-in shadow-xs">
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-sm">
                Teaching Classification Conflict ({diagnostics.conflictCount})
              </p>
              <p className="text-amber-700/90 dark:text-amber-300/80 mt-0.5 leading-relaxed">
                {diagnostics.conflictCount} active staff member(s) hold the TEACHER system role but are assigned designations marked as non-teaching:{" "}
                <span className="font-semibold">
                  {diagnostics.conflicts.map((c) => `${c.employeeCode} (${c.designationName})`).join(", ")}
                </span>
                . These staff members are visible in dropdowns via fallback, but their designations should be marked as teaching.
              </p>
            </div>
          </div>

          {isAuthorizedHR && (
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {diagnostics.conflicts.map((c) => (
                <button
                  key={c.designationId}
                  type="button"
                  disabled={fixingDesigId === c.designationId}
                  onClick={async () => {
                    setFixingDesigId(c.designationId);
                    const res = await updateDesignation(c.designationId, { isTeaching: true });
                    setFixingDesigId(null);
                    if (res.success) {
                      toast.success(`Marked "${c.designationName}" as teaching designation.`);
                      router.refresh();
                      onRefresh?.();
                    } else {
                      toast.error(res.message || "Failed to update designation.");
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition shadow-xs disabled:opacity-50 cursor-pointer text-xs"
                >
                  {fixingDesigId === c.designationId ? "Updating..." : `Fix: Mark "${c.designationName}" Teaching`}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/40">
          <h3 className="font-bold text-xs uppercase tracking-wider text-gray-700 dark:text-gray-300">
            School Designations ({filteredDesignations.length})
          </h3>
        </div>

        {filteredDesignations.length === 0 ? (
          <div className="p-12 text-center text-gray-400 dark:text-gray-500 text-xs">
            <Award className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            No designations found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/10 text-gray-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="p-4">Designation Name</th>
                  <th className="p-4">Department</th>
                  <th className="p-4">Classification</th>
                  <th className="p-4">System Role</th>
                  <th className="p-4">Assigned Staff</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filteredDesignations.map((d) => {
                  const staffCount = d.staff?.length ?? 0;
                  return (
                    <tr key={d.id} className="hover:bg-gray-50/60 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 font-bold text-gray-900 dark:text-white">
                        {d.name}
                      </td>
                      <td className="p-4 text-gray-600 dark:text-gray-400">
                        {d.department?.name || "All Departments"}
                      </td>
                      <td className="p-4">
                        {d.isTeaching ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                            Teaching Faculty
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-400 border border-gray-200 dark:border-slate-700">
                            Non-Teaching
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-mono text-[11px] text-gray-500">
                        {d.mappedRole || (d.isTeaching ? "TEACHER" : "STAFF")}
                      </td>
                      <td className="p-4 text-gray-600 dark:text-gray-400">
                        {staffCount} member(s)
                      </td>
                      <td className="p-4">
                        {d.isActive ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            Active
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-400 border border-gray-200 dark:border-slate-700">
                            Archived
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {isAuthorizedHR && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setDesigForm({
                                  id: d.id,
                                  name: d.name,
                                  departmentId: d.departmentId,
                                  isTeaching: d.isTeaching,
                                  mappedRole: d.mappedRole || "STAFF",
                                });
                                setModalType("edit");
                              }}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleArchive(d.id, d.isActive)}
                              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                                d.isActive
                                  ? "border-amber-300 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                                  : "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                              }`}
                            >
                              {d.isActive ? "Archive" : "Activate"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(d.id, d.name)}
                              disabled={staffCount > 0}
                              className="p-1 text-rose-500 hover:text-rose-700 disabled:opacity-30 disabled:cursor-not-allowed"
                              title={staffCount > 0 ? "Cannot delete: staff assigned" : "Delete Designation"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <AppModal
        open={modalType !== null}
        onClose={() => setModalType(null)}
        size="md"
        title={modalType === "create" ? "Add Designation" : "Edit Designation"}
        description="Configure designation name, department attachment, and teaching role mapping."
      >
        <form onSubmit={modalType === "create" ? handleCreate : handleUpdate} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">
              Designation Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={desigForm.name}
              onChange={(e) => setDesigForm({ ...desigForm, name: e.target.value })}
              placeholder="e.g. Senior Secondary Teacher (Mathematics)"
              className="w-full h-10 px-3 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">
              Department <span className="text-rose-500">*</span>
            </label>
            <Combobox
              options={departmentOptions}
              value={desigForm.departmentId}
              onChange={(deptId) => setDesigForm({ ...desigForm, departmentId: deptId })}
              placeholder="Choose department..."
              clearable={false}
            />
          </div>

          <div className="p-3 bg-gray-50 dark:bg-slate-800/40 rounded-xl space-y-2 border border-gray-200 dark:border-slate-800">
            <label className="flex items-center gap-2 font-bold text-gray-900 dark:text-white cursor-pointer">
              <input
                type="checkbox"
                checked={desigForm.isTeaching}
                onChange={(e) => setDesigForm({ ...desigForm, isTeaching: e.target.checked })}
                className="rounded"
              />
              <span>Is Teaching Faculty?</span>
            </label>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Teaching faculty are automatically eligible for class subject mapping, period timetable assignments, and grading rosters.
            </p>
          </div>

          {!desigForm.isTeaching && (
            <div>
              <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">
                System Role Mapping
              </label>
              <select
                value={desigForm.mappedRole || "STAFF"}
                onChange={(e) => setDesigForm({ ...desigForm, mappedRole: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 outline-hidden"
              >
                <option value="STAFF">Standard Staff (STAFF)</option>
                <option value="ACCOUNTANT">Accountant / Bursar (ACCOUNTANT)</option>
                <option value="LIBRARIAN">Librarian (LIBRARIAN)</option>
                <option value="TRANSPORT_MANAGER">Transport Manager (TRANSPORT_MANAGER)</option>
                <option value="SCHOOL_ADMIN">School Admin / HR (SCHOOL_ADMIN)</option>
                <option value="PRINCIPAL">Principal / Head (PRINCIPAL)</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setModalType(null)}
              className="px-4 py-2 rounded-xl border text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-50"
            >
              {loading ? "Saving..." : modalType === "create" ? "Create Designation" : "Save Changes"}
            </button>
          </div>
        </form>
      </AppModal>
    </div>
  );
}
