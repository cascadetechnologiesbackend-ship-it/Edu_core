"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import {
  Users,
  Search,
  Filter,
  PlusCircle,
  GraduationCap,
  Briefcase,
  Eye,
  Lock,
  Edit,
  UserX,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  KeyRound,
  ShieldCheck,
  Building2,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { AppModal } from "@/components/ui/AppModal";
import { Combobox, type ComboboxOption } from "@/components/forms/Combobox";
import { AddressAutofill, type AddressValue, formatAddressForStorage } from "@/components/forms/AddressAutofill";
import { getAvatarColor, getInitials } from "@/lib/utils";
import {
  createStaff,
  updateStaff,
  confirmStaffProbation,
  offboardStaff,
  revealStaffPii,
  createDepartment,
  createDesignation,
} from "../actions";

interface StaffTabProps {
  staffList: any[];
  departments: any[];
  designations: any[];
  isAuthorizedHR: boolean;
  school: any;
  onRefresh?: () => void;
}

export function StaffTab({
  staffList,
  departments,
  designations,
  isAuthorizedHR,
  school,
  onRefresh,
}: StaffTabProps) {
  const router = useRouter();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [desigFilter, setDesigFilter] = useState("ALL");
  const [trackFilter, setTrackFilter] = useState<"ALL" | "TEACHING" | "NON_TEACHING">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "PROBATION" | "SEPARATED" | "LEGAL_HOLD">("ALL");

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editStaffTarget, setEditStaffTarget] = useState<any>(null);
  const [offboardTarget, setOffboardTarget] = useState<any>(null);
  const [manualCredentials, setManualCredentials] = useState<{
    email: string;
    tempPassword: string;
    dashboardUrl: string;
    roleDisplayName: string;
  } | null>(null);

  // PII reveal state
  const [revealedPii, setRevealedPii] = useState<Record<string, { pan?: string; bank?: string }>>({});
  const [loading, setLoading] = useState(false);
  const [createAttempted, setCreateAttempted] = useState(false);
  const [offboardWarning, setOffboardWarning] = useState<any>(null);

  // Staff creation form state
  const [selectedTrack, setSelectedTrack] = useState<"TEACHING" | "NON_TEACHING">("TEACHING");
  const [staffForm, setStaffForm] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "1990-01-01",
    gender: "MALE",
    mobile: "",
    email: "",
    emergencyContact: "",
    employeeCode: "",
    departmentId: "",
    designationId: "",
    contractType: "PROBATION" as const,
    joiningDate: new Date().toISOString().slice(0, 10),
    aadhaarLast4: "",
    pan: "",
    bankName: "",
    bankAccount: "",
    bankIfsc: "",
    qualification: "",
    experience: "",
  });

  const [addressForm, setAddressForm] = useState<AddressValue>({
    pincode: "",
    state: school?.state || "",
    district: "",
    city: school?.city || "",
    line1: "",
    line2: "",
  });

  // Edit staff form state
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    mobile: "",
    email: "",
    address: "",
    emergencyContact: "",
    departmentId: "",
    designationId: "",
    contractType: "PERMANENT" as any,
    joiningDate: "",
    qualification: "",
    experience: "",
  });

  // Offboard form state
  const [offboardData, setOffboardData] = useState({
    separationType: "RESIGNATION" as "RESIGNATION" | "TERMINATION" | "RETIREMENT" | "OTHER",
    relievingDate: new Date().toISOString().slice(0, 10),
    separationReason: "",
    forceReassign: false,
  });

  const handleTrackChange = (track: "TEACHING" | "NON_TEACHING") => {
    if (track === selectedTrack) return;
    setSelectedTrack(track);
    setStaffForm((prev) => ({
      ...prev,
      departmentId: "",
      designationId: "",
    }));
  };

  // Track-filtered departments & designations for onboarding form
  const trackDepartments = useMemo(() => {
    const isTeaching = selectedTrack === "TEACHING";

    const filtered = departments.filter((dept) => {
      // 1. Designation-based matching: if any designation linked to this department matches track
      const deptDesignations = designations.filter((des) => des.departmentId === dept.id);
      if (deptDesignations.length > 0) {
        if (isTeaching) {
          return deptDesignations.some((des) => Boolean(des.isTeaching));
        } else {
          return deptDesignations.some((des) => !des.isTeaching);
        }
      }

      // 2. Keyword fallback for newly created departments without designations yet
      const name = (dept.name || "").toLowerCase();
      const isOperationalOrAdmin = /finance|account|human resource|\bhr\b|transport|fleet|facilit|campus|maintenance|security|\bit\b|technology|bursar/i.test(name);
      const isPureClassroomAcademic = /^(pre-primary|primary|middle school|high school|senior secondary)\s+academic\s+department$/i.test(name.trim());

      if (isTeaching) {
        if (isOperationalOrAdmin) return false;
        return /academic|teach|faculty|curriculum|primary|middle|high|secondary|kg|kindergarten|science|math|language|english|hindi|social|arts/i.test(name);
      } else {
        if (isPureClassroomAcademic) return false;
        return true;
      }
    });

    return filtered.map((d) => ({
      value: d.id,
      label: d.name,
    }));
  }, [departments, designations, selectedTrack]);

  const trackDesignations = useMemo(() => {
    const isTeachingTarget = selectedTrack === "TEACHING";
    let list = designations.filter((d) => Boolean(d.isTeaching) === isTeachingTarget);
    if (staffForm.departmentId) {
      const filteredByDept = list.filter((d) => d.departmentId === staffForm.departmentId);
      if (filteredByDept.length > 0) list = filteredByDept;
    }
    return list.map((d) => ({
      value: d.id,
      label: d.name,
      group: d.department?.name || (d.isTeaching ? "Teaching" : "Non-Teaching"),
      badge: d.mappedRole || (d.isTeaching ? "TEACHER" : "STAFF"),
    }));
  }, [designations, selectedTrack, staffForm.departmentId]);

  // Filter options for Staff list
  const deptFilterOptions: ComboboxOption[] = useMemo(() => {
    return [
      { value: "ALL", label: "All Departments" },
      ...departments.map((d) => ({ value: d.id, label: d.name })),
    ];
  }, [departments]);

  const desigFilterOptions: ComboboxOption[] = useMemo(() => {
    return [
      { value: "ALL", label: "All Designations" },
      ...designations.map((d) => ({
        value: d.id,
        label: d.name,
        badge: d.isTeaching ? "Teaching" : "Non-Teaching",
      })),
    ];
  }, [designations]);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fName = (s.firstName || "").toLowerCase();
        const lName = (s.lastName || "").toLowerCase();
        const code = (s.employeeCode || "").toLowerCase();
        const email = (s.email || "").toLowerCase();
        const desName = (s.designation?.name || "").toLowerCase();
        const deptName = (s.department?.name || "").toLowerCase();
        const match =
          fName.includes(q) ||
          lName.includes(q) ||
          code.includes(q) ||
          email.includes(q) ||
          desName.includes(q) ||
          deptName.includes(q);
        if (!match) return false;
      }

      // Department
      if (deptFilter !== "ALL" && s.departmentId !== deptFilter) return false;

      // Designation
      if (desigFilter !== "ALL" && s.designationId !== desigFilter) return false;

      // Faculty Track
      if (trackFilter === "TEACHING" && !s.designation?.isTeaching) return false;
      if (trackFilter === "NON_TEACHING" && s.designation?.isTeaching) return false;

      // Status
      if (statusFilter === "ACTIVE" && !s.isActive) return false;
      if (statusFilter === "PROBATION" && (s.contractType !== "PROBATION" || !s.isActive)) return false;
      if (statusFilter === "SEPARATED" && s.isActive) return false;
      if (statusFilter === "LEGAL_HOLD" && !s.legalHold) return false;

      return true;
    });
  }, [staffList, searchQuery, deptFilter, desigFilter, trackFilter, statusFilter]);

  // Handlers
  const handleReveal = async (staffId: string, field: "pan" | "bank") => {
    const res = await revealStaffPii(staffId, field);
    if (res.success && res.decrypted) {
      setRevealedPii((prev) => ({
        ...prev,
        [staffId]: {
          ...prev[staffId],
          [field]: res.decrypted,
        },
      }));
    } else {
      toast.error(res.message || "Failed to reveal PII information");
    }
  };

  const handleCreateStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateAttempted(true);
    if (!staffForm.departmentId || !staffForm.designationId) {
      toast.error("Please select a department and designation.");
      return;
    }

    setLoading(true);
    try {
      const combinedAddress = formatAddressForStorage(addressForm);
      const res = await createStaff({
        ...staffForm,
        address: combinedAddress,
        state: addressForm.state || undefined,
        district: addressForm.district || undefined,
        pincode: addressForm.pincode || undefined,
      });
      setLoading(false);

      if (res.success) {
        const assignedRole = (res as any).assignedRole || "STAFF";
        const creds = (res as any).credentials;
        if ((res as any).warning && creds) {
          setManualCredentials(creds);
          toast.warning(
            `Staff onboarded with role ${assignedRole}! SMS not delivered — please share credentials manually.`,
            { duration: 6000 }
          );
        } else {
          toast.success(
            `Staff onboarded successfully! Assigned role: ${assignedRole}`,
            { duration: 5000 }
          );
        }
        setIsCreateOpen(false);
        setCreateAttempted(false);
        router.refresh();
        onRefresh?.();
      } else {
        toast.error(res.message || "Failed to create staff profile");
      }
    } catch (err: any) {
      setLoading(false);
      toast.error(err?.message || "Failed to create staff profile");
    }
  };

  const handleEditStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStaffTarget) return;
    setLoading(true);
    const res = await updateStaff(editStaffTarget.id, editForm);
    setLoading(false);
    if (res.success) {
      toast.success("Staff profile updated successfully!");
      setEditStaffTarget(null);
      router.refresh();
      onRefresh?.();
    } else {
      toast.error(res.message || "Failed to update staff profile");
    }
  };

  const handleConfirmProbation = async (staffId: string, name: string) => {
    if (!confirm(`Confirm probation for ${name}? This will mark their contract as permanent.`)) return;
    setLoading(true);
    const res = await confirmStaffProbation(staffId);
    setLoading(false);
    if (res.success) {
      toast.success("Staff probation confirmed successfully!");
      router.refresh();
      onRefresh?.();
    } else {
      toast.error(res.message || "Failed to confirm probation");
    }
  };

  const handleOffboardStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offboardTarget) return;
    setLoading(true);
    const res = await offboardStaff(offboardTarget.id, offboardData);
    setLoading(false);
    if (!res.success) {
      if (res.requiresReassignment) {
        setOffboardWarning(res);
      } else {
        toast.error(res.message || "Offboarding failed");
      }
    } else {
      toast.success("Staff member offboarded successfully.");
      setOffboardTarget(null);
      setOffboardWarning(null);
      router.refresh();
      onRefresh?.();
    }
  };

  // Inline department creation from Combobox
  const handleInlineCreateDept = async (name: string) => {
    const res = await createDepartment(name);
    if (res.success && res.department) {
      toast.success(`Department "${name}" created!`);
      router.refresh();
      setStaffForm((prev) => ({ ...prev, departmentId: res.department.id }));
    } else {
      toast.error(res.message || "Failed to create department");
    }
  };

  // Inline designation creation from Combobox
  const handleInlineCreateDesig = async (name: string) => {
    if (!staffForm.departmentId) {
      toast.error("Please pick a department before adding a designation.");
      return;
    }
    const res = await createDesignation({
      name,
      departmentId: staffForm.departmentId,
      isTeaching: selectedTrack === "TEACHING",
      mappedRole: selectedTrack === "TEACHING" ? "TEACHER" : "STAFF",
    });
    if (res.success && res.designation) {
      toast.success(`Designation "${name}" created!`);
      router.refresh();
      setStaffForm((prev) => ({ ...prev, designationId: res.designation.id }));
    } else {
      toast.error(res.message || "Failed to create designation");
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Staff</span>
          <p className="text-3xl font-extrabold mt-1 text-gray-900 dark:text-white tabular-nums">{staffList.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Active Staff</span>
          <p className="text-3xl font-extrabold mt-1 text-emerald-600 dark:text-emerald-400 tabular-nums">
            {staffList.filter((s) => s.isActive).length}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Teaching Faculty</span>
          <p className="text-3xl font-extrabold mt-1 text-primary tabular-nums">
            {staffList.filter((s) => s.designation?.isTeaching && s.isActive).length}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">On Probation</span>
          <p className="text-3xl font-extrabold mt-1 text-amber-600 dark:text-amber-400 tabular-nums">
            {staffList.filter((s) => s.contractType === "PROBATION" && s.isActive).length}
          </p>
        </div>
      </div>

      {/* Action Strip: Pinned Search & Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Pinned search input (Law L1: width 320px) */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search staff by name, code, or role..."
              className="w-full h-10 pl-9 pr-3 text-xs md:text-sm rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-hidden transition-all shadow-xs"
            />
          </div>

          {/* Track Chip Selector */}
          <div className="inline-flex p-1 bg-gray-100 dark:bg-slate-800 rounded-xl">
            {(["ALL", "TEACHING", "NON_TEACHING"] as const).map((track) => (
              <button
                key={track}
                type="button"
                onClick={() => setTrackFilter(track)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  trackFilter === track
                    ? "bg-white dark:bg-slate-900 text-primary shadow-xs"
                    : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                }`}
              >
                {track === "ALL" ? "All Faculty" : track === "TEACHING" ? "Teaching" : "Non-Teaching"}
              </button>
            ))}
          </div>

          {/* Department Combobox Filter */}
          <div className="w-44">
            <Combobox
              options={deptFilterOptions}
              value={deptFilter}
              onChange={setDeptFilter}
              placeholder="Department..."
              clearable={false}
            />
          </div>

          {/* Designation Combobox Filter */}
          <div className="w-48">
            <Combobox
              options={desigFilterOptions}
              value={desigFilter}
              onChange={setDesigFilter}
              placeholder="Designation..."
              clearable={false}
            />
          </div>
        </div>

        {/* Primary CTA */}
        {isAuthorizedHR && (
          <button
            type="button"
            onClick={() => {
              setStaffForm({
                firstName: "",
                lastName: "",
                dateOfBirth: "1990-01-01",
                gender: "MALE",
                mobile: "",
                email: "",
                emergencyContact: "",
                employeeCode: "",
                departmentId: "",
                designationId: "",
                contractType: "PROBATION",
                joiningDate: new Date().toISOString().slice(0, 10),
                aadhaarLast4: "",
                pan: "",
                bankName: "",
                bankAccount: "",
                bankIfsc: "",
                qualification: "",
                experience: "",
              });
              setAddressForm({
                pincode: "",
                state: school?.state || "",
                district: "",
                city: school?.city || "",
                line1: "",
                line2: "",
              });
              setCreateAttempted(false);
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shrink-0 self-start md:self-auto"
          >
            <PlusCircle className="w-4 h-4" />
            Onboard Staff
          </button>
        )}
      </div>

      {/* Staff Table / Workbench (Law L12: People render as people) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/40 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Department & Track</th>
                <th className="py-3 px-4">Designation</th>
                <th className="py-3 px-4">Status & Contract</th>
                <th className="py-3 px-4">Statutory PII</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {filteredStaff.map((s) => {
                const fullName = `${s.firstName || ""} ${s.lastName || ""}`.trim() || "Staff Member";
                const isTeaching = Boolean(s.designation?.isTeaching);
                const avatarBg = getAvatarColor(fullName);
                const initials = getInitials(fullName);

                return (
                  <tr
                    key={s.id}
                    className="hover:bg-gray-50/60 dark:hover:bg-slate-800/30 transition-colors group"
                  >
                    {/* Staff Person */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <AvatarPrimitive.Root className="relative flex h-9 w-9 shrink-0 overflow-hidden rounded-xl shadow-xs">
                          <AvatarPrimitive.Fallback className={`flex h-full w-full items-center justify-center font-bold text-xs ${avatarBg}`}>
                            {initials}
                          </AvatarPrimitive.Fallback>
                        </AvatarPrimitive.Root>
                        <div className="min-w-0">
                          <div className="font-bold text-gray-900 dark:text-white truncate">
                            {fullName}
                          </div>
                          <div className="text-[11px] text-gray-400 dark:text-gray-500 font-mono">
                            {s.employeeCode} {s.email ? `• ${s.email}` : ""}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Department & Track */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          {s.department?.name || "General"}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            isTeaching
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50"
                              : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300 border border-gray-200 dark:border-slate-700"
                          }`}
                        >
                          {isTeaching ? "Teaching" : "Non-Teaching"}
                        </span>
                      </div>
                    </td>

                    {/* Designation */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-700 dark:text-gray-300">
                        {s.designation?.name || "Staff"}
                      </div>
                      {s.designation?.mappedRole && (
                        <span className="text-[10px] text-gray-400">
                          Role: {s.designation.mappedRole}
                        </span>
                      )}
                    </td>

                    {/* Status & Contract */}
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            s.isActive
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                          }`}
                        >
                          {s.isActive ? "Active" : "Separated"}
                        </span>
                        <div className="text-[11px] text-gray-400">
                          {s.contractType === "PROBATION" ? (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">Probation</span>
                          ) : (
                            s.contractType
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Statutory PII Reveal */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* PAN */}
                        {revealedPii[s.id]?.pan ? (
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 font-bold text-gray-800 dark:text-gray-200">
                            PAN: {revealedPii[s.id]!.pan}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleReveal(s.id, "pan")}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition-colors"
                            title="Reveal encrypted PAN"
                          >
                            <Lock className="w-3 h-3 text-gray-400" /> PAN
                          </button>
                        )}

                        {/* Bank */}
                        {revealedPii[s.id]?.bank ? (
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 font-bold text-gray-800 dark:text-gray-200">
                            A/C: {revealedPii[s.id]!.bank}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleReveal(s.id, "bank")}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition-colors"
                            title="Reveal encrypted Bank Account"
                          >
                            <Lock className="w-3 h-3 text-gray-400" /> Bank
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/hr/staff/${s.id}`}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                          title="View Staff 360"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>

                        {isAuthorizedHR && s.isActive && (
                          <>
                            {s.contractType === "PROBATION" && (
                              <button
                                type="button"
                                onClick={() => handleConfirmProbation(s.id, fullName)}
                                className="p-1.5 rounded-lg text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                                title="Confirm probation to permanent"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditStaffTarget(s);
                                setEditForm({
                                  firstName: s.firstName || "",
                                  lastName: s.lastName || "",
                                  mobile: s.mobile || "",
                                  email: s.email || "",
                                  address: "",
                                  emergencyContact: "",
                                  departmentId: s.departmentId || "",
                                  designationId: s.designationId || "",
                                  contractType: s.contractType || "PERMANENT",
                                  joiningDate: s.joiningDate
                                    ? new Date(s.joiningDate).toISOString().slice(0, 10)
                                    : "",
                                  qualification: s.qualification || "",
                                  experience: s.experience || "",
                                });
                              }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                              title="Edit profile"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOffboardTarget(s);
                                setOffboardData({
                                  separationType: "RESIGNATION",
                                  relievingDate: new Date().toISOString().slice(0, 10),
                                  separationReason: "",
                                  forceReassign: false,
                                });
                              }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                              title="Offboard staff member"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredStaff.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400 dark:text-gray-500">
                    <Users className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                    <p className="font-semibold text-sm">No staff members match the filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── ONBOARD STAFF MODAL (AppModal size="4xl") ───────────────────────── */}
      <AppModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        size="4xl"
        title={
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-base sm:text-lg">Onboard Staff Member</span>
              <p className="text-xs font-normal text-gray-500 dark:text-gray-400 mt-0.5">
                Categorized faculty track onboarding with online postal PIN code address verification.
              </p>
            </div>
          </div>
        }
      >
        <form onSubmit={handleCreateStaffSubmit} className="space-y-5 text-xs pt-1">
          {/* Track Selection Cards (Law L11 & Surface 8) */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
              Select Staff Faculty Track
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <button
                type="button"
                onClick={() => handleTrackChange("TEACHING")}
                className={`p-3.5 rounded-2xl border text-left flex items-start gap-3.5 transition-all ${
                  selectedTrack === "TEACHING"
                    ? "border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20 shadow-xs"
                    : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                }`}
              >
                <div className={`p-2.5 rounded-xl shrink-0 ${selectedTrack === "TEACHING" ? "bg-primary text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-500"}`}>
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-gray-900 dark:text-white">Teaching Faculty</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    Subject teachers, class teachers, coordinators, and academic HODs
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleTrackChange("NON_TEACHING")}
                className={`p-3.5 rounded-2xl border text-left flex items-start gap-3.5 transition-all ${
                  selectedTrack === "NON_TEACHING"
                    ? "border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20 shadow-xs"
                    : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                }`}
              >
                <div className={`p-2.5 rounded-xl shrink-0 ${selectedTrack === "NON_TEACHING" ? "bg-primary text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-500"}`}>
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-gray-900 dark:text-white">Administrative & Support</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    Finance, HR, IT, library, transport, security, and campus maintenance
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Department & Designation Comboboxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Department <span className="text-rose-500">*</span>
              </label>
              <Combobox
                options={trackDepartments}
                value={staffForm.departmentId}
                onChange={(deptId) => setStaffForm({ ...staffForm, departmentId: deptId, designationId: "" })}
                placeholder={selectedTrack === "TEACHING" ? "Choose Academic Department..." : "Choose Administrative Department..."}
                searchPlaceholder="Search departments..."
                allowCreate={true}
                createLabel="Create new Department"
                onCreateNew={handleInlineCreateDept}
                clearable={false}
              />
              {createAttempted && !staffForm.departmentId && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1">Please select a department</p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Designation <span className="text-rose-500">*</span>
              </label>
              <Combobox
                options={trackDesignations}
                value={staffForm.designationId}
                onChange={(desigId) => setStaffForm({ ...staffForm, designationId: desigId })}
                placeholder={selectedTrack === "TEACHING" ? "Choose Academic Designation..." : "Choose Administrative Designation..."}
                searchPlaceholder="Search designations..."
                allowCreate={true}
                createLabel="Create new Designation"
                onCreateNew={handleInlineCreateDesig}
                clearable={false}
              />
              {createAttempted && !staffForm.designationId && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1">Please select a designation</p>
              )}
            </div>
          </div>

          {/* Personal Information (3 Columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                First Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={staffForm.firstName}
                onChange={(e) => setStaffForm({ ...staffForm, firstName: e.target.value })}
                placeholder="e.g. Priya"
                className="w-full h-10 px-3 text-xs md:text-sm rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                Last Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={staffForm.lastName}
                onChange={(e) => setStaffForm({ ...staffForm, lastName: e.target.value })}
                placeholder="e.g. Sharma"
                className="w-full h-10 px-3 text-xs md:text-sm rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                Employee Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={staffForm.employeeCode}
                onChange={(e) => setStaffForm({ ...staffForm, employeeCode: e.target.value })}
                placeholder="e.g. EMP-101"
                className="w-full h-10 px-3 text-xs md:text-sm font-mono rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={staffForm.email}
                onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                placeholder="priya.sharma@school.edu"
                className="w-full h-10 px-3 text-xs md:text-sm rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                Mobile Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={staffForm.mobile}
                onChange={(e) => setStaffForm({ ...staffForm, mobile: e.target.value })}
                placeholder="9876543210"
                className="w-full h-10 px-3 text-xs md:text-sm rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                Joining Date
              </label>
              <input
                type="date"
                value={staffForm.joiningDate}
                onChange={(e) => setStaffForm({ ...staffForm, joiningDate: e.target.value })}
                className="w-full h-10 px-3 text-xs md:text-sm rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>
          </div>

          {/* Address Block via AddressAutofill (Surface 9) */}
          <div className="p-4 rounded-2xl bg-gray-50/70 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Residential Address & Geographical Location
              </h4>
              <span className="text-[11px] text-gray-400 hidden sm:inline">
                Instant online postal address resolution from India Post
              </span>
            </div>
            <AddressAutofill
              value={addressForm}
              onChange={setAddressForm}
              required={false}
            />
          </div>

          {/* Statutory PII (Aadhaar last 4, PAN, Bank) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                Aadhaar Last 4 (Optional)
              </label>
              <input
                type="text"
                maxLength={4}
                value={staffForm.aadhaarLast4}
                onChange={(e) => setStaffForm({ ...staffForm, aadhaarLast4: e.target.value.replace(/\D/g, "") })}
                placeholder="1234"
                className="w-full h-10 px-3 text-xs md:text-sm font-mono rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                PAN Number
              </label>
              <input
                type="text"
                maxLength={10}
                value={staffForm.pan}
                onChange={(e) => setStaffForm({ ...staffForm, pan: e.target.value.toUpperCase() })}
                placeholder="ABCDE1234F"
                className="w-full h-10 px-3 text-xs md:text-sm font-mono rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                Bank Name
              </label>
              <input
                type="text"
                value={staffForm.bankName}
                onChange={(e) => setStaffForm({ ...staffForm, bankName: e.target.value })}
                placeholder="State Bank of India"
                className="w-full h-10 px-3 text-xs md:text-sm rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                Account Number
              </label>
              <input
                type="text"
                value={staffForm.bankAccount}
                onChange={(e) => setStaffForm({ ...staffForm, bankAccount: e.target.value })}
                placeholder="Account number"
                className="w-full h-10 px-3 text-xs md:text-sm font-mono rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 text-xs font-bold hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-all shadow-md"
            >
              {loading ? "Onboarding..." : "Confirm & Onboard Staff"}
            </button>
          </div>
        </form>
      </AppModal>

      {/* ─── EDIT STAFF MODAL (AppModal size="lg") ─────────────────────────── */}
      <AppModal
        open={!!editStaffTarget}
        onClose={() => setEditStaffTarget(null)}
        size="lg"
        title="Edit Staff Member"
        description="Update profile details, contact information, and role designation."
      >
        <form onSubmit={handleEditStaffSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">First Name</label>
              <input
                type="text"
                required
                value={editForm.firstName}
                onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">Last Name</label>
              <input
                type="text"
                required
                value={editForm.lastName}
                onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">Mobile</label>
              <input
                type="tel"
                value={editForm.mobile}
                onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">Qualification</label>
              <input
                type="text"
                value={editForm.qualification}
                onChange={(e) => setEditForm({ ...editForm, qualification: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setEditStaffTarget(null)}
              className="px-4 py-2 rounded-xl border text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-bold"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </AppModal>

      {/* ─── OFFBOARD STAFF MODAL (AppModal size="md") ──────────────────────── */}
      <AppModal
        open={!!offboardTarget}
        onClose={() => {
          setOffboardTarget(null);
          setOffboardWarning(null);
        }}
        size="md"
        title="Offboard Staff Member"
        description="Formal separation and reassignment of active teaching and administrative responsibilities."
      >
        <form onSubmit={handleOffboardStaffSubmit} className="space-y-4 text-xs">
          {offboardWarning && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="font-bold">Active responsibilities found:</p>
                <p className="mt-0.5">{offboardWarning.message}</p>
                <label className="flex items-center gap-2 mt-2 font-semibold">
                  <input
                    type="checkbox"
                    checked={offboardData.forceReassign}
                    onChange={(e) => setOffboardData({ ...offboardData, forceReassign: e.target.checked })}
                    className="rounded"
                  />
                  <span>Reassign responsibilities and proceed with offboarding</span>
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">Separation Type</label>
            <select
              value={offboardData.separationType}
              onChange={(e) => setOffboardData({ ...offboardData, separationType: e.target.value as any })}
              className="w-full h-10 px-3 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <option value="RESIGNATION">Resignation</option>
              <option value="TERMINATION">Termination</option>
              <option value="RETIREMENT">Retirement</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">Relieving Date</label>
            <input
              type="date"
              value={offboardData.relievingDate}
              onChange={(e) => setOffboardData({ ...offboardData, relievingDate: e.target.value })}
              className="w-full h-10 px-3 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">Reason / Remarks</label>
            <textarea
              rows={3}
              value={offboardData.separationReason}
              onChange={(e) => setOffboardData({ ...offboardData, separationReason: e.target.value })}
              placeholder="Provide reason for separation..."
              className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setOffboardTarget(null);
                setOffboardWarning(null);
              }}
              className="px-4 py-2 rounded-xl border text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700"
            >
              {loading ? "Processing..." : "Confirm Offboarding"}
            </button>
          </div>
        </form>
      </AppModal>

      {/* Manual credentials fallback modal */}
      {manualCredentials && (
        <AppModal
          open={!!manualCredentials}
          onClose={() => setManualCredentials(null)}
          size="sm"
          title="Manual Credentials Share"
          description="SMS was not configured or could not be delivered. Share these credentials securely with the staff member."
        >
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-1 font-mono">
              <div><span className="text-gray-400">Email:</span> {manualCredentials.email}</div>
              <div><span className="text-gray-400">Password:</span> <span className="font-bold text-primary">{manualCredentials.tempPassword}</span></div>
              <div><span className="text-gray-400">Portal:</span> {manualCredentials.dashboardUrl}</div>
              <div><span className="text-gray-400">Role:</span> {manualCredentials.roleDisplayName}</div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `SchoolMitra ERP Credentials:\nEmail: ${manualCredentials.email}\nTemporary Password: ${manualCredentials.tempPassword}\nPortal: ${window.location.origin}${manualCredentials.dashboardUrl}`
                  );
                  toast.success("Credentials copied to clipboard!");
                  setManualCredentials(null);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy & Close
              </button>
            </div>
          </div>
        </AppModal>
      )}
    </div>
  );
}
