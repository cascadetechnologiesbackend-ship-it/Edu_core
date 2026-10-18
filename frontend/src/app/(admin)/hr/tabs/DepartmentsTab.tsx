"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, PlusCircle, Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { AppModal } from "@/components/ui/AppModal";
import {
  createDepartment,
  updateDepartment,
  archiveDepartment,
  deleteDepartment,
} from "../actions";

interface DepartmentsTabProps {
  departments: any[];
  isAuthorizedHR: boolean;
  onRefresh?: () => void;
}

export function DepartmentsTab({
  departments,
  isAuthorizedHR,
  onRefresh,
}: DepartmentsTabProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalType, setModalType] = useState<"create" | "edit" | null>(null);
  const [deptForm, setDeptForm] = useState<{ id?: string; name: string }>({ name: "" });

  const filteredDepartments = useMemo(() => {
    if (!searchQuery.trim()) return departments;
    const q = searchQuery.toLowerCase().trim();
    return departments.filter((d) => d.name.toLowerCase().includes(q));
  }, [departments, searchQuery]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await createDepartment(deptForm.name);
    setLoading(false);
    if (res.success) {
      toast.success(`Department "${deptForm.name}" created successfully!`);
      setDeptForm({ name: "" });
      setModalType(null);
      router.refresh();
      onRefresh?.();
    } else {
      toast.error(res.message || "Failed to create department");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptForm.id) return;
    setLoading(true);
    const res = await updateDepartment(deptForm.id, deptForm.name);
    setLoading(false);
    if (res.success) {
      toast.success("Department renamed successfully!");
      setDeptForm({ name: "" });
      setModalType(null);
      router.refresh();
      onRefresh?.();
    } else {
      toast.error(res.message || "Failed to update department");
    }
  };

  const handleArchive = async (id: string, currentlyActive: boolean) => {
    const actionName = currentlyActive ? "archive" : "activate";
    if (!confirm(`Are you sure you want to ${actionName} this department?`)) return;
    setLoading(true);
    const res = await archiveDepartment(id, currentlyActive);
    setLoading(false);
    if (res.success) {
      toast.success(`Department ${actionName}d successfully!`);
      router.refresh();
      onRefresh?.();
    } else {
      toast.error(res.message || `Failed to ${actionName} department`);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) return;
    setLoading(true);
    const res = await deleteDepartment(id);
    setLoading(false);
    if (res.success) {
      toast.success("Department deleted successfully!");
      router.refresh();
      onRefresh?.();
    } else {
      toast.error(res.message || "Failed to delete department");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search departments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-slate-800 rounded-xl text-xs md:text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-hidden focus:border-primary"
          />
        </div>

        {isAuthorizedHR && (
          <button
            type="button"
            onClick={() => {
              setDeptForm({ name: "" });
              setModalType("create");
            }}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md self-start md:self-auto"
          >
            <PlusCircle className="w-4 h-4" />
            Add Department
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/40">
          <h3 className="font-bold text-xs uppercase tracking-wider text-gray-700 dark:text-gray-300">
            School Departments ({filteredDepartments.length})
          </h3>
        </div>

        {filteredDepartments.length === 0 ? (
          <div className="p-12 text-center text-gray-400 dark:text-gray-500 text-xs">
            <Building2 className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            No departments found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/10 text-gray-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="p-4">Department Name</th>
                  <th className="p-4">Assigned Staff</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filteredDepartments.map((d) => {
                  const staffCount = d.staff?.length ?? 0;
                  return (
                    <tr key={d.id} className="hover:bg-gray-50/60 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 font-bold text-gray-900 dark:text-white">
                        {d.name}
                      </td>
                      <td className="p-4 text-gray-600 dark:text-gray-400">
                        {staffCount} staff member(s)
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
                                setDeptForm({ id: d.id, name: d.name });
                                setModalType("edit");
                              }}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                            >
                              Rename
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
                              title={staffCount > 0 ? "Cannot delete: staff assigned" : "Delete Department"}
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
        size="sm"
        title={modalType === "create" ? "Add Department" : "Rename Department"}
        description={modalType === "create" ? "Create a new school academic or administrative department." : "Update department name."}
      >
        <form onSubmit={modalType === "create" ? handleCreate : handleUpdate} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">
              Department Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={deptForm.name}
              onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
              placeholder="e.g. Science & STEM"
              className="w-full h-10 px-3 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 outline-hidden"
            />
          </div>
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
              {loading ? "Saving..." : modalType === "create" ? "Create Department" : "Save Changes"}
            </button>
          </div>
        </form>
      </AppModal>
    </div>
  );
}
