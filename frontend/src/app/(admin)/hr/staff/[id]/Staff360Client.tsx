"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  updateStaff,
  confirmStaffProbation,
  offboardStaff,
  reactivateStaff,
  toggleStaffLegalHold,
  revealStaffPii,
} from "../../actions";

interface Staff360Props {
  profile: any;
  departments: Array<{ id: string; name: string }>;
  designations: Array<{ id: string; name: string; isTeaching: boolean }>;
  userRole: string;
  schoolName: string;
}

export function Staff360Client({
  profile,
  departments,
  designations,
  userRole,
  schoolName,
}: Staff360Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "overview" | "employment" | "academics" | "compensation" | "leaves"
  >("overview");

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    firstName: profile.firstName || "",
    lastName: profile.lastName || "",
    mobile: profile.mobile || "",
    email: profile.email || "",
    address: profile.address || "",
    emergencyContact: profile.emergencyContact || "",
    departmentId: profile.departmentId || "",
    designationId: profile.designationId || "",
    contractType: profile.contractType || "PERMANENT",
    joiningDate: profile.joiningDate
      ? new Date(profile.joiningDate).toISOString().split("T")[0]
      : "",
    qualification: profile.qualification || "",
    experience: profile.experience || "",
    bankName: "",
    bankAccount: "",
    bankIfsc: "",
    pan: "",
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Offboard Modal State
  const [showOffboardModal, setShowOffboardModal] = useState(false);
  const [offboardData, setOffboardData] = useState({
    separationType: "RESIGNATION" as
      | "RESIGNATION"
      | "TERMINATION"
      | "RETIREMENT"
      | "OTHER",
    relievingDate: new Date().toISOString().split("T")[0],
    separationReason: "",
    forceReassign: false,
  });
  const [offboardWarning, setOffboardWarning] = useState<any>(null);
  const [offboardLoading, setOffboardLoading] = useState(false);
  const [offboardError, setOffboardError] = useState<string | null>(null);

  // Confirm Probation State
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);

  // Legal Hold State
  const [legalHoldLoading, setLegalHoldLoading] = useState(false);

  // PII Reveal State
  const [piiData, setPiiData] = useState<any>(null);
  const [revealingPii, setRevealingPii] = useState(false);
  const [piiError, setPiiError] = useState<string | null>(null);

  const canAdminister = [
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "HR_MANAGER",
    "PRINCIPAL",
  ].includes(userRole);
  const canMutate = ["SUPER_ADMIN", "SCHOOL_ADMIN", "HR_MANAGER"].includes(
    userRole,
  );

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError(null);
    try {
      const res = await updateStaff(profile.id, editFormData);
      if (!res.success) {
        setEditError(res.message || "Failed to update staff profile");
      } else {
        setShowEditModal(false);
        router.refresh();
      }
    } catch (err: any) {
      setEditError(err.message || "Error updating staff profile");
    } finally {
      setEditLoading(false);
    }
  };

  const handleConfirmProbation = async () => {
    if (!window.confirm("Confirm permanent employment for this staff member?"))
      return;
    setConfirmLoading(true);
    setConfirmMsg(null);
    try {
      const res = await confirmStaffProbation(profile.id);
      if (!res.success) {
        alert(res.message || "Failed to confirm probation");
      } else {
        setConfirmMsg("Probation confirmed successfully.");
        router.refresh();
      }
    } catch (err: any) {
      alert(err.message || "Error confirming probation");
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleOffboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOffboardLoading(true);
    setOffboardError(null);
    try {
      const res = await offboardStaff(profile.id, offboardData);
      if (!res.success) {
        if (res.requiresReassignment) {
          setOffboardWarning(res);
        } else {
          setOffboardError(res.message || "Offboarding failed");
        }
      } else {
        setShowOffboardModal(false);
        setOffboardWarning(null);
        router.refresh();
      }
    } catch (err: any) {
      setOffboardError(err.message || "Error during offboarding");
    } finally {
      setOffboardLoading(false);
    }
  };

  const handleToggleLegalHold = async () => {
    const nextState = !profile.legalHold;
    const confirmText = nextState
      ? "Apply LEGAL HOLD on this staff profile? This prevents separation or destructive actions."
      : "Remove LEGAL HOLD from this staff profile?";
    if (!window.confirm(confirmText)) return;

    setLegalHoldLoading(true);
    try {
      const res = await toggleStaffLegalHold(profile.id, nextState);
      if (!res.success) {
        alert(res.message || "Failed to update legal hold status");
      } else {
        router.refresh();
      }
    } catch (err: any) {
      alert(err.message || "Error toggling legal hold");
    } finally {
      setLegalHoldLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (
      !window.confirm(
        "Reactivate this staff member and restore login account access?",
      )
    )
      return;
    try {
      const res = await reactivateStaff(profile.id);
      if (!res.success) {
        alert(res.message || "Failed to reactivate staff");
      } else {
        router.refresh();
      }
    } catch (err: any) {
      alert(err.message || "Error reactivating staff");
    }
  };

  const handleRevealPii = async () => {
    setRevealingPii(true);
    setPiiError(null);
    try {
      const res = await revealStaffPii(profile.id, "HR_AUDIT_360_VIEW");
      if (!res.success) {
        setPiiError(res.message || "Unauthorized to view sensitive PII");
      } else {
        setPiiData(res.data);
      }
    } catch (err: any) {
      setPiiError(err.message || "Error revealing PII");
    } finally {
      setRevealingPii(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
            <Link
              href="/hr"
              className="hover:text-indigo-600 transition-colors flex items-center gap-1"
            >
              ← Staff Directory
            </Link>
            <span>/</span>
            <span>{schoolName}</span>
            <span>/</span>
            <span className="text-gray-900 dark:text-gray-100 font-semibold">
              {profile.employeeCode}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              {profile.fullName}
            </h1>

            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
              Code: {profile.employeeCode}
            </span>

            {profile.isTeaching ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                Teaching Faculty
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                Non-Teaching
              </span>
            )}

            {profile.legalHold && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 flex items-center gap-1">
                🔒 Legal Hold Active
              </span>
            )}

            {profile.isActive ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300">
                Active
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300">
                Separated ({profile.separationType || "Inactive"})
              </span>
            )}

            {profile.contractType === "PROBATION" && profile.isActive && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300">
                On Probation
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {canMutate && (
            <button
              onClick={() => setShowEditModal(true)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              Edit Profile
            </button>
          )}

          {canMutate && profile.contractType === "PROBATION" && profile.isActive && (
            <button
              onClick={handleConfirmProbation}
              disabled={confirmLoading}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition disabled:opacity-50"
            >
              {confirmLoading ? "Confirming..." : "Confirm Probation"}
            </button>
          )}

          {canAdminister && profile.isActive && (
            <button
              onClick={() => {
                setOffboardWarning(null);
                setShowOffboardModal(true);
              }}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition"
            >
              Offboard Staff
            </button>
          )}

          {canAdminister && !profile.isActive && (
            <button
              onClick={handleReactivate}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition"
            >
              Reactivate Staff
            </button>
          )}

          {["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(userRole) && (
            <button
              onClick={handleToggleLegalHold}
              disabled={legalHoldLoading}
              className={`px-4 py-2 text-sm font-medium rounded-lg border transition disabled:opacity-50 ${
                profile.legalHold
                  ? "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800 hover:bg-purple-100"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:bg-gray-50"
              }`}
            >
              {profile.legalHold ? "Remove Legal Hold" : "Apply Legal Hold"}
            </button>
          )}
        </div>
      </div>

      {confirmMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-300 text-sm">
          {confirmMsg}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 space-x-4">
        {[
          { key: "overview", label: "Overview & Identity" },
          { key: "employment", label: "Employment & Lifecycle" },
          { key: "academics", label: "Academic Allocations" },
          { key: "compensation", label: "Compensation & Loans" },
          { key: "leaves", label: "Leave Summary" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`pb-3 px-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}

      {/* 1. OVERVIEW & IDENTITY */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Personal Information
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 block text-xs">First Name</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {profile.firstName}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">Last Name</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {profile.lastName}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">Gender</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {profile.gender || "—"}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">Date of Birth</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {profile.dateOfBirth || "—"}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">Aadhaar Last 4</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {profile.aadhaarLast4 ? `•••• •••• ${profile.aadhaarLast4}` : "—"}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">Contract Type</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {profile.contractType}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
              <span className="text-gray-500 block text-xs mb-1">Residential Address</span>
              <p className="text-sm text-gray-800 dark:text-gray-200">
                {profile.address || "No address provided."}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Contact & Emergency
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 block text-xs">Official Email</span>
                <span className="font-medium text-gray-900 dark:text-gray-100 break-all">
                  {profile.email}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">Mobile Number</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {profile.mobile}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500 block text-xs">Emergency Contact</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {profile.emergencyContact || "—"}
                </span>
              </div>
            </div>

            {/* DPDP Sensitive Data Card */}
            <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Statutory & Financial PII (DPDP Protected)
                  </h3>
                  <p className="text-xs text-gray-500">
                    Encrypted with AES-256. Access is logged.
                  </p>
                </div>
                {!piiData && (
                  <button
                    onClick={handleRevealPii}
                    disabled={revealingPii}
                    className="px-3 py-1.5 text-xs font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded hover:bg-indigo-100 transition disabled:opacity-50"
                  >
                    {revealingPii ? "Decrypting..." : "Reveal PII"}
                  </button>
                )}
              </div>

              {piiError && (
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  {piiError}
                </p>
              )}

              {piiData && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg text-xs">
                  <div>
                    <span className="text-gray-500 block">PAN</span>
                    <span className="font-mono font-medium text-gray-900 dark:text-gray-100">
                      {piiData.pan || "Not Provided"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Bank Name</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {piiData.bankName || "Not Provided"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Account Number</span>
                    <span className="font-mono font-medium text-gray-900 dark:text-gray-100">
                      {piiData.bankAccount || "Not Provided"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">IFSC Code</span>
                    <span className="font-mono font-medium text-gray-900 dark:text-gray-100">
                      {piiData.bankIfsc || "Not Provided"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. EMPLOYMENT & LIFECYCLE */}
      {activeTab === "employment" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Organizational Role
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 block text-xs">Department</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {profile.departmentName}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">Designation</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {profile.designationName}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">Classification</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {profile.isTeaching ? "Teaching Faculty" : "Administrative / Non-Teaching"}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">Current State</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {profile.isActive ? "Active Duty" : "Separated"}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
              <span className="text-gray-500 block text-xs mb-1">Qualifications</span>
              <p className="text-sm text-gray-800 dark:text-gray-200">
                {profile.qualification || "None recorded."}
              </p>
            </div>
            <div>
              <span className="text-gray-500 block text-xs mb-1">Experience</span>
              <p className="text-sm text-gray-800 dark:text-gray-200">
                {profile.experience || "None recorded."}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Lifecycle Milestones
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 block text-xs">Joining Date</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {profile.joiningDate
                    ? new Date(profile.joiningDate).toLocaleDateString()
                    : "—"}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">Confirmation Date</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {profile.confirmationDate
                    ? new Date(profile.confirmationDate).toLocaleDateString()
                    : "Pending Probation"}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">Relieving Date</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {profile.relievingDate
                    ? new Date(profile.relievingDate).toLocaleDateString()
                    : "N/A (Active)"}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">Separation Type</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {profile.separationType || "N/A"}
                </span>
              </div>
            </div>

            {profile.separationReason && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg text-xs space-y-1">
                <span className="font-semibold text-rose-800 dark:text-rose-300">
                  Separation Remarks / Reason:
                </span>
                <p className="text-rose-700 dark:text-rose-400">
                  {profile.separationReason}
                </p>
              </div>
            )}

            <div className="pt-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500">
              Staff record created on{" "}
              {profile.createdAt
                ? new Date(profile.createdAt).toLocaleDateString()
                : "—"}
            </div>
          </div>
        </div>
      )}

      {/* 3. ACADEMIC ALLOCATIONS */}
      {activeTab === "academics" && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-6">
          {!profile.isTeaching ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">
                This staff member is classified as Non-Teaching faculty and has no academic allocations.
              </p>
            </div>
          ) : !profile.academicAllocations ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No academic allocations assigned yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <span className="text-xs text-gray-500">Class Teacher Sections</span>
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {profile.academicAllocations.classTeacherOf.length}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {profile.academicAllocations.classTeacherOf.join(", ") || "None"}
                  </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <span className="text-xs text-gray-500">Class Subjects</span>
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {profile.academicAllocations.classSubjects.length}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Primary subject faculty
                  </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <span className="text-xs text-gray-500">Weekly Timetable Periods</span>
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {profile.academicAllocations.weeklyPeriodsCount}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Active periods scheduled
                  </div>
                </div>
              </div>

              {/* Subject Allocations List */}
              {profile.academicAllocations.classSubjects.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Class Subjects Assigned
                  </h3>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                    {profile.academicAllocations.classSubjects.map((cs: any) => (
                      <div
                        key={cs.id}
                        className="p-3 flex items-center justify-between text-sm bg-white dark:bg-gray-900"
                      >
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {cs.className}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">
                          {cs.subjectName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. COMPENSATION & LOANS */}
      {activeTab === "compensation" && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Salary Structure &amp; Compensation
            </h2>
            {profile.salaryConfigured && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                Active Structure Allocated
              </span>
            )}
          </div>

          {profile.salaryConfigured && (profile.salaryBreakdown || profile.salaryComponents) ? (
            (() => {
              const b = profile.salaryBreakdown || {
                basicSalary: parseFloat(profile.salaryComponents?.basicSalary || "0"),
                daAmount: parseFloat(profile.salaryComponents?.basicSalary || "0") * (parseFloat(profile.salaryComponents?.daPercent || "0") / 100),
                daPercent: parseFloat(profile.salaryComponents?.daPercent || "0"),
                hraAmount: parseFloat(profile.salaryComponents?.basicSalary || "0") * (parseFloat(profile.salaryComponents?.hraPercent || "0") / 100),
                hraPercent: parseFloat(profile.salaryComponents?.hraPercent || "0"),
                otherAllowancesTotal: 0,
                grossEarnings: parseFloat(profile.salaryComponents?.basicSalary || "0") * 1.35,
                pfEmployeeAmount: parseFloat(profile.salaryComponents?.basicSalary || "0") * 0.12,
                pfEmployeePercent: 12,
                ptAmount: 200,
                tdsAmount: parseFloat(profile.salaryComponents?.monthlyTdsAmount || "0"),
                deductionsTotal: (parseFloat(profile.salaryComponents?.basicSalary || "0") * 0.12) + 200 + parseFloat(profile.salaryComponents?.monthlyTdsAmount || "0"),
                netMonthlyPay: (parseFloat(profile.salaryComponents?.basicSalary || "0") * 1.35) - ((parseFloat(profile.salaryComponents?.basicSalary || "0") * 0.12) + 200 + parseFloat(profile.salaryComponents?.monthlyTdsAmount || "0")),
              };

              const allowancesSum = b.daAmount + b.hraAmount + b.otherAllowancesTotal;

              return (
                <div className="space-y-6">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl text-sm">
                    <div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 block font-medium">
                        Base Pay (Basic)
                      </span>
                      <span className="font-bold text-base text-gray-900 dark:text-gray-100">
                        ₹{Math.round(b.basicSalary).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 block font-medium">
                        Allowances
                      </span>
                      <span className="font-bold text-base text-emerald-600 dark:text-emerald-400">
                        +₹{Math.round(allowancesSum).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 block font-medium">
                        Deductions
                      </span>
                      <span className="font-bold text-base text-rose-600 dark:text-rose-400">
                        -₹{Math.round(b.deductionsTotal).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 block font-medium">
                        Net Monthly Take-Home
                      </span>
                      <span className="font-extrabold text-base text-indigo-600 dark:text-indigo-400">
                        ₹{Math.round(b.netMonthlyPay).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Detailed Itemized Earnings vs Deductions Table */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Earnings Column */}
                    <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 bg-white dark:bg-gray-950/40 space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center justify-between">
                        <span>Earnings &amp; Allowances</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          ₹{Math.round(b.grossEarnings).toLocaleString()}
                        </span>
                      </h3>
                      <div className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                        <div className="py-2 flex justify-between">
                          <span className="text-gray-600 dark:text-gray-300">Basic Pay</span>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            ₹{Math.round(b.basicSalary).toLocaleString()}
                          </span>
                        </div>
                        <div className="py-2 flex justify-between">
                          <span className="text-gray-600 dark:text-gray-300">
                            Dearness Allowance (DA {b.daPercent}%)
                          </span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            +₹{Math.round(b.daAmount).toLocaleString()}
                          </span>
                        </div>
                        <div className="py-2 flex justify-between">
                          <span className="text-gray-600 dark:text-gray-300">
                            House Rent Allowance (HRA {b.hraPercent}%)
                          </span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            +₹{Math.round(b.hraAmount).toLocaleString()}
                          </span>
                        </div>
                        {b.otherAllowancesTotal > 0 && (
                          <div className="py-2 flex justify-between">
                            <span className="text-gray-600 dark:text-gray-300">Other Allowances</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              +₹{Math.round(b.otherAllowancesTotal).toLocaleString()}
                            </span>
                          </div>
                        )}
                        <div className="pt-2.5 flex justify-between font-bold text-sm text-gray-900 dark:text-gray-100">
                          <span>Gross Monthly Pay</span>
                          <span>₹{Math.round(b.grossEarnings).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Deductions Column */}
                    <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 bg-white dark:bg-gray-950/40 space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center justify-between">
                        <span>Statutory Deductions</span>
                        <span className="text-rose-600 dark:text-rose-400 font-bold">
                          -₹{Math.round(b.deductionsTotal).toLocaleString()}
                        </span>
                      </h3>
                      <div className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                        <div className="py-2 flex justify-between">
                          <span className="text-gray-600 dark:text-gray-300">
                            Provident Fund (PF Employee {b.pfEmployeePercent}%)
                          </span>
                          <span className="font-semibold text-rose-600 dark:text-rose-400">
                            -₹{Math.round(b.pfEmployeeAmount).toLocaleString()}
                          </span>
                        </div>
                        <div className="py-2 flex justify-between">
                          <span className="text-gray-600 dark:text-gray-300">Professional Tax (PT)</span>
                          <span className="font-semibold text-rose-600 dark:text-rose-400">
                            -₹{b.ptAmount.toLocaleString()}
                          </span>
                        </div>
                        <div className="py-2 flex justify-between">
                          <span className="text-gray-600 dark:text-gray-300">Income Tax / TDS</span>
                          <span className="font-semibold text-rose-600 dark:text-rose-400">
                            -₹{Math.round(b.tdsAmount).toLocaleString()}
                          </span>
                        </div>
                        <div className="pt-2.5 flex justify-between font-bold text-sm text-gray-900 dark:text-gray-100">
                          <span>Total Deductions</span>
                          <span className="text-rose-600 dark:text-rose-400">
                            -₹{Math.round(b.deductionsTotal).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-800 rounded-xl space-y-2">
              <p>No salary components configured yet for this staff member.</p>
              <p className="text-xs text-gray-400">
                Configure salary components via the HR dashboard to establish wage templates.
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              Active Staff Loans:
            </span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {profile.activeLoansCount}
            </span>
          </div>
        </div>
      )}

      {/* 5. LEAVES */}
      {activeTab === "leaves" && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Leave Allocations & Balances
          </h2>
          {profile.leaveBalances && profile.leaveBalances.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
              {profile.leaveBalances.map((lb: any) => (
                <div
                  key={lb.id}
                  className="p-3 flex items-center justify-between text-sm bg-white dark:bg-gray-900"
                >
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    Allocated: {lb.allocatedDays} days
                  </span>
                  <span className="text-gray-500 text-xs">
                    Used: {lb.usedDays} | Remaining: {lb.remainingDays}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-gray-500">
              No leave balances registered for current academic session.
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL: EDIT STAFF PROFILE ────────────────────────────────────────── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-2xl w-full border border-gray-200 dark:border-gray-800 shadow-2xl p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Edit Staff Profile — {profile.fullName}
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-sm">
                {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.firstName}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, firstName: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.lastName}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, lastName: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Official Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={editFormData.email}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, email: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.mobile}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, mobile: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Department *
                  </label>
                  <select
                    value={editFormData.departmentId}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, departmentId: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id} className="dark:bg-gray-800">
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Designation *
                  </label>
                  <select
                    value={editFormData.designationId}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, designationId: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                  >
                    {designations.map((d) => (
                      <option key={d.id} value={d.id} className="dark:bg-gray-800">
                        {d.name} {d.isTeaching ? "(Teaching)" : "(Non-Teaching)"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Contract Type
                  </label>
                  <select
                    value={editFormData.contractType}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, contractType: e.target.value as any })
                    }
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="PERMANENT" className="dark:bg-gray-800">Permanent</option>
                    <option value="PROBATION" className="dark:bg-gray-800">Probation</option>
                    <option value="CONTRACTUAL" className="dark:bg-gray-800">Contractual</option>
                    <option value="PART_TIME" className="dark:bg-gray-800">Part Time</option>
                    <option value="GUEST_FACULTY" className="dark:bg-gray-800">Guest Faculty</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Joining Date
                  </label>
                  <input
                    type="date"
                    value={editFormData.joiningDate}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, joiningDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Emergency Contact
                  </label>
                  <input
                    type="text"
                    value={editFormData.emergencyContact}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, emergencyContact: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Qualifications
                  </label>
                  <input
                    type="text"
                    value={editFormData.qualification}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, qualification: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Residential Address
                </label>
                <textarea
                  rows={2}
                  value={editFormData.address}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, address: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-50"
                >
                  {editLoading ? "Saving Changes..." : "Save Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: OFFBOARD STAFF ────────────────────────────────────────────── */}
      {showOffboardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full border border-gray-200 dark:border-gray-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Offboard Staff Member — {profile.fullName}
              </h3>
              <button
                onClick={() => {
                  setShowOffboardModal(false);
                  setOffboardWarning(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            {offboardError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-sm">
                {offboardError}
              </div>
            )}

            {/* Academic Reassignment Warning */}
            {offboardWarning && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2 text-xs text-amber-900 dark:text-amber-200">
                <div className="font-semibold text-sm flex items-center gap-1">
                  ⚠️ Active Academic Assignments Detected
                </div>
                <p>{offboardWarning.message}</p>
                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={offboardData.forceReassign}
                      onChange={(e) =>
                        setOffboardData({
                          ...offboardData,
                          forceReassign: e.target.checked,
                        })
                      }
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>
                      I understand. Safely unassign active classes and timetable periods. Historical attendance & assessments will remain intact.
                    </span>
                  </label>
                </div>
              </div>
            )}

            <form onSubmit={handleOffboardSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Separation Type *
                </label>
                <select
                  value={offboardData.separationType}
                  onChange={(e) =>
                    setOffboardData({
                      ...offboardData,
                      separationType: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="RESIGNATION" className="dark:bg-gray-800">Resignation</option>
                  <option value="TERMINATION" className="dark:bg-gray-800">Termination</option>
                  <option value="RETIREMENT" className="dark:bg-gray-800">Retirement</option>
                  <option value="OTHER" className="dark:bg-gray-800">Other Separation</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Relieving / Separation Date *
                </label>
                <input
                  type="date"
                  required
                  value={offboardData.relievingDate}
                  onChange={(e) =>
                    setOffboardData({
                      ...offboardData,
                      relievingDate: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Reason / Remarks
                </label>
                <textarea
                  rows={3}
                  placeholder="Record formal exit reasons, handover details, or remarks..."
                  value={offboardData.separationReason}
                  onChange={(e) =>
                    setOffboardData({
                      ...offboardData,
                      separationReason: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowOffboardModal(false);
                    setOffboardWarning(null);
                  }}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={offboardLoading}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition disabled:opacity-50"
                >
                  {offboardLoading ? "Processing..." : "Complete Offboarding"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
