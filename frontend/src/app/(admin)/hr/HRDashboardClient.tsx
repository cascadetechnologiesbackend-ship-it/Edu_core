"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Briefcase,
  CalendarDays,
  FileText,
  DollarSign,
  PlusCircle,
  Eye,
  Lock,
  Calendar,
  Upload,
  ClipboardList,
  Building2,
  Award,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Edit,
  UserX,
  ShieldCheck,
  Archive,
  Trash2,
  ExternalLink,
} from "lucide-react";
import {
  createStaff,
  updateStaff,
  confirmStaffProbation,
  offboardStaff,
  createDepartment,
  updateDepartment,
  archiveDepartment,
  deleteDepartment,
  createDesignation,
  updateDesignation,
  archiveDesignation,
  deleteDesignation,
  createLeaveRequest,
  approveLeaveRequest,
  createSalaryTemplate,
  associateSalaryTemplate,
  createStaffLoan,
  uploadStaffDocument,
  revealStaffPii,
  runPayrollForMonth,
  approveAndLockPayroll,
} from "./actions";

interface HRDashboardClientProps {
  session: any;
  activeYear: any;
  school: any;
  staffList: any[];
  departments: any[];
  designations: any[];
  leaveTypes: any[];
  leaveRequests: any[];
  salaryTemplates: any[];
  payrollRuns: any[];
}

