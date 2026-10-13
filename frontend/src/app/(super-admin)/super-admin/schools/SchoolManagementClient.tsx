"use client";

import React, { useState, useTransition } from "react";
import {
  Building2,
  Plus,
  Search,
  Filter,
  Eye,
  ShieldAlert,
  Edit2,
  Trash2,
  MapPin,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  Globe,
  Mail,
  Phone,
  Calendar,
  School,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  createSchoolAction,
  updateSchoolAction,
  deleteSchoolAction,
  toggleSchoolStatusAction,
  startImpersonationAction,
  SchoolFormInput,
} from "./actions";

export interface SchoolItem {
  id: string;
  name: string;
  board: "CBSE" | "ICSE" | "STATE_BOARD" | "IGCSE" | "IB";
  udiseCode: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  principalName: string;
  establishedYear: number;
  schoolType: string | null;
  website: string | null;
  slug: string | null;
  status: string;
  isActive: boolean;
  createdAt: Date | string;
  deletedAt: Date | string | null;
}

interface Props {
  initialSchools: SchoolItem[];
}

export function SchoolManagementClient({ initialSchools }: Props) {
  const [schoolsList, setSchoolsList] = useState<SchoolItem[]>(initialSchools);
  const [searchQuery, setSearchQuery] = useState("");
  const [boardFilter, setBoardFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<SchoolItem | null>(null);
  const [deletingSchool, setDeletingSchool] = useState<SchoolItem | null>(null);

  // Transitions
  const [isPending, startTransition] = useTransition();

  // Filtered schools
  const filteredSchools = schoolsList.filter((s) => {
    // Hide archived unless statusFilter is ARCHIVED or ALL
    if (s.status === "ARCHIVED" && statusFilter !== "ARCHIVED" && statusFilter !== "ALL") {
      return false;
    }

    const matchesQuery =
      !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.udiseCode.includes(searchQuery) ||
      (s.slug && s.slug.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesBoard = boardFilter === "ALL" || s.board === boardFilter;
    const matchesStatus = statusFilter === "ALL" || s.status === statusFilter;

    return matchesQuery && matchesBoard && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-indigo-400" /> School Tenant Directory
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Governing {schoolsList.length} registered school instances across educational boards with real-time operations.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-lg shadow-indigo-600/25 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Provision New School</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by school, city, or UDISE..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto text-xs">
          {/* Board Selector */}
          <select
            value={boardFilter}
            onChange={(e) => setBoardFilter(e.target.value)}
            aria-label="Filter by Educational Board"
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-medium focus:outline-none focus:border-indigo-500/50"
          >
            <option value="ALL">All Boards</option>
            <option value="CBSE">CBSE</option>
            <option value="ICSE">ICSE</option>
            <option value="STATE_BOARD">State Board</option>
            <option value="IGCSE">IGCSE</option>
            <option value="IB">IB</option>
          </select>

          {/* Status Tabs */}
          <button
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              statusFilter === "ALL"
                ? "bg-indigo-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            All ({schoolsList.length})
          </button>
          <button
            onClick={() => setStatusFilter("ACTIVE")}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              statusFilter === "ACTIVE"
                ? "bg-emerald-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            Active ({schoolsList.filter((s) => s.status === "ACTIVE").length})
          </button>
          <button
            onClick={() => setStatusFilter("SUSPENDED")}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              statusFilter === "SUSPENDED"
                ? "bg-amber-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            Suspended ({schoolsList.filter((s) => s.status === "SUSPENDED").length})
          </button>
          <button
            onClick={() => setStatusFilter("ARCHIVED")}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              statusFilter === "ARCHIVED"
                ? "bg-rose-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            Archived ({schoolsList.filter((s) => s.status === "ARCHIVED").length})
          </button>
        </div>
      </div>

      {/* Schools Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">School Profile</th>
                <th className="py-3.5 px-4">Board & Type</th>
                <th className="py-3.5 px-4">Location & Contact</th>
                <th className="py-3.5 px-4">UDISE & Slug</th>
                <th className="py-3.5 px-4">Lifecycle Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
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
                  const isActive = s.status === "ACTIVE";
                  const isArchived = s.status === "ARCHIVED";

                  return (
                    <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Profile */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-sm">
                            {s.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm">{s.name}</div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                              <span>Principal: {s.principalName || "Not Assigned"}</span>
                              {s.establishedYear && (
                                <span className="text-slate-500">· Est. {s.establishedYear}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Board & Type */}
                      <td className="py-4 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                          {s.board}
                        </span>
                        <div className="text-[11px] text-slate-500 mt-1">
                          {s.schoolType || "Standard"}
                        </div>
                      </td>

                      {/* Location & Contact */}
                      <td className="py-4 px-4 text-slate-300">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          <span>{s.city}, {s.state}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                          <span>{s.phone}</span>
                          <span>·</span>
                          <span className="truncate max-w-[120px]">{s.email}</span>
                        </div>
                      </td>

                      {/* UDISE & Slug */}
                      <td className="py-4 px-4">
                        <div className="font-mono text-slate-300">{s.udiseCode}</div>
                        <div className="text-[11px] text-indigo-400 font-mono">
                          /{s.slug || s.id.slice(0, 8)}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        {isActive && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            ACTIVE
                          </span>
                        )}
                        {s.status === "SUSPENDED" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            <AlertCircle className="w-3 h-3" />
                            SUSPENDED
                          </span>
                        )}
                        {isArchived && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            <Trash2 className="w-3 h-3" />
                            ARCHIVED
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Impersonate */}
                          {!isArchived && (
                            <form action={startImpersonationAction}>
                              <input type="hidden" name="schoolId" value={s.id} />
                              <input type="hidden" name="schoolName" value={s.name} />
                              <button
                                type="submit"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-medium transition text-xs active:scale-95 shadow-sm"
                                title="Enter school with Superadmin Impersonation"
                              >
                                <Eye className="w-3.5 h-3.5 text-indigo-400" />
                                <span>Impersonate</span>
                              </button>
                            </form>
                          )}

                          {/* Edit Button */}
                          <button
                            onClick={() => setEditingSchool(s)}
                            className="p-1.5 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white hover:bg-slate-800/50 transition text-xs"
                            title="Edit School Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Status Toggle Button */}
                          {!isArchived && (
                            <button
                              onClick={() => {
                                startTransition(async () => {
                                  const fd = new FormData();
                                  fd.append("schoolId", s.id);
                                  fd.append("currentStatus", s.status);
                                  const res = await toggleSchoolStatusAction(fd);
                                  if (res?.success) {
                                    setSchoolsList((prev) =>
                                      prev.map((item) =>
                                        item.id === s.id ? { ...item, status: res.status! } : item
                                      )
                                    );
                                    toast.success(
                                      `School ${res.status === "ACTIVE" ? "activated" : "suspended"} successfully`
                                    );
                                  } else {
                                    toast.error(res?.error || "Failed to update status");
                                  }
                                });
                              }}
                              className={`p-1.5 rounded-lg border text-xs transition ${
                                isActive
                                  ? "border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                                  : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                              }`}
                              title={isActive ? "Suspend School Instance" : "Reactivate School Instance"}
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete Button */}
                          {!isArchived && (
                            <button
                              onClick={() => setDeletingSchool(s)}
                              className="p-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition text-xs"
                              title="Delete or Archive School"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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

      {/* CREATE MODAL */}
      {isCreateOpen && (
        <SchoolFormModal
          title="Provision New School Instance"
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSubmit={async (formData) => {
            const res = await createSchoolAction(formData);
            if (res.success && res.school) {
              setSchoolsList((prev) => [res.school as SchoolItem, ...prev]);
              toast.success(`School "${res.school.name}" created successfully!`);
              setIsCreateOpen(false);
            } else {
              toast.error(res.error || "Failed to create school");
            }
          }}
        />
      )}

      {/* EDIT MODAL */}
      {editingSchool && (
        <SchoolFormModal
          title={`Edit School: ${editingSchool.name}`}
          initialData={editingSchool}
          isOpen={!!editingSchool}
          onClose={() => setEditingSchool(null)}
          onSubmit={async (formData) => {
            const res = await updateSchoolAction(editingSchool.id, formData);
            if (res.success && res.school) {
              setSchoolsList((prev) =>
                prev.map((item) => (item.id === editingSchool.id ? (res.school as SchoolItem) : item))
              );
              toast.success(`School "${res.school.name}" updated successfully!`);
              setEditingSchool(null);
            } else {
              toast.error(res.error || "Failed to update school");
            }
          }}
        />
      )}

      {/* SECURE DELETE CONFIRMATION MODAL */}
      {deletingSchool && (
        <DeleteConfirmModal
          school={deletingSchool}
          isOpen={!!deletingSchool}
          onClose={() => setDeletingSchool(null)}
          onConfirm={async (confirmText) => {
            const res = await deleteSchoolAction(deletingSchool.id, confirmText);
            if (res.success) {
              setSchoolsList((prev) =>
                prev.map((item) =>
                  item.id === deletingSchool.id ? { ...item, status: "ARCHIVED" } : item
                )
              );
              toast.success(`School "${deletingSchool.name}" archived successfully!`);
              setDeletingSchool(null);
            } else {
              toast.error(res.error || "Failed to delete school");
            }
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE SCHOOL FORM MODAL (CREATE & UPDATE)
// ─────────────────────────────────────────────────────────────────────────────

interface SchoolModalProps {
  title: string;
  initialData?: SchoolItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SchoolFormInput) => Promise<void>;
}

function SchoolFormModal({ title, initialData, isOpen, onClose, onSubmit }: SchoolModalProps) {
  const isEditing = !!initialData;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<SchoolFormInput>({
    name: initialData?.name || "",
    board: initialData?.board || "CBSE",
    udiseCode: initialData?.udiseCode || "",
    address: initialData?.address || "",
    city: initialData?.city || "",
    state: initialData?.state || "",
    pincode: initialData?.pincode || "",
    phone: initialData?.phone || "",
    email: initialData?.email || "",
    principalName: initialData?.principalName || "",
    establishedYear: initialData?.establishedYear || new Date().getFullYear(),
    schoolType: (initialData?.schoolType as any) || "SECONDARY",
    website: initialData?.website || "",
    slug: initialData?.slug || "",
    academicYearLabel: "2026-2027",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) errs.name = "School name is required";
    if (!formData.udiseCode.trim() || !/^\d{8,11}$/.test(formData.udiseCode.trim())) {
      errs.udiseCode = "UDISE code must be 8-11 digits";
    }
    if (!formData.principalName.trim()) errs.principalName = "Principal name is required";
    if (!formData.email.trim() || !formData.email.includes("@")) errs.email = "Valid email is required";
    if (!formData.phone.trim()) errs.phone = "Phone number is required";
    if (!formData.city.trim()) errs.city = "City is required";
    if (!formData.state.trim()) errs.state = "State is required";
    if (!formData.pincode.trim() || !/^\d{6}$/.test(formData.pincode.trim())) {
      errs.pincode = "Valid 6-digit pincode is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <School className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 flex-1">
          {/* Section: Core Identity */}
          <div>
            <h3 className="text-xs uppercase font-semibold text-indigo-400 tracking-wider mb-3">
              1. Institutional Identity
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  School Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Delhi Public School"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                {errors.name && <p className="text-[11px] text-rose-400 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Educational Board <span className="text-rose-400">*</span>
                </label>
                <select
                  value={formData.board}
                  onChange={(e) => setFormData({ ...formData, board: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="CBSE">CBSE</option>
                  <option value="ICSE">ICSE</option>
                  <option value="STATE_BOARD">State Board</option>
                  <option value="IGCSE">IGCSE</option>
                  <option value="IB">IB</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  UDISE Code <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.udiseCode}
                  onChange={(e) => setFormData({ ...formData, udiseCode: e.target.value })}
                  placeholder="e.g. 09123456789"
                  maxLength={11}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
                {errors.udiseCode && <p className="text-[11px] text-rose-400 mt-1">{errors.udiseCode}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  School Level / Type
                </label>
                <select
                  value={formData.schoolType}
                  onChange={(e) => setFormData({ ...formData, schoolType: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="PRIMARY">Primary School (K-5)</option>
                  <option value="SECONDARY">Secondary School (K-10)</option>
                  <option value="SENIOR_SECONDARY">Senior Secondary (K-12)</option>
                  <option value="INTEGRATED">Integrated Academy</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Established Year
                </label>
                <input
                  type="number"
                  value={formData.establishedYear}
                  onChange={(e) => setFormData({ ...formData, establishedYear: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  URL Slug (Optional)
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="e.g. dps-noida"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Website URL
                </label>
                <input
                  type="url"
                  value={formData.website || ""}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Section: Contact & Leadership */}
          <div className="pt-2 border-t border-slate-800">
            <h3 className="text-xs uppercase font-semibold text-indigo-400 tracking-wider mb-3">
              2. Leadership & Contact
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Principal Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.principalName}
                  onChange={(e) => setFormData({ ...formData, principalName: e.target.value })}
                  placeholder="Dr. Rajesh Sharma"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                {errors.principalName && (
                  <p className="text-[11px] text-rose-400 mt-1">{errors.principalName}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Official Email <span className="text-rose-400">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="admin@school.edu.in"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                {errors.email && <p className="text-[11px] text-rose-400 mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Phone Number <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 9876543210"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                {errors.phone && <p className="text-[11px] text-rose-400 mt-1">{errors.phone}</p>}
              </div>
            </div>
          </div>

          {/* Section: Address & Location */}
          <div className="pt-2 border-t border-slate-800">
            <h3 className="text-xs uppercase font-semibold text-indigo-400 tracking-wider mb-3">
              3. Campus Location
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="sm:col-span-4">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Sector 62, Institutional Area"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  City <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Noida"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                {errors.city && <p className="text-[11px] text-rose-400 mt-1">{errors.city}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  State <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="Uttar Pradesh"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                {errors.state && <p className="text-[11px] text-rose-400 mt-1">{errors.state}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Pincode <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.pincode}
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                  placeholder="201301"
                  maxLength={6}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                {errors.pincode && <p className="text-[11px] text-rose-400 mt-1">{errors.pincode}</p>}
              </div>
            </div>
          </div>

          {/* Section: Academic Session (Only on creation) */}
          {!isEditing && (
            <div className="pt-2 border-t border-slate-800">
              <h3 className="text-xs uppercase font-semibold text-indigo-400 tracking-wider mb-3">
                4. Inaugural Academic Session
              </h3>
              <div className="w-full sm:w-1/2">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Initial Academic Year Label
                </label>
                <input
                  type="text"
                  value={formData.academicYearLabel}
                  onChange={(e) => setFormData({ ...formData, academicYearLabel: e.target.value })}
                  placeholder="2026-2027"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Creates the default active academic calendar session for this school tenant.
                </p>
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800/50 text-xs transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-lg shadow-indigo-600/25 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isEditing ? "Save Changes" : "Provision School"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECURE TWO-STEP DELETE / ARCHIVE MODAL
// ─────────────────────────────────────────────────────────────────────────────

interface DeleteModalProps {
  school: SchoolItem;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (confirmText: string) => Promise<void>;
}

function DeleteConfirmModal({ school, isOpen, onClose, onConfirm }: DeleteModalProps) {
  const [confirmInput, setConfirmInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const isMatch =
    confirmInput.trim().toLowerCase() === school.name.trim().toLowerCase() ||
    confirmInput.trim().toUpperCase() === "CONFIRM DELETE";

  const handleConfirm = async () => {
    if (!isMatch) return;
    setIsDeleting(true);
    try {
      await onConfirm(confirmInput);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-rose-500/30 rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 text-rose-400">
          <div className="w-10 h-10 rounded-full bg-rose-500/15 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Archive School Tenant</h3>
            <p className="text-xs text-rose-400">Destructive operation with audit preservation</p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/20 text-xs text-slate-300 space-y-2">
          <p>
            You are about to archive <strong className="text-white">"{school.name}"</strong> (UDISE:{" "}
            <span className="font-mono text-rose-300">{school.udiseCode}</span>).
          </p>
          <p className="text-[11px] text-slate-400">
            In compliance with DPDP data governance rules, this tenant will be marked as{" "}
            <span className="text-rose-400 font-semibold">ARCHIVED</span>, preventing all user logins and operations while retaining financial records and audit logs.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Type <strong className="text-white font-mono">{school.name}</strong> or{" "}
            <strong className="text-rose-400 font-mono">CONFIRM DELETE</strong> to proceed:
          </label>
          <input
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={school.name}
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500/50"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800/50 text-xs transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isMatch || isDeleting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow-lg shadow-rose-600/25 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Archive School</span>
          </button>
        </div>
      </div>
    </div>
  );
}
