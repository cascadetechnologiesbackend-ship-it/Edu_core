"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PromoteStudentModal,
  ClassOption,
  YearOption,
} from "./class-history/PromoteStudentModal";
import { generateInvoicesForStudent } from "./fees/actions";

export interface Student360Data {
  id: string;
  admissionNumber: string;
  fullName: string;
  dateOfBirth: string | null;
  gender: string;
  category: string;
  bloodGroup: string | null;
  aadhaarLast4: string | null;
  apaarId: string | null;
  photoUrl: string | null;
  isActive: boolean;
  admissionDate: string;
  leavingDate: string | null;
  leavingReason: string | null;
  // Placement
  className: string;
  sectionName: string;
  academicYearLabel: string;
  classTeacherName: string | null;
  // Family
  familyMembers: Array<{
    id: string;
    relation: string;
    name: string;
    mobile: string | null;
    email: string | null;
    isPrimaryContact: boolean;
    isEmergencyContact: boolean;
    hasConsentAuthority: boolean;
  }>;
  // Academics
  subjects: Array<{
    id: string;
    name: string;
    code: string;
    teacherName: string;
  }>;
  // Attendance
  attendanceSummary: {
    total: number;
    present: number;
    absent: number;
    late: number;
    percentage: number;
  };
  attendanceLogs: Array<{
    id: string;
    date: string;
    status: string;
    remarks: string | null;
  }>;
  // Fees
  canViewFees: boolean;
  canMutateFees: boolean;
  feeStructures: Array<{
    id: string;
    name: string;
    term: string;
    amount: string;
    dueDate: string;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    netAmount: string;
    paidAmount: string;
    balanceAmount: string;
    status: string;
    dueDate: string;
    term: string;
  }>;
  concessions: Array<{
    id: string;
    concessionName: string;
    concessionType: string;
    discountPercentage: string | null;
    discountAmount: string | null;
  }>;
  // Documents
  documents: Array<{
    id: string;
    documentType: string;
    originalFileName: string;
    isVerified: boolean;
    createdAt: string;
  }>;
  // Class History
  classHistory: Array<{
    id: string;
    academicYearLabel: string;
    className: string;
    sectionName: string;
    promotionStatus: string | null;
    createdAt: string;
  }>;
  // Timeline
  timelineEvents: Array<{
    id: string;
    date: string;
    title: string;
    description: string;
    type: "ADMISSION" | "ENROLLMENT" | "ACADEMIC" | "ATTENDANCE" | "FEE";
  }>;
}