export default function HRDashboardClient({
  session,
  activeYear,
  school,
  staffList,
  departments,
  designations,
  leaveTypes,
  leaveRequests,
  salaryTemplates,
  payrollRuns,
}: HRDashboardClientProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<
    "staff" | "departments" | "designations" | "templates" | "leaves" | "payroll"
  >("staff");

  // State management for PII reveal
  const [revealedPii, setRevealedPii] = useState<
    Record<string, { pan?: string; bank?: string }>
  >({});

  // Loading/error states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Dialog open/close toggles
  const [openModal, setOpenModal] = useState<string | null>(null);

  // Search & Filter state for Staff
  const [staffSearchQuery, setStaffSearchQuery] = useState("");
  const [staffDeptFilter, setStaffDeptFilter] = useState("ALL");
  const [staffDesigFilter, setStaffDesigFilter] = useState("ALL");
  const [staffFacultyFilter, setStaffFacultyFilter] = useState<
    "ALL" | "TEACHING" | "NON_TEACHING"
  >("ALL");
  const [staffStatusFilter, setStaffStatusFilter] = useState<
    "ALL" | "ACTIVE" | "PROBATION" | "SEPARATED" | "LEGAL_HOLD"
  >("ALL");

  // Search state for Departments & Designations
  const [deptSearchQuery, setDeptSearchQuery] = useState("");
  const [desigSearchQuery, setDesigSearchQuery] = useState("");

  // Master Data forms
  const [deptForm, setDeptForm] = useState<{ id?: string; name: string }>({
    name: "",
  });

  const [desigForm, setDesigForm] = useState<{
    id?: string;
    name: string;
    departmentId: string;
    isTeaching: boolean;
  }>({
    name: "",
    departmentId: "",
    isTeaching: false,
  });

  // Staff creation form
  const [staffForm, setStaffForm] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "1990-01-01",
    gender: "MALE",
    mobile: "",
    email: "",
    address: "",
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

  // Staff edit form
  const [editStaffTarget, setEditStaffTarget] = useState<any>(null);
  const [editStaffForm, setEditStaffForm] = useState({
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

  // Staff offboard form
  const [offboardStaffTarget, setOffboardStaffTarget] = useState<any>(null);
  const [offboardData, setOffboardData] = useState({
    separationType: "RESIGNATION" as
      | "RESIGNATION"
      | "TERMINATION"
      | "RETIREMENT"
      | "OTHER",
    relievingDate: new Date().toISOString().slice(0, 10),
    separationReason: "",
    forceReassign: false,
  });
  const [offboardWarning, setOffboardWarning] = useState<any>(null);

  // Other HR forms
  const [templateForm, setTemplateForm] = useState({
    name: "",
    basicPercent: 50,
    daPercent: 10,
    hraPercent: 20,
    esiApplicable: true,
    pfEmployeePercent: 12,
    pfEmployerPercent: 12,
    professionalTaxState: "KARNATAKA",
  });

  const [associationForm, setAssociationForm] = useState({
    staffId: "",
    templateId: "",
    baseGrossSalary: 45000,
    monthlyTds: 1200,
  });

  const [leaveForm, setLeaveForm] = useState({
    staffId: "",
    leaveTypeId: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    totalDays: 1,
    reason: "",
  });

  const [loanForm, setLoanForm] = useState({
    staffId: "",
    principalAmount: 50000,
    emiAmount: 5000,
  });

  const [docForm, setDocForm] = useState({
    staffId: "",
    documentType: "APPOINTMENT_LETTER",
    fileName: "",
    fileS3Key: "",
  });

  const [payrollMonth, setPayrollMonth] = useState("2025-06");

  // Authorization checks
  const isAuthorizedHR =
    session?.user?.role === "HR_MANAGER" ||
    session?.user?.role === "SUPER_ADMIN" ||
    session?.user?.role === "SCHOOL_ADMIN";
  const isAuthorizedLock =
    session?.user?.role === "PRINCIPAL" ||
    session?.user?.role === "SUPER_ADMIN" ||
    session?.user?.role === "SCHOOL_ADMIN";

  // Selected designation in create form for UI feedback
  const selectedCreateDesig = designations.find(
    (d) => d.id === staffForm.designationId,
  );

  // Filtered staff list calculation
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      // 1. Search Query
      if (staffSearchQuery.trim()) {
        const query = staffSearchQuery.toLowerCase().trim();
        const fName = (s.firstName || "").toLowerCase();
        const lName = (s.lastName || "").toLowerCase();
        const fullName = `${fName} ${lName}`.trim();
        const empCode = (s.employeeCode || "").toLowerCase();
        const email = (s.email || "").toLowerCase();
        const mobile = (s.mobile || "").toLowerCase();
        if (
          !fullName.includes(query) &&
          !empCode.includes(query) &&
          !email.includes(query) &&
          !mobile.includes(query)
        ) {
          return false;
        }
      }

      // 2. Department Filter
      if (staffDeptFilter !== "ALL" && s.departmentId !== staffDeptFilter) {
        return false;
      }

      // 3. Designation Filter
      if (staffDesigFilter !== "ALL" && s.designationId !== staffDesigFilter) {
        return false;
      }

      // 4. Faculty Filter
      const isTeaching = Boolean(s.designation?.isTeaching);
      if (staffFacultyFilter === "TEACHING" && !isTeaching) return false;
      if (staffFacultyFilter === "NON_TEACHING" && isTeaching) return false;

      // 5. Status Filter
      if (staffStatusFilter === "ACTIVE" && !s.isActive) return false;
      if (staffStatusFilter === "SEPARATED" && s.isActive) return false;
      if (staffStatusFilter === "PROBATION" && s.contractType !== "PROBATION")
        return false;
      if (staffStatusFilter === "LEGAL_HOLD" && !s.legalHold) return false;

      return true;
    });
  }, [
    staffList,
    staffSearchQuery,
    staffDeptFilter,
    staffDesigFilter,
    staffFacultyFilter,
    staffStatusFilter,
  ]);

  // Filtered departments
  const filteredDepartments = useMemo(() => {
    if (!deptSearchQuery.trim()) return departments;
    const q = deptSearchQuery.toLowerCase().trim();
    return departments.filter((d) => d.name.toLowerCase().includes(q));
  }, [departments, deptSearchQuery]);

  // Filtered designations
  const filteredDesignations = useMemo(() => {
    if (!desigSearchQuery.trim()) return designations;
    const q = desigSearchQuery.toLowerCase().trim();
    return designations.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.department?.name && d.department.name.toLowerCase().includes(q)),
    );
  }, [designations, desigSearchQuery]);

  // Handlers for Staff
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
      alert(res.message || "Failed to reveal PII information");
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    const res = await createStaff(staffForm);
    setLoading(false);
    if (res.success) {
      setSuccessMsg("Staff member added successfully!");
      setOpenModal(null);
      router.refresh();
    } else {
      setErrorMsg(res.message || "Failed to create staff profile");
    }
  };

  const handleEditStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStaffTarget) return;
    setLoading(true);
    setErrorMsg("");
    const res = await updateStaff(editStaffTarget.id, editStaffForm);
    setLoading(false);
    if (res.success) {
      setSuccessMsg("Staff profile updated successfully!");
      setOpenModal(null);
      setEditStaffTarget(null);
      router.refresh();
    } else {
      setErrorMsg(res.message || "Failed to update staff profile");
    }
  };

  const handleOffboardStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offboardStaffTarget) return;
    setLoading(true);
    setErrorMsg("");
    const res = await offboardStaff(offboardStaffTarget.id, offboardData);
    setLoading(false);
    if (!res.success) {
      if (res.requiresReassignment) {
        setOffboardWarning(res);
      } else {
        setErrorMsg(res.message || "Offboarding failed");
      }
    } else {
      setSuccessMsg("Staff member offboarded successfully.");
      setOpenModal(null);
      setOffboardStaffTarget(null);
      setOffboardWarning(null);
      router.refresh();
    }
  };

  // Handlers for Departments
  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    const res = await createDepartment(deptForm.name);
    setLoading(false);
    if (res.success) {
      setSuccessMsg(`Department "${deptForm.name}" created successfully!`);
      setDeptForm({ name: "" });
      setOpenModal(null);
      router.refresh();
    } else {
      setErrorMsg(res.message || "Failed to create department");
    }
  };

  const handleUpdateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptForm.id) return;
    setLoading(true);
    setErrorMsg("");
    const res = await updateDepartment(deptForm.id, deptForm.name);
    setLoading(false);
    if (res.success) {
      setSuccessMsg("Department renamed successfully!");
      setDeptForm({ name: "" });
      setOpenModal(null);
      router.refresh();
    } else {
      setErrorMsg(res.message || "Failed to update department");
    }
  };

  const handleArchiveDept = async (id: string, currentlyActive: boolean) => {
    const actionName = currentlyActive ? "archive" : "activate";
    if (!confirm(`Are you sure you want to ${actionName} this department?`))
      return;
    setLoading(true);
    setErrorMsg("");
    const res = await archiveDepartment(id, currentlyActive);
    setLoading(false);
    if (res.success) {
      setSuccessMsg(
        `Department ${currentlyActive ? "archived" : "activated"} successfully!`,
      );
      router.refresh();
    } else {
      setErrorMsg(res.message || "Failed to change department archive status");
    }
  };

  const handleDeleteDept = async (id: string, name: string) => {
    if (
      !confirm(
        `Permanently delete department "${name}"? This is only allowed if no staff or designations are linked.`,
      )
    )
      return;
    setLoading(true);
    setErrorMsg("");
    const res = await deleteDepartment(id);
    setLoading(false);
    if (res.success) {
      setSuccessMsg(`Department "${name}" deleted.`);
      router.refresh();
    } else {
      setErrorMsg(res.message || "Failed to delete department");
    }
  };

  // Handlers for Designations
  const handleCreateDesig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    const res = await createDesignation(
      desigForm.name,
      desigForm.departmentId || undefined,
      desigForm.isTeaching,
    );
    setLoading(false);
    if (res.success) {
      setSuccessMsg(`Designation "${desigForm.name}" created successfully!`);
      setDesigForm({ name: "", departmentId: "", isTeaching: false });
      setOpenModal(null);
      router.refresh();
    } else {
      setErrorMsg(res.message || "Failed to create designation");
    }
  };

  const handleUpdateDesig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desigForm.id) return;
    setLoading(true);
    setErrorMsg("");
    const res = await updateDesignation(desigForm.id, {
      name: desigForm.name,
      departmentId: desigForm.departmentId || undefined,
      isTeaching: desigForm.isTeaching,
    });
    setLoading(false);
    if (res.success) {
      setSuccessMsg("Designation updated successfully!");
      setDesigForm({ name: "", departmentId: "", isTeaching: false });
      setOpenModal(null);
      router.refresh();
    } else {
      setErrorMsg(res.message || "Failed to update designation");
    }
  };

  const handleArchiveDesig = async (id: string, currentlyActive: boolean) => {
    const actionName = currentlyActive ? "archive" : "activate";
    if (!confirm(`Are you sure you want to ${actionName} this designation?`))
      return;
    setLoading(true);
    setErrorMsg("");
    const res = await archiveDesignation(id, currentlyActive);
    setLoading(false);
    if (res.success) {
      setSuccessMsg(
        `Designation ${currentlyActive ? "archived" : "activated"} successfully!`,
      );
      router.refresh();
    } else {
      setErrorMsg(res.message || "Failed to change designation archive status");
    }
  };

  const handleDeleteDesig = async (id: string, name: string) => {
    if (
      !confirm(
        `Permanently delete designation "${name}"? This is only allowed if no staff are assigned.`,
      )
    )
      return;
    setLoading(true);
    setErrorMsg("");
    const res = await deleteDesignation(id);
    setLoading(false);
    if (res.success) {
      setSuccessMsg(`Designation "${name}" deleted.`);
      router.refresh();
    } else {
      setErrorMsg(res.message || "Failed to delete designation");
    }
  };

  // Other Handlers
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    const res = await createSalaryTemplate({
      ...templateForm,
      otherAllowances: [],
    });
    setLoading(false);
    if (res.success) {
      setSuccessMsg("Salary template created!");
      setOpenModal(null);
      router.refresh();
    } else {
      setErrorMsg(res.message || "Failed to create template");
    }
  };

  const handleAssociateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    const res = await associateSalaryTemplate(
      associationForm.staffId,
      associationForm.templateId,
      associationForm.baseGrossSalary,
      associationForm.monthlyTds,
    );
    setLoading(false);
    if (res.success) {
      setSuccessMsg("Salary presets associated with staff successfully!");
      setOpenModal(null);
      router.refresh();
    } else {
      setErrorMsg(res.message || "Failed to associate template");
    }
  };

  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    const res = await createLeaveRequest(leaveForm);
    setLoading(false);
    if (res.success) {
      setSuccessMsg("Leave application submitted successfully!");
      setOpenModal(null);
      router.refresh();
    } else {
      setErrorMsg(res.message || "Failed to submit leave request");
    }
  };

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    const res = await createStaffLoan(loanForm);
    setLoading(false);
    if (res.success) {
      setSuccessMsg("Loan record created successfully!");
      setOpenModal(null);
      router.refresh();
    } else {
      setErrorMsg(res.message || "Failed to create loan record");
    }
  };

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    const res = await uploadStaffDocument(docForm);
    setLoading(false);
    if (res.success) {
      setSuccessMsg("Document registered in staff vault!");
      setOpenModal(null);
      router.refresh();
    } else {
      setErrorMsg(res.message || "Failed to register document");
    }
  };

  const handleRunPayroll = async () => {
    setLoading(true);
    setErrorMsg("");
    const res = await runPayrollForMonth(payrollMonth);
    setLoading(false);
    if (res.success) {
      setSuccessMsg("Monthly payroll draft run completed successfully!");
      router.refresh();
    } else {
      setErrorMsg(res.message || "Failed to run payroll");
    }
  };

  const handleLockPayroll = async (runId: string) => {
    if (
      !confirm(
        "Are you sure you want to approve and lock this payroll? This updates staff remaining loan balances and generates statutory ECR records.",
      )
    )
      return;
    setLoading(true);
    setErrorMsg("");
    const res = await approveAndLockPayroll(runId);
    setLoading(false);
    if (res.success) {
      setSuccessMsg("Payroll approved and locked by Principal!");
      router.refresh();
    } else {
      setErrorMsg(res.message || "Failed to lock payroll");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-600" />
            Human Resources & Staff Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {school?.name || "SchoolMitra ERP"} —{" "}
            {activeYear?.label
              ? `Academic Year ${activeYear.label}`
              : "Configuration Portal"}
          </p>
        </div>
        <div className="flex gap-2">
          {isAuthorizedHR && (
            <button
              onClick={() => {
                setStaffForm({
                  firstName: "",
                  lastName: "",
                  dateOfBirth: "1990-01-01",
                  gender: "MALE",
                  mobile: "",
                  email: "",
                  address: "",
                  emergencyContact: "",
                  employeeCode: "",
                  departmentId: departments[0]?.id || "",
                  designationId: designations[0]?.id || "",
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
                setOpenModal("createStaff");
                setErrorMsg("");
                setSuccessMsg("");
              }}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-md"
            >
              <PlusCircle className="w-4 h-4" />
              Onboard Staff
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 rounded-xl text-sm flex items-center justify-between">
          <span>{successMsg}</span>
          <button
            onClick={() => setSuccessMsg("")}
            className="font-bold text-xs hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-xl text-sm flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg("")}
            className="font-bold text-xs hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab("staff")}
          className={`pb-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "staff"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Staff Directory ({staffList.length})
        </button>

        <button
          onClick={() => setActiveTab("departments")}
          className={`pb-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "departments"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Building2 className="w-4 h-4" />
          Departments ({departments.length})
        </button>

        <button
          onClick={() => setActiveTab("designations")}
          className={`pb-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "designations"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Award className="w-4 h-4" />
          Designations ({designations.length})
        </button>

        <button
          onClick={() => setActiveTab("templates")}
          className={`pb-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "templates"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Salary Templates
        </button>

        <button
          onClick={() => setActiveTab("leaves")}
          className={`pb-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "leaves"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          Leave Approvals
        </button>

        <button
          onClick={() => setActiveTab("payroll")}
          className={`pb-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "payroll"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Monthly Payroll Run
        </button>
      </div>

      {/* ─── TAB 1: STAFF DIRECTORY & 360 ───────────────────────────────────────── */}
      {activeTab === "staff" && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-slate-900 dark:to-indigo-950/20 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase">
                Total Staff
              </span>
              <p className="text-3xl font-extrabold mt-1 text-slate-850 dark:text-white">
                {staffList.length}
              </p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-slate-900 dark:to-emerald-950/20 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase">
                Active Staff
              </span>
              <p className="text-3xl font-extrabold mt-1 text-emerald-600 dark:text-emerald-400">
                {staffList.filter((s) => s.isActive).length}
              </p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-slate-900 dark:to-amber-950/20 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase">
                On Probation
              </span>
              <p className="text-3xl font-extrabold mt-1 text-amber-600 dark:text-amber-400">
                {staffList.filter((s) => s.contractType === "PROBATION" && s.isActive).length}
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-slate-900 dark:to-purple-950/20 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase">
                Teaching Faculty
              </span>
              <p className="text-3xl font-extrabold mt-1 text-purple-600 dark:text-purple-400">
                {staffList.filter((s) => s.designation?.isTeaching && s.isActive).length}
              </p>
            </div>
          </div>

          {/* Probation Confirmation Reminders (if any) */}
          {staffList.filter((s) => {
            if (s.contractType !== "PROBATION" || !s.isActive) return false;
            const elapsed = Date.now() - new Date(s.joiningDate).getTime();
            return elapsed >= 90 * 24 * 60 * 60 * 1000;
          }).length > 0 && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-250 dark:border-amber-900 rounded-2xl space-y-2">
              <span className="font-bold text-sm text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block animate-pulse" />
                Probation Confirmation Reminders (90+ Days)
              </span>
              <div className="flex flex-col gap-2">
                {staffList
                  .filter((s) => {
                    if (s.contractType !== "PROBATION" || !s.isActive) return false;
                    const elapsed = Date.now() - new Date(s.joiningDate).getTime();
                    return elapsed >= 90 * 24 * 60 * 60 * 1000;
                  })
                  .map((s) => (
                    <div
                      key={s.id}
                      className="flex justify-between items-center bg-white/60 dark:bg-slate-900/60 p-3 rounded-xl border border-amber-200/50"
                    >
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {s.employeeCode} — {s.firstName} {s.lastName} (Joined:{" "}
                        {new Date(s.joiningDate).toLocaleDateString()})
                      </span>
                      {isAuthorizedHR && (
                        <button
                          onClick={async () => {
                            if (
                              confirm(
                                `Confirm probation completion for ${s.firstName} ${s.lastName}?`,
                              )
                            ) {
                              await confirmStaffProbation(s.id);
                              router.refresh();
                            }
                          }}
                          className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider"
                        >
                          Confirm Permanent
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Search-First Filter Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search staff by name, employee code, email, mobile..."
                  value={staffSearchQuery}
                  onChange={(e) => setStaffSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <select
                value={staffDeptFilter}
                onChange={(e) => setStaffDeptFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 focus:outline-none focus:border-indigo-600"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <select
                value={staffDesigFilter}
                onChange={(e) => setStaffDesigFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 focus:outline-none focus:border-indigo-600"
              >
                <option value="ALL">All Designations</option>
                {designations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <select
                value={staffFacultyFilter}
                onChange={(e) => setStaffFacultyFilter(e.target.value as any)}
                className="px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 focus:outline-none focus:border-indigo-600"
              >
                <option value="ALL">All Faculty Types</option>
                <option value="TEACHING">Teaching Faculty Only</option>
                <option value="NON_TEACHING">Non-Teaching Only</option>
              </select>

              <select
                value={staffStatusFilter}
                onChange={(e) => setStaffStatusFilter(e.target.value as any)}
                className="px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 focus:outline-none focus:border-indigo-600"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Staff</option>
                <option value="PROBATION">On Probation</option>
                <option value="SEPARATED">Separated / Inactive</option>
                <option value="LEGAL_HOLD">Legal Hold Active</option>
              </select>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
              <span>
                Showing {filteredStaff.length} of {staffList.length} staff members
              </span>
              {(staffSearchQuery ||
                staffDeptFilter !== "ALL" ||
                staffDesigFilter !== "ALL" ||
                staffFacultyFilter !== "ALL" ||
                staffStatusFilter !== "ALL") && (
                <button
                  onClick={() => {
                    setStaffSearchQuery("");
                    setStaffDeptFilter("ALL");
                    setStaffDesigFilter("ALL");
                    setStaffFacultyFilter("ALL");
                    setStaffStatusFilter("ALL");
                  }}
                  className="text-indigo-600 hover:underline font-medium"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>

          {/* Staff Directory Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/40">
              <h3 className="font-semibold text-slate-800 dark:text-white">
                Staff Records
              </h3>
              <div className="flex gap-2">
                {isAuthorizedHR && (
                  <>
                    <button
                      onClick={() => setOpenModal("associateTemplate")}
                      className="bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1"
                    >
                      Salary Components
                    </button>
                    <button
                      onClick={() => setOpenModal("createLoan")}
                      className="bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1"
                    >
                      Record Loan
                    </button>
                  </>
                )}
              </div>
            </div>

            {filteredStaff.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                No staff members match the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/10 text-slate-400 font-semibold uppercase text-xs">
                      <th className="p-4">Code</th>
                      <th className="p-4">Staff Name & Contact</th>
                      <th className="p-4">Dept / Desig</th>
                      <th className="p-4">Classification</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Statutory PII</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredStaff.map((s) => {
                      const revealed = revealedPii[s.id] || {};
                      const departmentName = s.department?.name || "—";
                      const designationName = s.designation?.name || "—";
                      const isTeaching = Boolean(s.designation?.isTeaching);

                      return (
                        <tr
                          key={s.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="p-4 font-mono font-medium text-indigo-600 dark:text-indigo-400">
                            <Link
                              href={`/hr/staff/${s.id}`}
                              className="hover:underline flex items-center gap-1"
                            >
                              {s.employeeCode}
                            </Link>
                          </td>
                          <td className="p-4">
                            <Link
                              href={`/hr/staff/${s.id}`}
                              className="font-semibold text-slate-800 dark:text-white hover:text-indigo-600 transition-colors block"
                            >
                              {s.firstName} {s.lastName}
                            </Link>
                            <div className="text-xs text-slate-400">
                              {s.email} • {s.mobile || "No Mobile"}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="font-medium text-slate-800 dark:text-slate-200">
                              {departmentName}
                            </div>
                            <div className="text-xs text-slate-400">
                              {designationName}
                            </div>
                          </td>
                          <td className="p-4">
                            {isTeaching ? (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                Teaching
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                Non-Teaching
                              </span>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1 items-start">
                              {s.legalHold && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300">
                                  🔒 Legal Hold
                                </span>
                              )}
                              {s.isActive ? (
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                    s.contractType === "PROBATION"
                                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                                  }`}
                                >
                                  {s.contractType}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
                                  Separated ({s.separationType || "Inactive"})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 space-y-1">
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="text-slate-400">PAN:</span>
                              {revealed.pan ? (
                                <span className="font-mono text-slate-700 dark:text-slate-300">
                                  {revealed.pan}
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleReveal(s.id, "pan")}
                                  className="text-indigo-600 hover:underline flex items-center gap-0.5 text-[11px]"
                                  title="Audited under DPDP rules"
                                >
                                  <Eye className="w-3 h-3" /> Reveal
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="text-slate-400">Bank:</span>
                              {revealed.bank ? (
                                <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px]">
                                  {revealed.bank}
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleReveal(s.id, "bank")}
                                  className="text-indigo-600 hover:underline flex items-center gap-0.5 text-[11px]"
                                  title="Audited under DPDP rules"
                                >
                                  <Eye className="w-3 h-3" /> Reveal
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link
                                href={`/hr/staff/${s.id}`}
                                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition"
                              >
                                View 360
                              </Link>

                              {isAuthorizedHR && (
                                <button
                                  onClick={() => {
                                    setEditStaffTarget(s);
                                    setEditStaffForm({
                                      firstName: s.firstName || "",
                                      lastName: s.lastName || "",
                                      mobile: s.mobile || "",
                                      email: s.email || "",
                                      address: s.address || "",
                                      emergencyContact:
                                        s.emergencyContact || "",
                                      departmentId: s.departmentId || "",
                                      designationId: s.designationId || "",
                                      contractType:
                                        s.contractType || "PERMANENT",
                                      joiningDate: s.joiningDate
                                        ? new Date(s.joiningDate)
                                            .toISOString()
                                            .slice(0, 10)
                                        : "",
                                      qualification: s.qualification || "",
                                      experience: s.experience || "",
                                    });
                                    setOpenModal("editStaff");
                                  }}
                                  className="p-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                                  title="Edit Staff Profile"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              )}

                              {isAuthorizedHR && s.isActive && (
                                <button
                                  onClick={() => {
                                    setOffboardStaffTarget(s);
                                    setOffboardData({
                                      separationType: "RESIGNATION",
                                      relievingDate: new Date()
                                        .toISOString()
                                        .slice(0, 10),
                                      separationReason: "",
                                      forceReassign: false,
                                    });
                                    setOffboardWarning(null);
                                    setOpenModal("offboardStaff");
                                  }}
                                  className="p-1 text-rose-500 hover:text-rose-700"
                                  title="Offboard / Separation"
                                >
                                  <UserX className="w-4 h-4" />
                                </button>
                              )}

                              {isAuthorizedHR &&
                                s.contractType === "PROBATION" &&
                                s.isActive && (
                                  <button
                                    onClick={async () => {
                                      if (
                                        confirm(
                                          `Confirm permanent status for ${s.firstName} ${s.lastName}?`,
                                        )
                                      ) {
                                        await confirmStaffProbation(s.id);
                                        router.refresh();
                                      }
                                    }}
                                    className="px-2 py-1 text-[11px] font-semibold rounded bg-amber-50 text-amber-700 hover:bg-amber-100"
                                    title="Confirm Probation"
                                  >
                                    Confirm
                                  </button>
                                )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: MASTER DATA — DEPARTMENTS ──────────────────────────────────── */}
      {activeTab === "departments" && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search departments..."
                value={deptSearchQuery}
                onChange={(e) => setDeptSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 focus:outline-none focus:border-indigo-600"
              />
            </div>
            {isAuthorizedHR && (
              <button
                onClick={() => {
                  setDeptForm({ name: "" });
                  setOpenModal("createDept");
                }}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-md"
              >
                <PlusCircle className="w-4 h-4" />
                Add Department
              </button>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
              <h3 className="font-semibold text-slate-800 dark:text-white">
                School Departments ({filteredDepartments.length})
              </h3>
            </div>

            {filteredDepartments.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                No departments found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/10 text-slate-400 font-semibold uppercase text-xs">
                      <th className="p-4">Department Name</th>
                      <th className="p-4">Assigned Staff</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredDepartments.map((d) => {
                      const staffCount = d.staff?.length ?? 0;
                      return (
                        <tr
                          key={d.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/30"
                        >
                          <td className="p-4 font-semibold text-slate-800 dark:text-white">
                            {d.name}
                          </td>
                          <td className="p-4 text-slate-600 dark:text-slate-400">
                            {staffCount} staff member(s)
                          </td>
                          <td className="p-4">
                            {d.isActive ? (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                Active
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                Archived
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            {isAuthorizedHR && (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setDeptForm({ id: d.id, name: d.name });
                                    setOpenModal("editDept");
                                  }}
                                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                                >
                                  Rename
                                </button>
                                <button
                                  onClick={() =>
                                    handleArchiveDept(d.id, d.isActive)
                                  }
                                  className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                                    d.isActive
                                      ? "border-amber-300 text-amber-700 hover:bg-amber-50"
                                      : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                  }`}
                                >
                                  {d.isActive ? "Archive" : "Activate"}
                                </button>
                                <button
                                  onClick={() => handleDeleteDept(d.id, d.name)}
                                  disabled={staffCount > 0}
                                  className="p-1 text-rose-500 hover:text-rose-700 disabled:opacity-30 disabled:cursor-not-allowed"
                                  title={
                                    staffCount > 0
                                      ? "Cannot delete: staff assigned"
                                      : "Delete Department"
                                  }
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
        </div>
      )}

      {/* ─── TAB 3: MASTER DATA — DESIGNATIONS ─────────────────────────────────── */}
      {activeTab === "designations" && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search designations..."
                value={desigSearchQuery}
                onChange={(e) => setDesigSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 focus:outline-none focus:border-indigo-600"
              />
            </div>
            {isAuthorizedHR && (
              <button
                onClick={() => {
                  setDesigForm({
                    name: "",
                    departmentId: departments[0]?.id || "",
                    isTeaching: false,
                  });
                  setOpenModal("createDesig");
                }}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-md"
              >
                <PlusCircle className="w-4 h-4" />
                Add Designation
              </button>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
              <h3 className="font-semibold text-slate-800 dark:text-white">
                School Designations ({filteredDesignations.length})
              </h3>
            </div>

            {filteredDesignations.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                No designations found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/10 text-slate-400 font-semibold uppercase text-xs">
                      <th className="p-4">Designation Name</th>
                      <th className="p-4">Department</th>
                      <th className="p-4">Classification</th>
                      <th className="p-4">Assigned Staff</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredDesignations.map((d) => {
                      const staffCount = d.staff?.length ?? 0;
                      return (
                        <tr
                          key={d.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/30"
                        >
                          <td className="p-4 font-semibold text-slate-800 dark:text-white">
                            {d.name}
                          </td>
                          <td className="p-4 text-slate-600 dark:text-slate-400">
                            {d.department?.name || "All Departments"}
                          </td>
                          <td className="p-4">
                            {d.isTeaching ? (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                Teaching Faculty
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                Non-Teaching
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-slate-600 dark:text-slate-400">
                            {staffCount} staff member(s)
                          </td>
                          <td className="p-4">
                            {d.isActive ? (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                Active
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                Archived
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            {isAuthorizedHR && (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setDesigForm({
                                      id: d.id,
                                      name: d.name,
                                      departmentId: d.departmentId || "",
                                      isTeaching: Boolean(d.isTeaching),
                                    });
                                    setOpenModal("editDesig");
                                  }}
                                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() =>
                                    handleArchiveDesig(d.id, d.isActive)
                                  }
                                  className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                                    d.isActive
                                      ? "border-amber-300 text-amber-700 hover:bg-amber-50"
                                      : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                  }`}
                                >
                                  {d.isActive ? "Archive" : "Activate"}
                                </button>
                                <button
                                  onClick={() => handleDeleteDesig(d.id, d.name)}
                                  disabled={staffCount > 0}
                                  className="p-1 text-rose-500 hover:text-rose-700 disabled:opacity-30 disabled:cursor-not-allowed"
                                  title={
                                    staffCount > 0
                                      ? "Cannot delete: staff assigned"
                                      : "Delete Designation"
                                  }
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
        </div>
      )}

      {/* ─── TAB 4: SALARY TEMPLATES ───────────────────────────────────────────── */}
      {activeTab === "templates" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg text-slate-800 dark:text-white">
              Wage & Salary Templates
            </h3>
            {isAuthorizedHR && (
              <button
                onClick={() => setOpenModal("createTemplate")}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-xl"
              >
                Create New Template
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {salaryTemplates.map((t) => (
              <div
                key={t.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4"
              >
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-slate-800 dark:text-white">
                    {t.name}
                  </h4>
                  <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-mono">
                    PT: {t.professionalTaxState}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <div>
                    Basic Salary:{" "}
                    <span className="font-semibold text-slate-800 dark:text-white">
                      {t.basicPercent}%
                    </span>
                  </div>
                  <div>
                    DA Component:{" "}
                    <span className="font-semibold text-slate-800 dark:text-white">
                      {t.daPercent}%
                    </span>
                  </div>
                  <div>
                    HRA Component:{" "}
                    <span className="font-semibold text-slate-800 dark:text-white">
                      {t.hraPercent}%
                    </span>
                  </div>
                  <div>
                    ESI Eligible:{" "}
                    <span className="font-semibold text-slate-800 dark:text-white">
                      {t.esiApplicable ? "Yes" : "No"}
                    </span>
                  </div>
                  <div>
                    PF Employee:{" "}
                    <span className="font-semibold text-slate-800 dark:text-white">
                      {t.pfEmployeePercent}%
                    </span>
                  </div>
                  <div>
                    PF Employer:{" "}
                    <span className="font-semibold text-slate-800 dark:text-white">
                      {t.pfEmployerPercent}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 5: LEAVES ────────────────────────────────────────────────────── */}
      {activeTab === "leaves" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg text-slate-800 dark:text-white">
              Leave Approvals & Workflow
            </h3>
            <button
              onClick={() => setOpenModal("createLeave")}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-xl"
            >
              Apply For Leave
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
              <h4 className="font-bold text-sm text-slate-800 dark:text-white">
                Pending Leave Applications
              </h4>
            </div>

            {leaveRequests.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                No leave applications submitted.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {leaveRequests.map((r) => (
                  <div
                    key={r.id}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 dark:text-white">
                          {r.staff?.employeeCode} — {r.staff?.firstName}{" "}
                          {r.staff?.lastName}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600">
                          {r.leaveType?.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800"
                              : r.status === "REJECTED"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {r.startDate} to {r.endDate} ({r.totalDays} day(s)) •
                        Reason: {r.reason}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {r.status === "PENDING" && isAuthorizedHR && (
                        <button
                          onClick={async () => {
                            await approveLeaveRequest(r.id, "HR", true);
                            router.refresh();
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow"
                        >
                          Approve
                        </button>
                      )}
                      {r.status === "PENDING" && isAuthorizedHR && (
                        <button
                          onClick={async () => {
                            const reason = prompt("Enter rejection reason:");
                            if (reason !== null) {
                              await approveLeaveRequest(
                                r.id,
                                "HR",
                                false,
                                reason,
                              );
                              router.refresh();
                            }
                          }}
                          className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 6: PAYROLL ───────────────────────────────────────────────────── */}
      {activeTab === "payroll" && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-lg border border-indigo-850">
            <div className="space-y-2">
              <h3 className="text-lg font-bold flex items-center gap-1.5">
                <Calendar className="w-5 h-5 text-indigo-400" />
                Process Monthly Payroll Run
              </h3>
              <p className="text-xs text-indigo-200 max-w-xl">
                Calculates Basic, DA, HRA, statutory employee/employer PF,
                state-wise PT, ESI, loan EMI repayments, LWP attendance
                deductions, and generates ECR exports.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="YYYY-MM (e.g. 2025-06)"
                value={payrollMonth}
                onChange={(e) => setPayrollMonth(e.target.value)}
                className="bg-white/10 border border-white/20 px-3 py-2 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-indigo-400"
              />
              <button
                onClick={handleRunPayroll}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md transition-all"
              >
                Trigger Run
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
              <h4 className="font-bold text-sm text-slate-800 dark:text-white">
                Previous Payroll Runs
              </h4>
            </div>

            {payrollRuns.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                No payroll runs executed yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {payrollRuns.map((pr) => (
                  <div
                    key={pr.id}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="font-bold text-base text-slate-800 dark:text-white font-mono flex items-center gap-2">
                        {pr.month}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase ${
                            pr.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                          }`}
                        >
                          {pr.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 space-x-4">
                        <span>
                          Gross:{" "}
                          <strong className="text-slate-700 dark:text-slate-300">
                            ₹{pr.totalGross}
                          </strong>
                        </span>
                        <span>
                          Deductions:{" "}
                          <strong className="text-slate-700 dark:text-slate-300">
                            ₹{pr.totalDeductions}
                          </strong>
                        </span>
                        <span>
                          Net Paid:{" "}
                          <strong className="text-emerald-600 font-bold">
                            ₹{pr.totalNetPay}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {pr.status === "PROCESSED" && isAuthorizedLock && (
                        <button
                          onClick={() => handleLockPayroll(pr.id)}
                          className="bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          Lock Payroll & Deduct Loans
                        </button>
                      )}
                      {pr.status === "APPROVED" && (
                        <a
                          href={`/api/payroll/ecr?runId=${pr.id}`}
                          className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1 transition-all"
                        >
                          Download ECR File
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL: CREATE STAFF PROFILE ─────────────────────────────────────── */}
      {openModal === "createStaff" && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                  Onboard Staff Member
                </h3>
                <p className="text-xs text-slate-500">
                  Authoritative role assignment & encrypted statutory PII
                </p>
              </div>
              <button
                onClick={() => setOpenModal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={staffForm.firstName}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, firstName: e.target.value })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={staffForm.lastName}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, lastName: e.target.value })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Employee Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. EMP-101"
                    value={staffForm.employeeCode}
                    onChange={(e) =>
                      setStaffForm({
                        ...staffForm,
                        employeeCode: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Official Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="staff@school.org"
                    value={staffForm.email}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, email: e.target.value })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Mobile Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="9876543210"
                    value={staffForm.mobile}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, mobile: e.target.value })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Aadhaar Last 4 Digits *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    placeholder="1234"
                    value={staffForm.aadhaarLast4}
                    onChange={(e) =>
                      setStaffForm({
                        ...staffForm,
                        aadhaarLast4: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Department *
                  </label>
                  <select
                    required
                    value={staffForm.departmentId}
                    onChange={(e) =>
                      setStaffForm({
                        ...staffForm,
                        departmentId: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                  >
                    <option value="">Select Department</option>
                    {departments
                      .filter((d) => d.isActive)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Designation *
                  </label>
                  <select
                    required
                    value={staffForm.designationId}
                    onChange={(e) =>
                      setStaffForm({
                        ...staffForm,
                        designationId: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                  >
                    <option value="">Select Designation</option>
                    {designations
                      .filter((d) => d.isActive)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}{" "}
                          {d.isTeaching
                            ? "— Teaching Faculty"
                            : "— Non-Teaching"}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Authoritative Role Notification */}
              {selectedCreateDesig && (
                <div
                  className={`p-3 rounded-xl flex items-center gap-2 text-xs ${
                    selectedCreateDesig.isTeaching
                      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                      : "bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>
                    {selectedCreateDesig.isTeaching
                      ? "Authoritative Teaching Designation: Staff will be assigned the TEACHER role and participate in AMS teacher allocation."
                      : "Authoritative Non-Teaching Designation: Staff will NOT be granted academic privileges and will not appear in teacher selectors."}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Contract Type *
                  </label>
                  <select
                    value={staffForm.contractType}
                    onChange={(e) =>
                      setStaffForm({
                        ...staffForm,
                        contractType: e.target.value as any,
                      })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                  >
                    <option value="PROBATION">Probation</option>
                    <option value="PERMANENT">Permanent</option>
                    <option value="CONTRACTUAL">Contractual</option>
                    <option value="PART_TIME">Part Time</option>
                    <option value="GUEST_FACULTY">Guest Faculty</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Joining Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={staffForm.joiningDate}
                    onChange={(e) =>
                      setStaffForm({
                        ...staffForm,
                        joiningDate: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Gender *
                  </label>
                  <select
                    value={staffForm.gender}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, gender: e.target.value })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    PAN Number (Encrypted)
                  </label>
                  <input
                    type="text"
                    placeholder="ABCDE1234F"
                    value={staffForm.pan}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, pan: e.target.value })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm font-mono uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Emergency Contact
                  </label>
                  <input
                    type="text"
                    placeholder="Name & Contact"
                    value={staffForm.emergencyContact}
                    onChange={(e) =>
                      setStaffForm({
                        ...staffForm,
                        emergencyContact: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setOpenModal(null)}
                  className="px-4 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2 rounded-xl transition-all shadow"
                >
                  {loading ? "Onboarding..." : "Complete Staff Onboarding"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: EDIT STAFF PROFILE ────────────────────────────────────────── */}
      {openModal === "editStaff" && editStaffTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                Edit Staff Profile — {editStaffTarget.firstName}{" "}
                {editStaffTarget.lastName}
              </h3>
              <button
                onClick={() => setOpenModal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditStaffSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editStaffForm.firstName}
                    onChange={(e) =>
                      setEditStaffForm({
                        ...editStaffForm,
                        firstName: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editStaffForm.lastName}
                    onChange={(e) =>
                      setEditStaffForm({
                        ...editStaffForm,
                        lastName: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={editStaffForm.email}
                    onChange={(e) =>
                      setEditStaffForm({
                        ...editStaffForm,
                        email: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Mobile Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={editStaffForm.mobile}
                    onChange={(e) =>
                      setEditStaffForm({
                        ...editStaffForm,
                        mobile: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Department *
                  </label>
                  <select
                    value={editStaffForm.departmentId}
                    onChange={(e) =>
                      setEditStaffForm({
                        ...editStaffForm,
                        departmentId: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Designation *
                  </label>
                  <select
                    value={editStaffForm.designationId}
                    onChange={(e) =>
                      setEditStaffForm({
                        ...editStaffForm,
                        designationId: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                  >
                    {designations.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}{" "}
                        {d.isTeaching ? "(Teaching)" : "(Non-Teaching)"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setOpenModal(null)}
                  className="px-4 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2 rounded-xl transition-all shadow"
                >
                  {loading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: OFFBOARD STAFF ────────────────────────────────────────────── */}
      {openModal === "offboardStaff" && offboardStaffTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                Offboard Staff — {offboardStaffTarget.firstName}{" "}
                {offboardStaffTarget.lastName}
              </h3>
              <button
                onClick={() => setOpenModal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Academic Safety Warning */}
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
                      Safely unassign active classes and timetable periods. Historical attendance & assessments will remain intact.
                    </span>
                  </label>
                </div>
              </div>
            )}

            <form onSubmit={handleOffboardStaffSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
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
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                >
                  <option value="RESIGNATION">Resignation</option>
                  <option value="TERMINATION">Termination</option>
                  <option value="RETIREMENT">Retirement</option>
                  <option value="OTHER">Other Separation</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Relieving Date *
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
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Reason / Handover Remarks
                </label>
                <textarea
                  rows={3}
                  placeholder="Record formal exit reasons..."
                  value={offboardData.separationReason}
                  onChange={(e) =>
                    setOffboardData({
                      ...offboardData,
                      separationReason: e.target.value,
                    })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setOpenModal(null)}
                  className="px-4 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-6 py-2 rounded-xl transition-all shadow"
                >
                  {loading ? "Processing..." : "Complete Offboarding"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: CREATE DEPARTMENT ─────────────────────────────────────────── */}
      {openModal === "createDept" && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                Create Department
              </h3>
              <button
                onClick={() => setOpenModal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDept} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Department Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Science & Technology"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ name: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setOpenModal(null)}
                  className="px-4 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2 rounded-xl transition-all shadow"
                >
                  {loading ? "Creating..." : "Create Department"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: EDIT DEPARTMENT ───────────────────────────────────────────── */}
      {openModal === "editDept" && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                Rename Department
              </h3>
              <button
                onClick={() => setOpenModal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateDept} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Department Name *
                </label>
                <input
                  type="text"
                  required
                  value={deptForm.name}
                  onChange={(e) =>
                    setDeptForm({ ...deptForm, name: e.target.value })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setOpenModal(null)}
                  className="px-4 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2 rounded-xl transition-all shadow"
                >
                  {loading ? "Updating..." : "Save Name"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: CREATE DESIGNATION ────────────────────────────────────────── */}
      {openModal === "createDesig" && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                Create Designation
              </h3>
              <button
                onClick={() => setOpenModal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDesig} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Designation Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Secondary Teacher"
                  value={desigForm.name}
                  onChange={(e) =>
                    setDesigForm({ ...desigForm, name: e.target.value })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Department
                </label>
                <select
                  value={desigForm.departmentId}
                  onChange={(e) =>
                    setDesigForm({
                      ...desigForm,
                      departmentId: e.target.value,
                    })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                >
                  <option value="">All / School-Wide</option>
                  {departments
                    .filter((d) => d.isActive)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-slate-200 text-sm">
                  <input
                    type="checkbox"
                    checked={desigForm.isTeaching}
                    onChange={(e) =>
                      setDesigForm({
                        ...desigForm,
                        isTeaching: e.target.checked,
                      })
                    }
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Teaching Faculty Designation</span>
                </label>
                <p className="text-[11px] text-slate-500 pl-6">
                  {desigForm.isTeaching
                    ? "Authoritative Teaching flag: staff with this designation are automatically granted TEACHER role and participate in AMS."
                    : "Non-teaching designation: staff will NOT be given TEACHER role."}
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setOpenModal(null)}
                  className="px-4 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2 rounded-xl transition-all shadow"
                >
                  {loading ? "Creating..." : "Create Designation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: EDIT DESIGNATION ──────────────────────────────────────────── */}
      {openModal === "editDesig" && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                Edit Designation
              </h3>
              <button
                onClick={() => setOpenModal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateDesig} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Designation Name *
                </label>
                <input
                  type="text"
                  required
                  value={desigForm.name}
                  onChange={(e) =>
                    setDesigForm({ ...desigForm, name: e.target.value })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Department
                </label>
                <select
                  value={desigForm.departmentId}
                  onChange={(e) =>
                    setDesigForm({
                      ...desigForm,
                      departmentId: e.target.value,
                    })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                >
                  <option value="">All / School-Wide</option>
                  {departments
                    .filter((d) => d.isActive)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-slate-200 text-sm">
                  <input
                    type="checkbox"
                    checked={desigForm.isTeaching}
                    onChange={(e) =>
                      setDesigForm({
                        ...desigForm,
                        isTeaching: e.target.checked,
                      })
                    }
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Teaching Faculty Designation</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setOpenModal(null)}
                  className="px-4 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2 rounded-xl transition-all shadow"
                >
                  {loading ? "Updating..." : "Save Designation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: CREATE SALARY TEMPLATE ────────────────────────────────────── */}
      {openModal === "createTemplate" && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                Create Wage & Salary Template
              </h3>
              <button
                onClick={() => setOpenModal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Template Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Standard Teaching Faculty Pay Band"
                  value={templateForm.name}
                  onChange={(e) =>
                    setTemplateForm({ ...templateForm, name: e.target.value })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Basic % *
                  </label>
                  <input
                    type="number"
                    value={templateForm.basicPercent}
                    onChange={(e) =>
                      setTemplateForm({
                        ...templateForm,
                        basicPercent: Number(e.target.value),
                      })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    DA % *
                  </label>
                  <input
                    type="number"
                    value={templateForm.daPercent}
                    onChange={(e) =>
                      setTemplateForm({
                        ...templateForm,
                        daPercent: Number(e.target.value),
                      })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    HRA % *
                  </label>
                  <input
                    type="number"
                    value={templateForm.hraPercent}
                    onChange={(e) =>
                      setTemplateForm({
                        ...templateForm,
                        hraPercent: Number(e.target.value),
                      })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setOpenModal(null)}
                  className="px-4 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2 rounded-xl transition-all shadow"
                >
                  {loading ? "Creating..." : "Save Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: ASSOCIATE SALARY TEMPLATE ─────────────────────────────────── */}
      {openModal === "associateTemplate" && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                Configure Salary Components
              </h3>
              <button
                onClick={() => setOpenModal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssociateTemplate} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Select Staff *
                </label>
                <select
                  required
                  value={associationForm.staffId}
                  onChange={(e) =>
                    setAssociationForm({
                      ...associationForm,
                      staffId: e.target.value,
                    })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                >
                  <option value="">Select Staff</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.employeeCode} — {s.firstName} {s.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Salary Template *
                </label>
                <select
                  required
                  value={associationForm.templateId}
                  onChange={(e) =>
                    setAssociationForm({
                      ...associationForm,
                      templateId: e.target.value,
                    })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                >
                  <option value="">Select Template</option>
                  {salaryTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Monthly Base Gross Pay (₹) *
                </label>
                <input
                  type="number"
                  required
                  value={associationForm.baseGrossSalary}
                  onChange={(e) =>
                    setAssociationForm({
                      ...associationForm,
                      baseGrossSalary: Number(e.target.value),
                    })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setOpenModal(null)}
                  className="px-4 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2 rounded-xl transition-all shadow"
                >
                  {loading ? "Configuring..." : "Save Salary Config"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: CREATE LEAVE REQUEST ──────────────────────────────────────── */}
      {openModal === "createLeave" && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                Apply for Leave
              </h3>
              <button
                onClick={() => setOpenModal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLeave} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Select Staff *
                </label>
                <select
                  required
                  value={leaveForm.staffId}
                  onChange={(e) =>
                    setLeaveForm({ ...leaveForm, staffId: e.target.value })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                >
                  <option value="">Select Staff</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.employeeCode} — {s.firstName} {s.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Leave Type *
                </label>
                <select
                  required
                  value={leaveForm.leaveTypeId}
                  onChange={(e) =>
                    setLeaveForm({
                      ...leaveForm,
                      leaveTypeId: e.target.value,
                    })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                >
                  <option value="">Select Leave Type</option>
                  {leaveTypes.map((lt) => (
                    <option key={lt.id} value={lt.id}>
                      {lt.name} (Code: {lt.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={leaveForm.startDate}
                    onChange={(e) =>
                      setLeaveForm({ ...leaveForm, startDate: e.target.value })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={leaveForm.endDate}
                    onChange={(e) =>
                      setLeaveForm({ ...leaveForm, endDate: e.target.value })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Total Days *
                </label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={leaveForm.totalDays}
                  onChange={(e) =>
                    setLeaveForm({
                      ...leaveForm,
                      totalDays: Number(e.target.value),
                    })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Reason *
                </label>
                <textarea
                  rows={2}
                  required
                  value={leaveForm.reason}
                  onChange={(e) =>
                    setLeaveForm({ ...leaveForm, reason: e.target.value })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setOpenModal(null)}
                  className="px-4 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2 rounded-xl transition-all shadow"
                >
                  {loading ? "Submitting..." : "Submit Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: RECORD LOAN ───────────────────────────────────────────────── */}
      {openModal === "createLoan" && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                Record Staff Loan / Advance
              </h3>
              <button
                onClick={() => setOpenModal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLoan} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Select Staff *
                </label>
                <select
                  required
                  value={loanForm.staffId}
                  onChange={(e) =>
                    setLoanForm({ ...loanForm, staffId: e.target.value })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                >
                  <option value="">Select Staff</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.employeeCode} — {s.firstName} {s.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Principal Amount (₹) *
                </label>
                <input
                  type="number"
                  required
                  value={loanForm.principalAmount}
                  onChange={(e) =>
                    setLoanForm({
                      ...loanForm,
                      principalAmount: Number(e.target.value),
                    })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Monthly EMI Deduction (₹) *
                </label>
                <input
                  type="number"
                  required
                  value={loanForm.emiAmount}
                  onChange={(e) =>
                    setLoanForm({
                      ...loanForm,
                      emiAmount: Number(e.target.value),
                    })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setOpenModal(null)}
                  className="px-4 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2 rounded-xl transition-all shadow"
                >
                  {loading ? "Recording..." : "Record Loan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
