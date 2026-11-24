"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  GraduationCap,
  Calendar,
  AlertTriangle,
  FileText,
  BookOpen,
  Award,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Users,
  Lock,
  Unlock,
  Briefcase,
  CreditCard,
  FileSpreadsheet,
  Eye,
  RefreshCw,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import { AppModal } from "@/components/ui/AppModal";
import { Avatar } from "@/components/ui/Avatar";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MetricCard } from "@/components/ui/MetricCard";
import {
  AddressAutofill,
  type AddressValue,
  formatAddressForStorage,
} from "@/components/forms/AddressAutofill";
import { toast } from "sonner";
import {
  updateStaff,
  updateStaffPhotoAction,
  confirmStaffProbation,
  offboardStaff,
  reactivateStaff,
  toggleStaffLegalHold,
  revealStaffPii,
} from "../../actions";

function formatDisplayDate(val: string | Date | null | undefined): string {
  if (!val) return "N/A";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return "N/A";
    const day = String(d.getUTCDate()).padStart(2, "0");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const month = months[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return "N/A";
  }
}

interface Staff360Props {
  profile: any;
  departments: Array<{ id: string; name: string }>;
  designations: Array<{ id: string; name: string; isTeaching: boolean }>;
  userRole: string;
  schoolName: string;
}

export type StaffTabKey =
  | "academics"
  | "leaves"
  | "employment"
  | "compensation"
  | "records";

