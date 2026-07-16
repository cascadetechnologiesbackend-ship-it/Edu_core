"use client";

import { useState } from "react";
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
} from "lucide-react";
import {
  createStaff,
  confirmStaffProbation,
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
  const [activeTab, setActiveTab] = useState<
    "staff" | "templates" | "leaves" | "payroll"
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

  // Forms states
  const [staffForm, setStaffForm] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "1990-01-01",
    gender: "MALE",
    mobile: "",
    email: "",
    address: "",
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

  const [templateForm, setTemplateForm] = useState({
    name: "",
    basicPercent: 50,
    daPercent: 10,
    hraPercent: 20,
    pfEmployeePercent: 12,
    pfEmployerPercent: 12,
    esiApplicable: false,
    professionalTaxState: "MH",
    allowanceName: "",
    allowanceAmount: 0,
    otherAllowances: [] as Array<{ name: string; amount: number }>,
  });

  const [associationForm, setAssociationForm] = useState({
    staffId: "",
    templateId: "",
    baseGrossSalary: 0,
    monthlyTds: 0,
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
    session?.user?.role === "SUPER_ADMIN";
  const isAuthorizedLock =
    session?.user?.role === "PRINCIPAL" ||
    session?.user?.role === "SUPER_ADMIN";

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
    } else {
      setErrorMsg(res.message || "Failed to create staff profile");
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    const res = await createSalaryTemplate(templateForm);
    setLoading(false);
    if (res.success) {
      setSuccessMsg("Salary template created!");
      setOpenModal(null);
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
            Human Resources & Payroll Portal
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
                setOpenModal("createStaff");
                setErrorMsg("");
                setSuccessMsg("");
              }}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-md"
            >
              <PlusCircle className="w-4 h-4" />
              Add Staff Profile
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
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab("staff")}
          className={`pb-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === "staff"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Staff Directory & Vault
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={`pb-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-1.5 ${
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
          className={`pb-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-1.5 ${
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
          className={`pb-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === "payroll"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Monthly Payroll Run
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "staff" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-slate-900 dark:to-indigo-950/20 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase">
                Total Employees
              </span>
              <p className="text-3xl font-extrabold mt-1 text-slate-850 dark:text-white">
                {staffList.length}
              </p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-slate-900 dark:to-amber-950/20 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase">
                On Probation
              </span>
              <p className="text-3xl font-extrabold mt-1 text-slate-850 dark:text-white">
                {staffList.filter((s) => s.contractType === "PROBATION").length}
              </p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-slate-900 dark:to-emerald-950/20 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase">
                Configured Salaries
              </span>
              <p className="text-3xl font-extrabold mt-1 text-slate-850 dark:text-white">
                {staffList.filter((s) => s.salaryComponents.length > 0).length}
              </p>
            </div>
          </div>

          {staffList.filter((s) => {
            if (s.contractType !== "PROBATION") return false;
            const elapsed = Date.now() - new Date(s.joiningDate).getTime();
            return elapsed >= 90 * 24 * 60 * 60 * 1000;
          }).length > 0 && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-250 dark:border-amber-900 rounded-2xl space-y-2">
              <span className="font-bold text-sm text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block animate-pulse" />
                Probation Confirmation Reminders
              </span>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                The following staff members have completed their 90-day
                probation period and are due for confirmation:
              </p>
              <div className="flex flex-col gap-2">
                {staffList
                  .filter((s) => {
                    if (s.contractType !== "PROBATION") return false;
                    const elapsed =
                      Date.now() - new Date(s.joiningDate).getTime();
                    return elapsed >= 90 * 24 * 60 * 60 * 1000;
                  })
                  .map((s) => (
                    <div
                      key={s.id}
                      className="flex justify-between items-center bg-white/40 dark:bg-slate-900/40 p-3 rounded-xl border border-amber-200/50"
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
                            }
                          }}
                          className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider"
                        >
                          Confirm Staff
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/40">
              <h3 className="font-semibold text-slate-800 dark:text-white">
                Active Staff Directory
              </h3>
              <div className="flex gap-2">
                {isAuthorizedHR && (
                  <>
                    <button
                      onClick={() => setOpenModal("associateTemplate")}
                      className="bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1"
                    >
                      Configure Salary Components
                    </button>
                    <button
                      onClick={() => setOpenModal("createLoan")}
                      className="bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1"
                    >
                      Record Loan
                    </button>
                    <button
                      onClick={() => setOpenModal("uploadDoc")}
                      className="bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1"
                    >
                      <Upload className="w-3 h-3" />
                      Upload Vault Document
                    </button>
                  </>
                )}
              </div>
            </div>

            {staffList.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                No staff members created yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/10 text-slate-400 font-semibold uppercase text-xs">
                      <th className="p-4">Code</th>
                      <th className="p-4">Name</th>
                      <th className="p-4">Dept / Desig</th>
                      <th className="p-4">Contract</th>
                      <th className="p-4">Aadhaar (Masked)</th>
                      <th className="p-4">PAN / Bank Info</th>
                      <th className="p-4">Vault Docs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {staffList.map((s) => {
                      const revealed = revealedPii[s.id] || {};
                      const departmentName = s.department?.name || "—";
                      const designationName = s.designation?.name || "—";

                      return (
                        <tr
                          key={s.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/30"
                        >
                          <td className="p-4 font-mono font-medium text-indigo-600 dark:text-indigo-400">
                            {s.employeeCode}
                          </td>
                          <td className="p-4">
                            <div className="font-semibold text-slate-800 dark:text-white">
                              {s.firstName} {s.lastName}
                            </div>
                            <div className="text-xs text-slate-400">
                              {s.email}
                            </div>
                          </td>
                          <td className="p-4">
                            <div>{departmentName}</div>
                            <div className="text-xs text-slate-400">
                              {designationName}
                            </div>
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                s.contractType === "PROBATION"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                              }`}
                            >
                              {s.contractType}
                            </span>
                            {s.contractType === "PROBATION" &&
                              isAuthorizedHR && (
                                <button
                                  onClick={async () => {
                                    if (
                                      confirm(
                                        "Confirm probation completion? This will update staff to PERMANENT contract status.",
                                      )
                                    ) {
                                      await confirmStaffProbation(s.id);
                                    }
                                  }}
                                  className="block mt-1 text-xs text-indigo-600 hover:underline"
                                >
                                  Confirm Permanent
                                </button>
                              )}
                          </td>
                          <td className="p-4 text-slate-400">
                            ********{s.aadhaarLast4}
                          </td>
                          <td className="p-4 space-y-1.5">
                            {/* PAN Detail */}
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-semibold text-slate-400">
                                PAN:
                              </span>
                              {revealed.pan ? (
                                <span className="font-mono text-slate-700 dark:text-slate-300">
                                  {revealed.pan}
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleReveal(s.id, "pan")}
                                  className="text-indigo-600 hover:underline flex items-center gap-0.5"
                                  title="Revealing records is logged under DPDP rules"
                                >
                                  <Eye className="w-3.5 h-3.5" /> Reveal
                                </button>
                              )}
                            </div>

                            {/* Bank Details */}
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-semibold text-slate-400">
                                Bank:
                              </span>
                              {revealed.bank ? (
                                <span className="text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                                  {revealed.bank}
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleReveal(s.id, "bank")}
                                  className="text-indigo-600 hover:underline flex items-center gap-0.5"
                                  title="Revealing records is logged under DPDP rules"
                                >
                                  <Eye className="w-3.5 h-3.5" /> Reveal
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            {s.documents.length === 0 ? (
                              <span className="text-xs text-slate-400 italic">
                                Empty Vault
                              </span>
                            ) : (
                              <div className="flex flex-col gap-1">
                                {s.documents.map((doc: any) => (
                                  <div
                                    key={doc.id}
                                    className="text-xs flex items-center gap-1 text-indigo-600 hover:underline"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    <a
                                      href="#"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        alert(
                                          "Direct S3 URL expiry download stub initiated",
                                        );
                                      }}
                                    >
                                      {doc.fileName}
                                    </a>
                                  </div>
                                ))}
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

      {/* SALARY TEMPLATES TAB */}
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

      {/* LEAVES TAB */}
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
                Pending Leave Requests Queue
              </h4>
            </div>

            {leaveRequests.filter(
              (r) => r.status === "PENDING" || r.status === "HOD_APPROVED",
            ).length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                No pending leave requests to review.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {leaveRequests
                  .filter(
                    (r) =>
                      r.status === "PENDING" || r.status === "HOD_APPROVED",
                  )
                  .map((r) => (
                    <div
                      key={r.id}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="font-semibold text-slate-800 dark:text-white">
                          {r.staff?.employeeCode} — Leave Type:{" "}
                          {r.leaveType?.name || r.leaveType?.code}
                        </div>
                        <div className="text-xs text-slate-400">
                          Dates: {new Date(r.startDate).toLocaleDateString()} to{" "}
                          {new Date(r.endDate).toLocaleDateString()} (
                          {r.totalDays} Days)
                        </div>
                        <div className="text-xs text-slate-500 italic">
                          "Reason: {r.reason}"
                        </div>
                        <div className="text-xs font-semibold text-amber-600 flex items-center gap-1">
                          Current Status:{" "}
                          <span className="underline">{r.status}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {r.status === "PENDING" && (
                          <button
                            onClick={async () => {
                              await approveLeaveRequest(r.id, "HOD", true);
                            }}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-semibold border border-indigo-200"
                          >
                            HOD Approve
                          </button>
                        )}
                        {(r.status === "HOD_APPROVED" ||
                          r.status === "PENDING") &&
                          isAuthorizedHR && (
                            <button
                              onClick={async () => {
                                await approveLeaveRequest(r.id, "HR", true);
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow"
                            >
                              HR Final Approve
                            </button>
                          )}
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
                            }
                          }}
                          className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PAYROLL TAB */}
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

      {/* DIALOGS / MODALS */}
      {openModal === "createStaff" && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                Add New Staff Profile
              </h3>
              <button
                onClick={() => setOpenModal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleCreateStaff}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs"
            >
              <div className="space-y-1">
                <label className="font-semibold text-slate-500">
                  First Name
                </label>
                <input
                  type="text"
                  required
                  value={staffForm.firstName}
                  onChange={(e) =>
                    setStaffForm({ ...staffForm, firstName: e.target.value })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl focus:outline-none focus:border-indigo-600 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-500">
                  Last Name
                </label>
                <input
                  type="text"
                  required
                  value={staffForm.lastName}
                  onChange={(e) =>
                    setStaffForm({ ...staffForm, lastName: e.target.value })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl focus:outline-none focus:border-indigo-600 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-500">
                  Employee Code
                </label>
                <input
                  type="text"
                  required
                  value={staffForm.employeeCode}
                  onChange={(e) =>
                    setStaffForm({ ...staffForm, employeeCode: e.target.value })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl focus:outline-none focus:border-indigo-600 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-500">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={staffForm.email}
                  onChange={(e) =>
                    setStaffForm({ ...staffForm, email: e.target.value })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl focus:outline-none focus:border-indigo-600 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-500">
                  Mobile Number
                </label>
                <input
                  type="text"
                  required
                  value={staffForm.mobile}
                  onChange={(e) =>
                    setStaffForm({ ...staffForm, mobile: e.target.value })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl focus:outline-none focus:border-indigo-600 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-500">
                  Aadhaar (Last 4 digits only)
                </label>
                <input
                  type="text"
                  required
                  maxLength={4}
                  value={staffForm.aadhaarLast4}
                  onChange={(e) =>
                    setStaffForm({ ...staffForm, aadhaarLast4: e.target.value })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl focus:outline-none focus:border-indigo-600 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-500">
                  PAN Number (Encrypted)
                </label>
                <input
                  type="text"
                  value={staffForm.pan}
                  onChange={(e) =>
                    setStaffForm({ ...staffForm, pan: e.target.value })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl focus:outline-none focus:border-indigo-600 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-500">
                  Department
                </label>
                <select
                  required
                  value={staffForm.departmentId}
                  onChange={(e) =>
                    setStaffForm({ ...staffForm, departmentId: e.target.value })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl focus:outline-none focus:border-indigo-600 text-sm"
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-500">
                  Designation
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
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl focus:outline-none focus:border-indigo-600 text-sm"
                >
                  <option value="">Select Designation</option>
                  {designations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-500">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={staffForm.bankName}
                  onChange={(e) =>
                    setStaffForm({ ...staffForm, bankName: e.target.value })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl focus:outline-none focus:border-indigo-600 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-500">
                  Bank Account Number
                </label>
                <input
                  type="text"
                  value={staffForm.bankAccount}
                  onChange={(e) =>
                    setStaffForm({ ...staffForm, bankAccount: e.target.value })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl focus:outline-none focus:border-indigo-600 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-500">
                  Bank IFSC Code
                </label>
                <input
                  type="text"
                  value={staffForm.bankIfsc}
                  onChange={(e) =>
                    setStaffForm({ ...staffForm, bankIfsc: e.target.value })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl focus:outline-none focus:border-indigo-600 text-sm"
                />
              </div>

              <div className="md:col-span-2 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow"
                >
                  {loading ? "Processing..." : "Create Staff Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {openModal === "createTemplate" && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                Create Salary Template
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
                <label className="font-semibold text-slate-500">
                  Template Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Teaching Staff Preset"
                  value={templateForm.name}
                  onChange={(e) =>
                    setTemplateForm({ ...templateForm, name: e.target.value })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-500">
                    Basic Wage (%)
                  </label>
                  <input
                    type="number"
                    value={templateForm.basicPercent}
                    onChange={(e) =>
                      setTemplateForm({
                        ...templateForm,
                        basicPercent: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-500">
                    DA allowance (%)
                  </label>
                  <input
                    type="number"
                    value={templateForm.daPercent}
                    onChange={(e) =>
                      setTemplateForm({
                        ...templateForm,
                        daPercent: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-500">
                    HRA house rent (%)
                  </label>
                  <input
                    type="number"
                    value={templateForm.hraPercent}
                    onChange={(e) =>
                      setTemplateForm({
                        ...templateForm,
                        hraPercent: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-500">
                    PT State
                  </label>
                  <select
                    value={templateForm.professionalTaxState}
                    onChange={(e) =>
                      setTemplateForm({
                        ...templateForm,
                        professionalTaxState: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                  >
                    <option value="DL">Delhi (0 PT)</option>
                    <option value="KA">Karnataka (₹200)</option>
                    <option value="MH">Maharashtra (Slabs)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="esiCheck"
                  checked={templateForm.esiApplicable}
                  onChange={(e) =>
                    setTemplateForm({
                      ...templateForm,
                      esiApplicable: e.target.checked,
                    })
                  }
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label
                  htmlFor="esiCheck"
                  className="font-semibold text-slate-600 dark:text-slate-350"
                >
                  Enable ESI contributions (if wages &lt;= 21,000)
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow"
              >
                {loading ? "Creating..." : "Save Template"}
              </button>
            </form>
          </div>
        </div>
      )}

      {openModal === "associateTemplate" && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                Associate Salary Structure
              </h3>
              <button
                onClick={() => setOpenModal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleAssociateTemplate}
              className="space-y-4 text-xs"
            >
              <div className="space-y-1">
                <label className="font-semibold text-slate-500">
                  Staff Member
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
                <label className="font-semibold text-slate-500">
                  Salary Template
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
                <label className="font-semibold text-slate-500">
                  Base Monthly Gross Salary (₹)
                </label>
                <input
                  type="number"
                  required
                  value={associationForm.baseGrossSalary || ""}
                  onChange={(e) =>
                    setAssociationForm({
                      ...associationForm,
                      baseGrossSalary: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-500">
                  Monthly TDS Amount (₹, Section 192B)
                </label>
                <input
                  type="number"
                  value={associationForm.monthlyTds || ""}
                  onChange={(e) =>
                    setAssociationForm({
                      ...associationForm,
                      monthlyTds: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow"
              >
                {loading ? "Associating..." : "Apply Wages Preset"}
              </button>
            </form>
          </div>
        </div>
      )}

      {openModal === "createLoan" && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                Record Staff Loan
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
                <label className="font-semibold text-slate-500">
                  Staff Member
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
                <label className="font-semibold text-slate-500">
                  Principal Loan Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  value={loanForm.principalAmount || ""}
                  onChange={(e) =>
                    setLoanForm({
                      ...loanForm,
                      principalAmount: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-500">
                  Monthly EMI Deduction (₹)
                </label>
                <input
                  type="number"
                  required
                  value={loanForm.emiAmount || ""}
                  onChange={(e) =>
                    setLoanForm({
                      ...loanForm,
                      emiAmount: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow"
              >
                {loading ? "Recording..." : "Save Loan Record"}
              </button>
            </form>
          </div>
        </div>
      )}

      {openModal === "createLeave" && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                Apply For Leave
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
                <label className="font-semibold text-slate-500">
                  Applicant Staff Profile
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
                <label className="font-semibold text-slate-500">
                  Leave Type
                </label>
                <select
                  required
                  value={leaveForm.leaveTypeId}
                  onChange={(e) =>
                    setLeaveForm({ ...leaveForm, leaveTypeId: e.target.value })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                >
                  <option value="">Select Leave Type</option>
                  {leaveTypes.map((lt) => (
                    <option key={lt.id} value={lt.id}>
                      {lt.name} ({lt.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-500">
                    Start Date
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
                  <label className="font-semibold text-slate-500">
                    End Date
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
                <label className="font-semibold text-slate-500">
                  Total Leave Days
                </label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={leaveForm.totalDays}
                  onChange={(e) =>
                    setLeaveForm({
                      ...leaveForm,
                      totalDays: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-500">Reason</label>
                <textarea
                  required
                  rows={3}
                  value={leaveForm.reason}
                  onChange={(e) =>
                    setLeaveForm({ ...leaveForm, reason: e.target.value })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow"
              >
                {loading ? "Submitting..." : "Apply"}
              </button>
            </form>
          </div>
        </div>
      )}

      {openModal === "uploadDoc" && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                Upload to Vault
              </h3>
              <button
                onClick={() => setOpenModal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadDoc} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-500">
                  Select Staff
                </label>
                <select
                  required
                  value={docForm.staffId}
                  onChange={(e) =>
                    setDocForm({ ...docForm, staffId: e.target.value })
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
                <label className="font-semibold text-slate-500">
                  Document Type
                </label>
                <select
                  value={docForm.documentType}
                  onChange={(e) =>
                    setDocForm({ ...docForm, documentType: e.target.value })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                >
                  <option value="APPOINTMENT_LETTER">Appointment Letter</option>
                  <option value="INCREMENT_LETTER">Increment Letter</option>
                  <option value="CERTIFICATE">Certificate</option>
                  <option value="OTHER">Other Contractual Doc</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-500">
                  File Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Appointment Letter 2025.pdf"
                  value={docForm.fileName}
                  onChange={(e) =>
                    setDocForm({ ...docForm, fileName: e.target.value })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-500">
                  Mock S3 Key / Path
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. contracts/doc_49202_appointment.pdf"
                  value={docForm.fileS3Key}
                  onChange={(e) =>
                    setDocForm({ ...docForm, fileS3Key: e.target.value })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-sm font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow"
              >
                {loading ? "Registering..." : "Add Vault Document"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