export function Student360Client({
  data,
  schoolId,
  availableClasses,
  availableYears,
}: {
  data: Student360Data;
  schoolId: string;
  availableClasses: ClassOption[];
  availableYears: YearOption[];
}) {
  const [activeTab, setActiveTab] = useState<
    | "OVERVIEW"
    | "ACADEMICS"
    | "ATTENDANCE"
    | "FEES"
    | "FAMILY"
    | "DOCUMENTS"
    | "HISTORY"
    | "TIMELINE"
  >("OVERVIEW");

  const [generatingInvoices, setGeneratingInvoices] = useState(false);
  const [invoiceMessage, setInvoiceMessage] = useState("");

  const primaryParent = data.familyMembers.find((f) => f.isPrimaryContact) ||
    data.familyMembers[0];

  const totalOutstanding = data.invoices.reduce(
    (acc, inv) => acc + parseFloat(inv.balanceAmount || "0"),
    0,
  );

  async function handleGenerateInvoices() {
    setGeneratingInvoices(true);
    setInvoiceMessage("");
    const res = await generateInvoicesForStudent(data.id);
    setGeneratingInvoices(false);
    if (res.success) {
      setInvoiceMessage(res.message || "Invoices generated successfully.");
      window.location.reload();
    } else {
      setInvoiceMessage("Error: " + res.message);
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ─── Compact Master Header ────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 p-6 flex flex-wrap items-center gap-6">
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-3xl font-bold overflow-hidden shadow-inner shrink-0">
          {data.photoUrl ? (
            <img
              src={data.photoUrl}
              alt={data.fullName}
              className="w-full h-full object-cover"
            />
          ) : (
            data.fullName.charAt(0) || "S"
          )}
        </div>

        <div className="flex-1 min-w-[280px]">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {data.fullName}
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                data.isActive
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              {data.isActive ? "Active Student" : "Inactive"}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3 text-xs text-gray-600 dark:text-gray-300">
            <div>
              <span className="text-gray-400 block">Admission No</span>
              <span className="font-mono font-semibold text-gray-900 dark:text-white">
                {data.admissionNumber}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block">Current Placement</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {data.className
                  ? `${data.className} • Section ${data.sectionName}`
                  : "Unassigned"}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block">Academic Year</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {data.academicYearLabel || "N/A"}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block">Primary Contact</span>
              <span className="font-semibold text-gray-900 dark:text-white truncate block">
                {primaryParent
                  ? `${primaryParent.name} (${primaryParent.relation})`
                  : "None recorded"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <PromoteStudentModal
            studentId={data.id}
            schoolId={schoolId}
            availableClasses={availableClasses}
            availableYears={availableYears}
          />
        </div>
      </div>

      {/* ─── Glanceable Metric Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Attendance */}
        <div
          onClick={() => setActiveTab("ATTENDANCE")}
          className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 cursor-pointer hover:border-blue-500 transition-colors shadow-sm"
        >
          <div className="text-xs font-semibold uppercase text-gray-400 tracking-wider">
            Attendance Rate
          </div>
          <div className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
            {data.attendanceSummary.percentage}%
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {data.attendanceSummary.present} / {data.attendanceSummary.total} days present
          </div>
        </div>

        {/* Fees */}
        <div
          onClick={() => setActiveTab("FEES")}
          className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 cursor-pointer hover:border-blue-500 transition-colors shadow-sm"
        >
          <div className="text-xs font-semibold uppercase text-gray-400 tracking-wider">
            Fee Balance
          </div>
          <div className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
            {data.canViewFees ? `₹${totalOutstanding.toFixed(2)}` : "Restricted"}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {data.canViewFees
              ? `${data.invoices.filter((i) => i.status === "PENDING").length} pending invoices`
              : "Financial role required"}
          </div>
        </div>

        {/* Academics */}
        <div
          onClick={() => setActiveTab("ACADEMICS")}
          className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 cursor-pointer hover:border-blue-500 transition-colors shadow-sm"
        >
          <div className="text-xs font-semibold uppercase text-gray-400 tracking-wider">
            Academic Roster
          </div>
          <div className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
            {data.subjects.length} Subjects
          </div>
          <div className="text-xs text-gray-500 mt-1 truncate">
            Teacher: {data.classTeacherName || "Not Assigned"}
          </div>
        </div>

        {/* Documents */}
        <div
          onClick={() => setActiveTab("DOCUMENTS")}
          className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 cursor-pointer hover:border-blue-500 transition-colors shadow-sm"
        >
          <div className="text-xs font-semibold uppercase text-gray-400 tracking-wider">
            Documents
          </div>
          <div className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
            {data.documents.filter((d) => d.isVerified).length} / {data.documents.length}
          </div>
          <div className="text-xs text-gray-500 mt-1">Verified records</div>
        </div>
      </div>

      {/* ─── 8-Tab Navigation Bar ────────────────────────────────────────── */}
      <div className="border-b border-gray-200 dark:border-slate-800 flex overflow-x-auto gap-2 text-sm font-medium">
        {[
          { key: "OVERVIEW", label: "Overview" },
          { key: "ACADEMICS", label: "Academics" },
          { key: "ATTENDANCE", label: "Attendance" },
          { key: "FEES", label: "Fees" },
          { key: "FAMILY", label: "Family & Guardians" },
          { key: "DOCUMENTS", label: "Documents" },
          { key: "HISTORY", label: "Class History" },
          { key: "TIMELINE", label: "Student Timeline" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`py-3 px-4 rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/30 dark:bg-slate-800/50 font-semibold"
                : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── TAB CONTENT ─────────────────────────────────────────────────── */}

      {/* 1. OVERVIEW */}
      {activeTab === "OVERVIEW" && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 dark:text-white text-base border-b pb-2">
              Personal Identity & Demographics
            </h3>
            <div className="grid grid-cols-2 gap-y-3 text-sm">
              <span className="text-gray-400">Date of Birth:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {data.dateOfBirth
                  ? new Date(data.dateOfBirth).toLocaleDateString()
                  : "N/A"}
              </span>

              <span className="text-gray-400">Gender:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {data.gender}
              </span>

              <span className="text-gray-400">Category:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {data.category}
              </span>

              <span className="text-gray-400">Blood Group:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {data.bloodGroup || "Not Provided"}
              </span>

              <span className="text-gray-400">Aadhaar (DPDP):</span>
              <span className="font-mono font-medium text-gray-900 dark:text-white">
                {data.aadhaarLast4 ? `XXXX-XXXX-${data.aadhaarLast4}` : "Masked"}
              </span>

              <span className="text-gray-400">Admission Date:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {new Date(data.admissionDate).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 dark:text-white text-base border-b pb-2">
              Academic Placement
            </h3>
            <div className="grid grid-cols-2 gap-y-3 text-sm">
              <span className="text-gray-400">Current Class:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {data.className || "Not assigned"}
              </span>

              <span className="text-gray-400">Section:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {data.sectionName ? `Section ${data.sectionName}` : "N/A"}
              </span>

              <span className="text-gray-400">Academic Year:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {data.academicYearLabel}
              </span>

              <span className="text-gray-400">Class Teacher:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {data.classTeacherName || "Not Assigned"}
              </span>

              <span className="text-gray-400">Enrolled Subjects:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {data.subjects.length} active subjects
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. ACADEMICS */}
      {activeTab === "ACADEMICS" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-gray-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b pb-3">
            <div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                Class Subjects & Subject Teachers
              </h3>
              <p className="text-xs text-gray-500">
                Authoritative subjects inherited from Academic Management for {data.className}
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.subjects.map((sub) => (
              <div
                key={sub.id}
                className="p-4 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 space-y-2"
              >
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                    {sub.name}
                  </h4>
                  <span className="text-xs font-mono bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                    {sub.code || "SUB"}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  Teacher: <strong className="text-gray-800 dark:text-gray-200">{sub.teacherName}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. ATTENDANCE */}
      {activeTab === "ATTENDANCE" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-gray-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b pb-3">
            <div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                Attendance Record
              </h3>
              <p className="text-xs text-gray-500">
                Daily attendance logs captured from teacher attendance roster
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {data.attendanceSummary.percentage}%
              </span>
              <span className="text-xs text-gray-400 block">Overall Present</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-300 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {data.attendanceLogs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                      No attendance records logged yet.
                    </td>
                  </tr>
                ) : (
                  data.attendanceLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {new Date(log.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            log.status === "PRESENT"
                              ? "bg-green-100 text-green-800"
                              : log.status === "ABSENT"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {log.remarks || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. FEES */}
      {activeTab === "FEES" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-gray-200 dark:border-slate-800 shadow-sm space-y-6">
          {!data.canViewFees ? (
            <div className="p-8 text-center text-gray-500">
              🔒 Financial details are restricted to Accountants and School Administrators.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap justify-between items-center gap-4 border-b pb-4">
                <div>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                    Fee Structures & Invoices
                  </h3>
                  <p className="text-xs text-gray-500">
                    Applicable billing plans and invoices for {data.className}
                  </p>
                </div>

                {data.canMutateFees && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleGenerateInvoices}
                      disabled={generatingInvoices}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 px-3 rounded-lg text-xs shadow-sm transition-colors disabled:opacity-50"
                    >
                      {generatingInvoices ? "Generating..." : "Generate Invoices"}
                    </button>
                    <Link
                      href={`/students/${data.id}/fees`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Open Full Ledger →
                    </Link>
                  </div>
                )}
              </div>

              {invoiceMessage && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-lg">
                  {invoiceMessage}
                </div>
              )}

              {/* Active Concessions */}
              {data.concessions.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase text-gray-400 tracking-wider mb-2">
                    Active Concessions / Scholarships
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {data.concessions.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 rounded-lg bg-green-50/50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 flex justify-between items-center"
                      >
                        <span className="font-semibold text-xs text-green-900 dark:text-green-300">
                          {c.concessionName} ({c.concessionType})
                        </span>
                        <span className="text-xs font-bold text-green-700 dark:text-green-400">
                          {c.discountPercentage ? `${c.discountPercentage}% OFF` : `₹${c.discountAmount} OFF`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Invoices Table */}
              <div>
                <h4 className="text-xs font-semibold uppercase text-gray-400 tracking-wider mb-2">
                  Generated Invoices
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-300 text-xs uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-3">Invoice No</th>
                        <th className="px-4 py-3">Term</th>
                        <th className="px-4 py-3">Net Amount</th>
                        <th className="px-4 py-3">Balance</th>
                        <th className="px-4 py-3">Due Date</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                      {data.invoices.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                            No invoices generated yet. Click "Generate Invoices" to initialize fee bills.
                          </td>
                        </tr>
                      ) : (
                        data.invoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                            <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-white">
                              {inv.invoiceNumber}
                            </td>
                            <td className="px-4 py-3 text-xs">{inv.term}</td>
                            <td className="px-4 py-3 font-semibold">₹{inv.netAmount}</td>
                            <td className="px-4 py-3 font-semibold text-red-600">₹{inv.balanceAmount}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {new Date(inv.dueDate).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                  inv.status === "PAID"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {inv.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 5. FAMILY */}
      {activeTab === "FAMILY" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-gray-200 dark:border-slate-800 shadow-sm space-y-6">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white border-b pb-3">
            Family & Guardians Dossier
          </h3>

          <div className="grid md:grid-cols-2 gap-4">
            {data.familyMembers.length === 0 ? (
              <p className="text-gray-400 text-sm">No family members recorded.</p>
            ) : (
              data.familyMembers.map((fm) => (
                <div
                  key={fm.id}
                  className="p-5 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-base">
                        {fm.name}
                      </h4>
                      <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                        {fm.relation}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {fm.isPrimaryContact && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded font-medium">
                          Primary Contact
                        </span>
                      )}
                      {fm.hasConsentAuthority && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium">
                          DPDP Consent Authority
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
                    {fm.mobile && <div>📞 Mobile: {fm.mobile}</div>}
                    {fm.email && <div>✉️ Email: {fm.email}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 6. DOCUMENTS */}
      {activeTab === "DOCUMENTS" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-gray-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="border-b pb-3">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
              Permanent Student Documents
            </h3>
            <p className="text-xs text-gray-500">
              Verified identity, statutory compliance, and admission certificates
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-300 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Document Type</th>
                  <th className="px-4 py-3">File Name</th>
                  <th className="px-4 py-3">Verification State</th>
                  <th className="px-4 py-3">Uploaded Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {data.documents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                      No documents recorded for this student.
                    </td>
                  </tr>
                ) : (
                  data.documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {doc.documentType.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                        {doc.originalFileName}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            doc.isVerified
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {doc.isVerified ? "✓ Verified" : "Pending Review"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. CLASS HISTORY */}
      {activeTab === "HISTORY" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-gray-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b pb-3">
            <div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                Academic Progression History
              </h3>
              <p className="text-xs text-gray-500">
                Authoritative class enrollment and promotion timeline
              </p>
            </div>
            <PromoteStudentModal
              studentId={data.id}
              schoolId={schoolId}
              availableClasses={availableClasses}
              availableYears={availableYears}
            />
          </div>

          <div className="space-y-4">
            {data.classHistory.length === 0 ? (
              <p className="text-gray-400 text-sm">No class history records.</p>
            ) : (
              data.classHistory.map((h, idx) => (
                <div
                  key={h.id}
                  className="flex items-center p-4 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 flex items-center justify-center font-bold text-xs">
                      #{idx + 1}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                        {h.className} • Section {h.sectionName}
                      </h4>
                      <p className="text-xs text-gray-500">
                        Academic Year: {h.academicYearLabel}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="px-2.5 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                      {h.promotionStatus || "ACTIVE"}
                    </span>
                    <span className="block text-xs text-gray-400 mt-1">
                      {new Date(h.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 8. TIMELINE */}
      {activeTab === "TIMELINE" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-gray-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="border-b pb-3">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
              Student Trajectory Timeline
            </h3>
            <p className="text-xs text-gray-500">
              Chronological audit log of significant milestones and state transitions
            </p>
          </div>

          <div className="relative border-l-2 border-blue-200 dark:border-blue-900 ml-4 space-y-6 py-2">
            {data.timelineEvents.map((evt) => (
              <div key={evt.id} className="relative pl-6">
                <div className="absolute -left-2 top-1.5 w-4 h-4 rounded-full bg-blue-600 border-2 border-white dark:border-slate-900" />
                <div className="text-xs text-gray-400">
                  {new Date(evt.date).toLocaleDateString()}
                </div>
                <div className="font-semibold text-sm text-gray-900 dark:text-white">
                  {evt.title}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                  {evt.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