export function Staff360Client({
  profile,
  departments,
  designations,
  userRole,
  schoolName,
}: Staff360Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Tab navigation
  const tabParam = searchParams.get("tab")?.toLowerCase();
  const validTabs: StaffTabKey[] = [
    "academics",
    "leaves",
    "employment",
    "compensation",
    "records",
  ];
  const initialTab: StaffTabKey =
    validTabs.includes(tabParam as StaffTabKey)
      ? (tabParam as StaffTabKey)
      : profile.isTeaching
        ? "academics"
        : "employment";

  const [activeTab, setActiveTab] = useState<StaffTabKey>(initialTab);

  useEffect(() => {
    const currentTab = searchParams.get("tab")?.toLowerCase() as StaffTabKey;
    if (currentTab && validTabs.includes(currentTab) && currentTab !== activeTab) {
      setActiveTab(currentTab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    const key = tab as StaffTabKey;
    setActiveTab(key);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Avatar Upload State
  const [photoUrl, setPhotoUrl] = useState<string | null>(profile.photoUrl || null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const handlePhotoUpload = async (file: File) => {
    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "staff-photos");

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload photo to storage");
      }

      const uploadData = await uploadRes.json();
      const s3Key = uploadData.key || uploadData.s3Key || uploadData.path;
      if (!s3Key) {
        throw new Error("Invalid response from upload service");
      }

      const res = await updateStaffPhotoAction(profile.id, s3Key);
      if (!res.success) {
        throw new Error(res.message || "Failed to link photo to staff profile");
      }

      setPhotoUrl(URL.createObjectURL(file));
      toast.success("Staff profile photo updated");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile photo");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePhotoRemove = async () => {
    setIsUploadingPhoto(true);
    try {
      const res = await updateStaffPhotoAction(profile.id, null);
      if (!res.success) {
        throw new Error(res.message || "Failed to remove staff photo");
      }
      setPhotoUrl(null);
      toast.success("Staff profile photo removed");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove photo");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

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

  const [addressValue, setAddressValue] = useState<AddressValue>({
    pincode: profile.pincode || "",
    state: profile.state || "",
    district: profile.district || "",
    city: "",
    line1: profile.address || "",
    line2: "",
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

  // Governed Confirmation Dialog States (Replacing window.confirm)
  const [showConfirmProbationDialog, setShowConfirmProbationDialog] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [showLegalHoldDialog, setShowLegalHoldDialog] = useState(false);
  const [legalHoldLoading, setLegalHoldLoading] = useState(false);

  const [showReactivateDialog, setShowReactivateDialog] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);

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
      const formattedAddress = formatAddressForStorage(addressValue);
      const res = await updateStaff(profile.id, {
        ...editFormData,
        address: formattedAddress,
        pincode: addressValue.pincode || undefined,
        state: addressValue.state || undefined,
        district: addressValue.district || undefined,
      });
      if (!res.success) {
        setEditError(res.message || "Failed to update staff profile");
      } else {
        setShowEditModal(false);
        toast.success("Staff profile updated");
        router.refresh();
      }
    } catch (err: any) {
      setEditError(err.message || "Error updating staff profile");
    } finally {
      setEditLoading(false);
    }
  };

  const handleConfirmProbationAction = async () => {
    setConfirmLoading(true);
    try {
      const res = await confirmStaffProbation(profile.id);
      if (!res.success) {
        toast.error(res.message || "Failed to confirm probation");
      } else {
        setShowConfirmProbationDialog(false);
        toast.success("Probation confirmed successfully. Permanent status granted.");
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.message || "Error confirming probation");
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
        toast.success("Staff offboarding completed");
        router.refresh();
      }
    } catch (err: any) {
      setOffboardError(err.message || "Error during offboarding");
    } finally {
      setOffboardLoading(false);
    }
  };

  const handleToggleLegalHoldAction = async () => {
    const nextState = !profile.legalHold;
    setLegalHoldLoading(true);
    try {
      const res = await toggleStaffLegalHold(profile.id, nextState);
      if (!res.success) {
        toast.error(res.message || "Failed to update legal hold status");
      } else {
        setShowLegalHoldDialog(false);
        toast.success(
          nextState
            ? "Legal hold applied. Profile locked against mutation/separation."
            : "Legal hold removed.",
        );
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.message || "Error toggling legal hold");
    } finally {
      setLegalHoldLoading(false);
    }
  };

  const handleReactivateAction = async () => {
    setReactivateLoading(true);
    try {
      const res = await reactivateStaff(profile.id);
      if (!res.success) {
        toast.error(res.message || "Failed to reactivate staff");
      } else {
        setShowReactivateDialog(false);
        toast.success("Staff member reactivated and login credentials restored");
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.message || "Error reactivating staff");
    } finally {
      setReactivateLoading(false);
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
        toast.success("Statutory PII revealed under audit log");
      }
    } catch (err: any) {
      setPiiError(err.message || "Error revealing PII");
    } finally {
      setRevealingPii(false);
    }
  };

  const totalLeaveBalance =
    profile.leaveBalances?.reduce(
      (sum: number, lb: any) => sum + (lb.remainingDays || 0),
      0,
    ) ?? 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ─── STICKY IDENTITY HEADER (Apple Large Title & One-Tint Law) ─────────────── */}
      <div className="sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-border/40 py-3.5 px-4 sm:px-6 -mx-4 sm:-mx-6 mb-5 transition-all">
        {/* Breadcrumb */}
        <div className="mb-2 text-xs text-muted-foreground flex items-center gap-1.5">
          <Link href="/hr" className="hover:text-foreground transition-colors">
            Staff Directory
          </Link>
          <span>/</span>
          <span>{schoolName}</span>
          <span>/</span>
          <span className="text-foreground font-medium truncate">
            {profile.employeeCode}
          </span>
        </div>

        {/* Identity & Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Shared Avatar with Identity Upload/Replace */}
            <Avatar
              src={photoUrl}
              name={profile.fullName}
              size="xl"
              shape="squircle"
              canEdit={canMutate}
              isLoading={isUploadingPhoto}
              onPhotoSelected={handlePhotoUpload}
              onPhotoRemoved={handlePhotoRemove}
              className="shadow-xs shrink-0"
            />

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight truncate leading-tight">
                  {profile.fullName || "Name not recorded"}
                </h1>
                <span className="text-[11px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/40">
                  {profile.employeeCode}
                </span>

                {profile.isTeaching ? (
                  <span className="text-[11px] font-semibold text-semantic-interactive bg-semantic-interactive/10 border border-semantic-interactive/20 px-2 py-0.5 rounded-full">
                    Teaching Faculty
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-muted-foreground bg-muted/40 border border-border/40 px-2 py-0.5 rounded-full">
                    Non-Teaching
                  </span>
                )}

                {profile.legalHold && (
                  <span className="text-[11px] font-semibold text-semantic-attention bg-semantic-attention/10 border border-semantic-attention/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Legal Hold Active
                  </span>
                )}

                {profile.isActive ? (
                  <StatusBadge status="success" label="Active" />
                ) : (
                  <StatusBadge
                    status="destructive"
                    label={`Separated (${profile.separationType || "Inactive"})`}
                  />
                )}

                {profile.contractType === "PROBATION" && profile.isActive && (
                  <StatusBadge status="warning" label="On Probation" />
                )}
              </div>

              {/* Sub-identity row */}
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                <span>{profile.designationName || "—"}</span>
                <span>•</span>
                <span>{profile.departmentName || "—"}</span>
                <span>•</span>
                <span>
                  Joined:{" "}
                  <strong className="text-foreground">
                    {profile.joiningDate ? formatDisplayDate(profile.joiningDate) : "—"}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Payroll:{" "}
                  <strong className="text-foreground">
                    {profile.salaryConfigured ? "Configured" : "Unset"}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Action Row — Law: Sole primary filled button per action zone */}
          <div className="flex items-center gap-2 flex-wrap">
            {canMutate && (
              <button
                onClick={() => setShowEditModal(true)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-xs"
              >
                Edit Profile
              </button>
            )}

            {canMutate && profile.contractType === "PROBATION" && profile.isActive && (
              <button
                onClick={() => setShowConfirmProbationDialog(true)}
                disabled={confirmLoading}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-card text-foreground border border-border/40 hover:bg-muted transition"
              >
                Confirm Probation
              </button>
            )}

            {canAdminister && profile.isActive && (
              <button
                onClick={() => {
                  setOffboardWarning(null);
                  setOffboardError(null);
                  setShowOffboardModal(true);
                }}
                disabled={profile.legalHold}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-card text-semantic-money-owed border border-border/40 hover:bg-semantic-money-owed/10 transition disabled:opacity-40"
              >
                Offboard Staff
              </button>
            )}

            {canAdminister && !profile.isActive && (
              <button
                onClick={() => setShowReactivateDialog(true)}
                disabled={reactivateLoading}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-card text-foreground border border-border/40 hover:bg-muted transition"
              >
                Reactivate Staff
              </button>
            )}

            {canAdminister && (
              <button
                onClick={() => setShowLegalHoldDialog(true)}
                disabled={legalHoldLoading}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-card text-muted-foreground border border-border/40 hover:bg-muted hover:text-foreground transition flex items-center gap-1.5"
              >
                {profile.legalHold ? (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Remove Hold</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Legal Hold</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── 4-TILE INSTANT GLANCE STRIP ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Tile 1: Teaching Footprint */}
        <MetricCard
          title="Teaching Footprint"
          value={
            profile.isTeaching
              ? `${profile.academicAllocations?.weeklyPeriodsCount ?? 0} periods/wk`
              : "Non-Teaching"
          }
          subtext={
            profile.isTeaching
              ? `${profile.academicAllocations?.classSubjects?.length ?? 0} class subjects • ${profile.academicAllocations?.classTeacherOf?.length ?? 0} class teacher`
              : "Administrative staff"
          }
          icon={<GraduationCap className="w-4 h-4" />}
        />

        {/* Tile 2: Employment Standing */}
        <MetricCard
          title="Employment"
          value={profile.contractType || "PERMANENT"}
          subtext={`Joined ${profile.joiningDate ? formatDisplayDate(profile.joiningDate) : "—"}`}
          icon={<Briefcase className="w-4 h-4" />}
          className={
            profile.contractType === "PROBATION" && profile.isActive
              ? "border-semantic-attention/40 bg-semantic-attention/5"
              : ""
          }
        />

        {/* Tile 3: Leaves Balance */}
        <MetricCard
          title="Leaves Balance"
          value={`${totalLeaveBalance} days`}
          subtext={`${profile.leaveBalances?.length ?? 0} active leave policies`}
          icon={<Calendar className="w-4 h-4" />}
        />

        {/* Tile 4: Payroll Standing */}
        <MetricCard
          title="Payroll Standing"
          value={
            profile.legalHold
              ? "LEGAL HOLD"
              : profile.salaryConfigured
                ? profile.salaryBreakdown
                  ? `₹${Math.round(profile.salaryBreakdown.netMonthlyPay).toLocaleString()}`
                  : "PROVISIONAL"
                : "UNSET"
          }
          subtext={
            profile.legalHold
              ? "Separation blocked"
              : profile.salaryConfigured
                ? profile.salaryBreakdown
                  ? "Net take-home verified"
                  : "Components on record"
                : "No wage template set"
          }
          icon={<CreditCard className="w-4 h-4" />}
          className={
            !profile.salaryConfigured
              ? "border-semantic-attention/40 bg-semantic-attention/5"
              : ""
          }
        />
      </div>

      {/* ─── NEXT BEST ACTION / GAPS BANNER ──────────────────────────────────────── */}
      {!profile.salaryConfigured ? (
        <div className="p-3.5 bg-semantic-attention/10 border border-semantic-attention/20 rounded-xl flex items-center justify-between gap-3 text-xs text-foreground">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-semantic-attention shrink-0" />
            <div>
              <strong className="font-semibold text-semantic-attention">
                Wage Structure Unset:
              </strong>{" "}
              This staff member has no salary template or components configured.
            </div>
          </div>
          <Link
            href="/hr?tab=payroll"
            className="text-xs font-semibold text-semantic-interactive hover:underline shrink-0"
          >
            Configure Salary Structure →
          </Link>
        </div>
      ) : profile.contractType === "PROBATION" && profile.isActive ? (
        <div className="p-3.5 bg-semantic-attention/10 border border-semantic-attention/20 rounded-xl flex items-center justify-between gap-3 text-xs text-foreground">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-semantic-attention shrink-0" />
            <div>
              <strong className="font-semibold text-semantic-attention">
                Probation Review Eligible:
              </strong>{" "}
              Staff member is currently on probation. Confirm permanent status when milestones are satisfied.
            </div>
          </div>
          <button
            onClick={() => setShowConfirmProbationDialog(true)}
            className="text-xs font-semibold text-semantic-interactive hover:underline shrink-0"
          >
            Confirm Status →
          </button>
        </div>
      ) : null}

      {/* ─── FREQUENCY-ALLOCATED TABS (Apple SegmentedControl Grammar) ──────────── */}
      <div className="pt-1">
        <SegmentedControl
          value={activeTab}
          onChange={handleTabChange}
          options={[
            ...(profile.isTeaching
              ? [
                  {
                    value: "academics",
                    label: `Academics (${profile.academicAllocations?.weeklyPeriodsCount ?? 0}p)`,
                  },
                ]
              : []),
            {
              value: "leaves",
              label: `Leaves (${totalLeaveBalance}d)`,
            },
            {
              value: "employment",
              label: "Employment",
            },
            {
              value: "compensation",
              label: "Compensation & Loans",
            },
            {
              value: "records",
              label: "Records & PII",
            },
          ]}
        />
      </div>

      {/* ─── TAB 1: ACADEMICS ───────────────────────────────────────────────────── */}
      {activeTab === "academics" && (
        <div className="bg-card border border-border/40 rounded-2xl p-5 space-y-6 shadow-xs">
          {!profile.isTeaching ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">
                This staff member is classified as Non-Teaching faculty and has no academic allocations.
              </p>
            </div>
          ) : !profile.academicAllocations ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No academic allocations assigned yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 bg-muted/40 border border-border/40 rounded-xl space-y-1">
                  <span className="text-xs text-muted-foreground font-medium">
                    Class Teacher Sections
                  </span>
                  <div className="text-xl font-bold text-foreground">
                    {profile.academicAllocations.classTeacherOf.length}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {profile.academicAllocations.classTeacherOf.join(", ") || "None"}
                  </div>
                </div>

                <div className="p-4 bg-muted/40 border border-border/40 rounded-xl space-y-1">
                  <span className="text-xs text-muted-foreground font-medium">
                    Class Subjects Assigned
                  </span>
                  <div className="text-xl font-bold text-foreground">
                    {profile.academicAllocations.classSubjects.length}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Primary curriculum mapping
                  </div>
                </div>

                <div className="p-4 bg-muted/40 border border-border/40 rounded-xl space-y-1">
                  <span className="text-xs text-muted-foreground font-medium">
                    Weekly Timetable Periods
                  </span>
                  <div className="text-xl font-bold text-foreground">
                    {profile.academicAllocations.weeklyPeriodsCount}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Scheduled periods per week
                  </div>
                </div>
              </div>

              {/* Subject Allocations List */}
              {profile.academicAllocations.classSubjects.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Class Subjects Roster
                  </h3>
                  <div className="divide-y divide-border/40 border border-border/40 rounded-xl overflow-hidden bg-card">
                    {profile.academicAllocations.classSubjects.map((cs: any) => (
                      <div
                        key={cs.id}
                        className="p-3.5 flex items-center justify-between text-sm"
                      >
                        <span className="font-semibold text-foreground">
                          {cs.className}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono bg-muted/60 px-2.5 py-0.5 rounded-md border border-border/40">
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

      {/* ─── TAB 2: LEAVES ──────────────────────────────────────────────────────── */}
      {activeTab === "leaves" && (
        <div className="bg-card border border-border/40 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Leave Allocations & Balances
              </h2>
              <p className="text-xs text-muted-foreground">
                Session entitlements and recorded leave usage.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-semantic-interactive/10 text-semantic-interactive border border-semantic-interactive/20">
              {totalLeaveBalance} Days Available
            </span>
          </div>

          {profile.leaveBalances && profile.leaveBalances.length > 0 ? (
            <div className="divide-y divide-border/40 border border-border/40 rounded-xl overflow-hidden bg-card">
              {profile.leaveBalances.map((lb: any) => (
                <div
                  key={lb.id}
                  className="p-3.5 flex items-center justify-between text-sm"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-foreground block">
                      {lb.leaveType || "Annual Leave"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Allocated: {lb.allocatedDays} days
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-semantic-money-in text-sm block">
                      {lb.remainingDays} days left
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Used: {lb.usedDays} days
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border/40 rounded-xl">
              No leave balances registered for the current academic session.
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: EMPLOYMENT & LIFECYCLE ───────────────────────────────────────── */}
      {activeTab === "employment" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Organizational Role */}
          <div className="bg-card border border-border/40 rounded-2xl p-5 space-y-4 shadow-xs">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider text-muted-foreground">
              Organizational Role
            </h2>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-muted/40 rounded-xl border border-border/40 space-y-0.5">
                <span className="text-muted-foreground block text-[11px]">Department</span>
                <span className="font-semibold text-foreground text-sm">
                  {profile.departmentName}
                </span>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl border border-border/40 space-y-0.5">
                <span className="text-muted-foreground block text-[11px]">Designation</span>
                <span className="font-semibold text-foreground text-sm">
                  {profile.designationName}
                </span>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl border border-border/40 space-y-0.5">
                <span className="text-muted-foreground block text-[11px]">Classification</span>
                <span className="font-semibold text-foreground">
                  {profile.isTeaching ? "Teaching Faculty" : "Administrative"}
                </span>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl border border-border/40 space-y-0.5">
                <span className="text-muted-foreground block text-[11px]">Current State</span>
                <span className="font-semibold text-foreground">
                  {profile.isActive ? "Active Duty" : "Separated"}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-border/40 space-y-2">
              <div>
                <span className="text-xs text-muted-foreground block mb-0.5">
                  Academic Qualifications
                </span>
                <p className="text-xs text-foreground font-medium">
                  {profile.qualification || "None recorded on file."}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block mb-0.5">
                  Prior Experience
                </span>
                <p className="text-xs text-foreground font-medium">
                  {profile.experience || "None recorded on file."}
                </p>
              </div>
            </div>
          </div>

          {/* Lifecycle Milestones */}
          <div className="bg-card border border-border/40 rounded-2xl p-5 space-y-4 shadow-xs">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider text-muted-foreground">
              Lifecycle Milestones
            </h2>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-muted/40 rounded-xl border border-border/40 space-y-0.5">
                <span className="text-muted-foreground block text-[11px]">Joining Date</span>
                <span className="font-semibold text-foreground text-sm">
                  {profile.joiningDate ? formatDisplayDate(profile.joiningDate) : "—"}
                </span>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl border border-border/40 space-y-0.5">
                <span className="text-muted-foreground block text-[11px]">Confirmation Date</span>
                <span className="font-semibold text-foreground text-sm">
                  {profile.confirmationDate
                    ? formatDisplayDate(profile.confirmationDate)
                    : "Pending Probation"}
                </span>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl border border-border/40 space-y-0.5">
                <span className="text-muted-foreground block text-[11px]">Relieving Date</span>
                <span className="font-semibold text-foreground text-sm">
                  {profile.relievingDate
                    ? formatDisplayDate(profile.relievingDate)
                    : "N/A (Active)"}
                </span>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl border border-border/40 space-y-0.5">
                <span className="text-muted-foreground block text-[11px]">Separation Type</span>
                <span className="font-semibold text-foreground text-sm">
                  {profile.separationType || "N/A"}
                </span>
              </div>
            </div>

            {profile.separationReason && (
              <div className="p-3 bg-semantic-money-owed/10 border border-semantic-money-owed/20 rounded-xl text-xs space-y-1">
                <span className="font-semibold text-semantic-money-owed">
                  Separation Remarks / Reason:
                </span>
                <p className="text-foreground">{profile.separationReason}</p>
              </div>
            )}

            <div className="pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
              Staff record registered on{" "}
              {profile.createdAt ? formatDisplayDate(profile.createdAt) : "—"}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: COMPENSATION & LOANS (TRUTH FIX: NO FABRICATED MATH) ───────────── */}
      {activeTab === "compensation" && (
        <div className="bg-card border border-border/40 rounded-2xl p-5 space-y-6 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Salary Structure &amp; Compensation
              </h2>
              <p className="text-xs text-muted-foreground">
                Authoritative breakdown from payroll engine; zero client-side estimates.
              </p>
            </div>
            {profile.salaryConfigured && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-semantic-money-in/10 text-semantic-money-in border border-semantic-money-in/20">
                Active Structure Allocated
              </span>
            )}
          </div>

          {/* Condition A: Authoritative Salary Breakdown from Backend */}
          {profile.salaryBreakdown ? (
            (() => {
              const b = profile.salaryBreakdown;
              const allowancesSum =
                (b.daAmount || 0) + (b.hraAmount || 0) + (b.otherAllowancesTotal || 0);

              return (
                <div className="space-y-6">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-muted/40 border border-border/40 rounded-xl text-xs">
                    <div>
                      <span className="text-muted-foreground block font-medium">
                        Base Pay (Basic)
                      </span>
                      <span className="font-bold text-base text-foreground">
                        ₹{Math.round(b.basicSalary || 0).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block font-medium">
                        Allowances
                      </span>
                      <span className="font-bold text-base text-semantic-money-in">
                        +₹{Math.round(allowancesSum).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block font-medium">
                        Deductions
                      </span>
                      <span className="font-bold text-base text-semantic-money-owed">
                        -₹{Math.round(b.deductionsTotal || 0).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block font-medium">
                        Net Monthly Take-Home
                      </span>
                      <span className="font-bold text-base text-primary">
                        ₹{Math.round(b.netMonthlyPay || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Detailed Itemized Earnings vs Deductions Table */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Earnings Column */}
                    <div className="border border-border/40 rounded-xl p-4 bg-card space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                        <span>Earnings &amp; Allowances</span>
                        <span className="text-semantic-money-in font-bold">
                          ₹{Math.round(b.grossEarnings || 0).toLocaleString()}
                        </span>
                      </h3>
                      <div className="divide-y divide-border/40 text-xs">
                        <div className="py-2 flex justify-between">
                          <span className="text-muted-foreground">Basic Pay</span>
                          <span className="font-semibold text-foreground">
                            ₹{Math.round(b.basicSalary || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="py-2 flex justify-between">
                          <span className="text-muted-foreground">
                            Dearness Allowance (DA {b.daPercent || 0}%)
                          </span>
                          <span className="font-semibold text-semantic-money-in">
                            +₹{Math.round(b.daAmount || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="py-2 flex justify-between">
                          <span className="text-muted-foreground">
                            House Rent Allowance (HRA {b.hraPercent || 0}%)
                          </span>
                          <span className="font-semibold text-semantic-money-in">
                            +₹{Math.round(b.hraAmount || 0).toLocaleString()}
                          </span>
                        </div>
                        {(b.otherAllowancesTotal || 0) > 0 && (
                          <div className="py-2 flex justify-between">
                            <span className="text-muted-foreground">Other Allowances</span>
                            <span className="font-semibold text-semantic-money-in">
                              +₹{Math.round(b.otherAllowancesTotal).toLocaleString()}
                            </span>
                          </div>
                        )}
                        <div className="pt-2.5 flex justify-between font-bold text-sm text-foreground">
                          <span>Gross Monthly Pay</span>
                          <span>₹{Math.round(b.grossEarnings || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Deductions Column */}
                    <div className="border border-border/40 rounded-xl p-4 bg-card space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                        <span>Statutory Deductions</span>
                        <span className="text-semantic-money-owed font-bold">
                          -₹{Math.round(b.deductionsTotal || 0).toLocaleString()}
                        </span>
                      </h3>
                      <div className="divide-y divide-border/40 text-xs">
                        <div className="py-2 flex justify-between">
                          <span className="text-muted-foreground">
                            Provident Fund (PF Employee {b.pfEmployeePercent || 0}%)
                          </span>
                          <span className="font-semibold text-semantic-money-owed">
                            -₹{Math.round(b.pfEmployeeAmount || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="py-2 flex justify-between">
                          <span className="text-muted-foreground">Professional Tax (PT)</span>
                          <span className="font-semibold text-semantic-money-owed">
                            -₹{(b.ptAmount || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="py-2 flex justify-between">
                          <span className="text-muted-foreground">Income Tax / TDS</span>
                          <span className="font-semibold text-semantic-money-owed">
                            -₹{Math.round(b.tdsAmount || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="pt-2.5 flex justify-between font-bold text-sm text-foreground">
                          <span>Total Deductions</span>
                          <span className="text-semantic-money-owed">
                            -₹{Math.round(b.deductionsTotal || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : profile.salaryComponents ? (
            /* Condition B: Provisional Components on Record, Zero Fabricated Math */
            <div className="space-y-4">
              <div className="p-3.5 bg-semantic-attention/10 border border-semantic-attention/20 rounded-xl flex items-center gap-2.5 text-xs text-foreground">
                <AlertCircle className="w-4 h-4 text-semantic-attention shrink-0" />
                <div>
                  <strong className="font-semibold text-semantic-attention">
                    Provisional components on record:
                  </strong>{" "}
                  No computed take-home exists. Below are the registered base parameters; configure wage template for full projection.
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-muted/40 border border-border/40 rounded-xl text-xs">
                <div>
                  <span className="text-muted-foreground block font-medium">Base Pay (Basic)</span>
                  <span className="font-bold text-base text-foreground">
                    ₹{parseFloat(profile.salaryComponents.basicSalary || "0").toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block font-medium">DA Rate</span>
                  <span className="font-bold text-base text-foreground">
                    {profile.salaryComponents.daPercent || "0"}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block font-medium">HRA Rate</span>
                  <span className="font-bold text-base text-foreground">
                    {profile.salaryComponents.hraPercent || "0"}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block font-medium">Net Take-Home</span>
                  <span className="font-bold text-base text-muted-foreground">
                    — (Uncomputed)
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Condition C: Honest Unset State */
            <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border/40 rounded-xl space-y-2">
              <p className="font-medium text-foreground">
                No salary components configured yet for this staff member.
              </p>
              <p className="text-xs text-muted-foreground">
                Allocate a wage template via the HR dashboard to establish salary structures.
              </p>
              <div className="pt-2">
                <Link
                  href="/hr?tab=payroll"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
                >
                  Configure Salary Structure →
                </Link>
              </div>
            </div>
          )}

          {/* Active Loans Row */}
          <div className="pt-4 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
            <span>Active Staff Loans:</span>
            <span className="font-semibold text-foreground text-sm">
              {profile.activeLoansCount}
            </span>
          </div>
        </div>
      )}

      {/* ─── TAB 5: RECORDS & PII ───────────────────────────────────────────────── */}
      {activeTab === "records" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Personal Identity Details */}
          <div className="bg-card border border-border/40 rounded-2xl p-5 space-y-4 shadow-xs">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider text-muted-foreground">
              Personal Information
            </h2>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-muted/40 rounded-xl border border-border/40 space-y-0.5">
                <span className="text-muted-foreground block text-[11px]">First Name</span>
                <span className="font-semibold text-foreground text-sm">
                  {profile.firstName || "—"}
                </span>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl border border-border/40 space-y-0.5">
                <span className="text-muted-foreground block text-[11px]">Last Name</span>
                <span className="font-semibold text-foreground text-sm">
                  {profile.lastName || "—"}
                </span>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl border border-border/40 space-y-0.5">
                <span className="text-muted-foreground block text-[11px]">Gender</span>
                <span className="font-semibold text-foreground">
                  {profile.gender || "—"}
                </span>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl border border-border/40 space-y-0.5">
                <span className="text-muted-foreground block text-[11px]">Date of Birth</span>
                <span className="font-semibold text-foreground">
                  {profile.dateOfBirth || "—"}
                </span>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl border border-border/40 space-y-0.5">
                <span className="text-muted-foreground block text-[11px]">Aadhaar Last 4</span>
                <span className="font-semibold text-foreground font-mono">
                  {profile.aadhaarLast4 ? `•••• •••• ${profile.aadhaarLast4}` : "—"}
                </span>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl border border-border/40 space-y-0.5">
                <span className="text-muted-foreground block text-[11px]">Contract Type</span>
                <span className="font-semibold text-foreground">
                  {profile.contractType}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-border/40 space-y-1">
              <span className="text-xs text-muted-foreground block">Residential Address</span>
              <p className="text-xs text-foreground font-medium">
                {profile.address || "No address provided."}
              </p>
              {(profile.pincode || profile.district || profile.state) && (
                <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
                  {profile.pincode && (
                    <span className="px-2 py-0.5 rounded bg-muted/60 font-mono border border-border/40">
                      PIN: {profile.pincode}
                    </span>
                  )}
                  {profile.district && (
                    <span className="px-2 py-0.5 rounded bg-muted/60 border border-border/40">
                      {profile.district}
                    </span>
                  )}
                  {profile.state && (
                    <span className="px-2 py-0.5 rounded bg-muted/60 border border-border/40">
                      {profile.state}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Contact & DPDP Sensitive PII */}
          <div className="bg-card border border-border/40 rounded-2xl p-5 space-y-4 shadow-xs">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider text-muted-foreground">
              Contact & Statutory PII
            </h2>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-muted/40 rounded-xl border border-border/40 space-y-0.5 col-span-2">
                <span className="text-muted-foreground block text-[11px]">Official Email</span>
                <span className="font-semibold text-foreground break-all">
                  {profile.email || "—"}
                </span>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl border border-border/40 space-y-0.5">
                <span className="text-muted-foreground block text-[11px]">Mobile Number</span>
                <span className="font-semibold text-foreground">
                  {profile.mobile || "—"}
                </span>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl border border-border/40 space-y-0.5">
                <span className="text-muted-foreground block text-[11px]">Emergency Contact</span>
                <span className="font-semibold text-foreground">
                  {profile.emergencyContact || "—"}
                </span>
              </div>
            </div>

            {/* DPDP Sensitive Data Card */}
            <div className="pt-3 border-t border-border/40 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-semantic-money-in" />
                    Statutory & Financial PII (DPDP Protected)
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    AES-256 encrypted at rest. Unmasking is audit-logged.
                  </p>
                </div>
                {!piiData && (
                  <button
                    onClick={handleRevealPii}
                    disabled={revealingPii}
                    className="px-3 py-1.5 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded-xl transition disabled:opacity-50 min-h-[36px]"
                  >
                    {revealingPii ? "Decrypting..." : "Reveal PII"}
                  </button>
                )}
              </div>

              {piiError && (
                <p className="text-xs text-semantic-money-owed font-medium">
                  {piiError}
                </p>
              )}

              {piiData && (
                <div className="grid grid-cols-2 gap-2.5 p-3.5 bg-muted/40 border border-border/40 rounded-xl text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">PAN</span>
                    <span className="font-mono font-semibold text-foreground">
                      {piiData.pan || "Not Provided"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Bank Name</span>
                    <span className="font-semibold text-foreground">
                      {piiData.bankName || "Not Provided"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Account Number</span>
                    <span className="font-mono font-semibold text-foreground">
                      {piiData.bankAccount || "Not Provided"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">IFSC Code</span>
                    <span className="font-mono font-semibold text-foreground">
                      {piiData.bankIfsc || "Not Provided"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: EDIT STAFF PROFILE ────────────────────────────────────────── */}
      <AppModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={`Edit Staff Profile — ${profile.fullName}`}
        size="xl"
      >
        <div className="space-y-4">
          {editError && (
            <div className="p-3 bg-semantic-money-owed/10 border border-semantic-money-owed/20 rounded-xl text-semantic-money-owed text-xs font-medium">
              {editError}
            </div>
          )}

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.firstName}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, firstName: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-muted/40 border-border/40 text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.lastName}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, lastName: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-muted/40 border-border/40 text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Official Email *
                </label>
                <input
                  type="email"
                  required
                  value={editFormData.email}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-muted/40 border-border/40 text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Mobile Number *
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.mobile}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, mobile: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-muted/40 border-border/40 text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Department *
                </label>
                <select
                  value={editFormData.departmentId}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, departmentId: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-muted/40 border-border/40 text-foreground focus:ring-1 focus:ring-primary"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id} className="bg-card">
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Designation *
                </label>
                <select
                  value={editFormData.designationId}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, designationId: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-muted/40 border-border/40 text-foreground focus:ring-1 focus:ring-primary"
                >
                  {designations.map((d) => (
                    <option key={d.id} value={d.id} className="bg-card">
                      {d.name} {d.isTeaching ? "(Teaching)" : "(Non-Teaching)"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Contract Type
                </label>
                <select
                  value={editFormData.contractType}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      contractType: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-muted/40 border-border/40 text-foreground focus:ring-1 focus:ring-primary"
                >
                  <option value="PERMANENT" className="bg-card">Permanent</option>
                  <option value="PROBATION" className="bg-card">Probation</option>
                  <option value="CONTRACTUAL" className="bg-card">Contractual</option>
                  <option value="PART_TIME" className="bg-card">Part Time</option>
                  <option value="GUEST_FACULTY" className="bg-card">Guest Faculty</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Joining Date
                </label>
                <input
                  type="date"
                  value={editFormData.joiningDate}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, joiningDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-muted/40 border-border/40 text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Emergency Contact
                </label>
                <input
                  type="text"
                  value={editFormData.emergencyContact}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, emergencyContact: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-muted/40 border-border/40 text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Qualifications
                </label>
                <input
                  type="text"
                  value={editFormData.qualification}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, qualification: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-muted/40 border-border/40 text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-foreground">
                Residential Address & Location (DPDP / Tax Compliant)
              </label>
              <AddressAutofill
                value={addressValue}
                onChange={setAddressValue}
                disabled={editLoading}
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-border/40">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-xs rounded-xl border border-border/40 text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editLoading}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
              >
                {editLoading ? "Saving Changes..." : "Save Profile"}
              </button>
            </div>
          </form>
        </div>
      </AppModal>

      {/* ─── MODAL: OFFBOARD STAFF ────────────────────────────────────────────── */}
      <AppModal
        open={showOffboardModal}
        onClose={() => {
          setShowOffboardModal(false);
          setOffboardWarning(null);
        }}
        title={`Offboard Staff Member — ${profile.fullName}`}
        size="lg"
      >
        <div className="space-y-4">
          {offboardError && (
            <div className="p-3 bg-semantic-money-owed/10 border border-semantic-money-owed/20 rounded-xl text-semantic-money-owed text-xs font-medium">
              {offboardError}
            </div>
          )}

          {/* Academic Reassignment Warning */}
          {offboardWarning && (
            <div className="p-4 bg-semantic-attention/10 border border-semantic-attention/20 rounded-xl space-y-2 text-xs text-foreground">
              <div className="font-semibold text-sm flex items-center gap-1.5 text-semantic-attention">
                <AlertTriangle className="w-4 h-4" />
                Active Academic Assignments Detected
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
                    className="rounded text-primary focus:ring-primary"
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
              <label className="block text-xs font-semibold text-foreground mb-1">
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
                className="w-full px-3 py-2 border rounded-xl text-xs bg-muted/40 border-border/40 text-foreground"
              >
                <option value="RESIGNATION" className="bg-card">Resignation</option>
                <option value="TERMINATION" className="bg-card">Termination</option>
                <option value="RETIREMENT" className="bg-card">Retirement</option>
                <option value="OTHER" className="bg-card">Other Separation</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
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
                className="w-full px-3 py-2 border rounded-xl text-xs bg-muted/40 border-border/40 text-foreground"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
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
                className="w-full px-3 py-2 border rounded-xl text-xs bg-muted/40 border-border/40 text-foreground"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-border/40">
              <button
                type="button"
                onClick={() => {
                  setShowOffboardModal(false);
                  setOffboardWarning(null);
                }}
                className="px-4 py-2 text-xs rounded-xl border border-border/40 text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={offboardLoading}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition disabled:opacity-50"
              >
                {offboardLoading ? "Processing..." : "Complete Offboarding"}
              </button>
            </div>
          </form>
        </div>
      </AppModal>

      {/* ─── GOVERNED MODAL: CONFIRM PROBATION ──────────────────────────────────── */}
      <AppModal
        open={showConfirmProbationDialog}
        onClose={() => setShowConfirmProbationDialog(false)}
        title="Confirm Permanent Employment"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Are you sure you want to confirm permanent employment for{" "}
            <strong className="text-foreground">{profile.fullName}</strong>?
            This will transition their contract status from Probation to Permanent and record the confirmation milestone on their permanent personnel file.
          </p>
          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/40">
            <button
              type="button"
              onClick={() => setShowConfirmProbationDialog(false)}
              className="px-4 py-2 text-xs rounded-xl border border-border/40 text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmProbationAction}
              disabled={confirmLoading}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
            >
              {confirmLoading ? "Confirming..." : "Confirm Permanent Status"}
            </button>
          </div>
        </div>
      </AppModal>

      {/* ─── GOVERNED MODAL: LEGAL HOLD ────────────────────────────────────────── */}
      <AppModal
        open={showLegalHoldDialog}
        onClose={() => setShowLegalHoldDialog(false)}
        title={profile.legalHold ? "Remove Legal Hold" : "Apply Legal Hold"}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {profile.legalHold
              ? `Remove LEGAL HOLD from ${profile.fullName}? This will restore normal separation and lifecycle modification workflows.`
              : `Apply LEGAL HOLD on ${profile.fullName}? This locks the staff profile, preventing separation, record archiving, or destructive modifications for regulatory compliance.`}
          </p>
          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/40">
            <button
              type="button"
              onClick={() => setShowLegalHoldDialog(false)}
              className="px-4 py-2 text-xs rounded-xl border border-border/40 text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleToggleLegalHoldAction}
              disabled={legalHoldLoading}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
            >
              {legalHoldLoading
                ? "Updating..."
                : profile.legalHold
                  ? "Remove Hold"
                  : "Apply Legal Hold"}
            </button>
          </div>
        </div>
      </AppModal>

      {/* ─── GOVERNED MODAL: REACTIVATE STAFF ──────────────────────────────────── */}
      <AppModal
        open={showReactivateDialog}
        onClose={() => setShowReactivateDialog(false)}
        title="Reactivate Staff Member"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Reactivate <strong className="text-foreground">{profile.fullName}</strong> and restore their active duty standing and login account access?
          </p>
          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/40">
            <button
              type="button"
              onClick={() => setShowReactivateDialog(false)}
              className="px-4 py-2 text-xs rounded-xl border border-border/40 text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReactivateAction}
              disabled={reactivateLoading}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
            >
              {reactivateLoading ? "Reactivating..." : "Reactivate Staff"}
            </button>
          </div>
        </div>
      </AppModal>
    </div>
  );
}

export default Staff360Client;
