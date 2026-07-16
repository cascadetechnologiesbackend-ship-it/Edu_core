"use client";

import { useState, useEffect } from "react";
import {
  toggleLegalHold,
  createVendor,
  updateVendorDpaStatus,
  reportDataBreach,
  markBreachBoardNotified,
  markBreachParentsNotified,
  resolveRightsRequest,
  resolveGrievance,
  triggerManualRetentionRun,
} from "./actions";
import {
  Shield,
  FileText,
  AlertTriangle,
  Search,
  CheckCircle,
  Clock,
  Briefcase,
  AlertOctagon,
} from "lucide-react";
import { decryptData } from "@/lib/encryption";

interface ConsentMetric {
  purposeId: string;
  labelEn: string;
  mandatory: boolean;
  grantedCount: number;
  percentage: number;
}

interface RightsRequest {
  id: string;
  ticketNumber: string;
  studentId: string;
  requestType: string;
  description: string;
  status: string;
  dueAt: Date;
  responseDetails?: string | null;
  createdAt: Date;
}

interface Grievance {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: string;
  dueAt: Date;
  resolutionDetails?: string | null;
  createdAt: Date;
}

interface Vendor {
  id: string;
  vendorName: string;
  vendorType: string;
  dataShared: any;
  purposeOfSharing: string;
  dpaStatus: string;
  dpaSignedAt?: Date | null;
  dpaExpiresAt?: Date | null;
}

interface BreachLog {
  id: string;
  incidentReference: string;
  detectedAt: Date;
  severity: string;
  status: string;
  description: string;
  affectedRecordsCount: number;
  affectedDataCategories: any;
  boardNotificationDeadline: Date;
  boardNotifiedAt?: Date | null;
  parentsNotifiedAt?: Date | null;
}

interface AuditLog {
  id: string;
  userEmail: string;
  userRole: string;
  action: string;
  tableName: string;
  recordId?: string | null;
  createdAt: Date;
  ipAddress: string;
  userAgent: string;
}

interface Props {
  totalStudentsCount: number;
  consentMetrics: ConsentMetric[];
  initialRequests: RightsRequest[];
  initialGrievances: Grievance[];
  softDeletedStudents: any[];
  softDeletedStaff: any[];
  vendors: Vendor[];
  breaches: BreachLog[];
  auditLogs: AuditLog[];
}

export default function DpdpDashboardClient({
  totalStudentsCount,
  consentMetrics,
  initialRequests,
  initialGrievances,
  softDeletedStudents,
  softDeletedStaff,
  vendors,
  breaches,
  auditLogs,
}: Props) {
  const [activeTab, setActiveTab] = useState("overview");

  // State arrays
  const [requests, setRequests] = useState<RightsRequest[]>(initialRequests);
  const [grievances, setGrievances] = useState<Grievance[]>(initialGrievances);
  const [vendorList, setVendorList] = useState<Vendor[]>(vendors);
  const [breachList, setBreachList] = useState<BreachLog[]>(breaches);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>(auditLogs);

  // Filters for Audit Explorer
  const [searchEmail, setSearchEmail] = useState("");
  const [searchTable, setSearchTable] = useState("");
  const [searchAction, setSearchAction] = useState("");

  // Loading/Status
  const [loading, setLoading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Resolution modals
  const [resolvingTicket, setResolvingTicket] = useState<{ id: string; type: "REQUEST" | "GRIEVANCE" } | null>(null);
  const [resApprove, setResApprove] = useState(true);
  const [resDetails, setResDetails] = useState("");

  // Breach Form Modal
  const [showBreachModal, setShowBreachModal] = useState(false);
  const [breachDesc, setBreachDesc] = useState("");
  const [breachCount, setBreachCount] = useState(0);
  const [breachCategories, setBreachCategories] = useState("");
  const [breachActions, setBreachActions] = useState("");
  const [breachSeverity, setBreachSeverity] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("MEDIUM");

  // Vendor Form Modal
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [vName, setVName] = useState("");
  const [vType, setVType] = useState("");
  const [vDataShared, setVDataShared] = useState("");
  const [vPurpose, setVPurpose] = useState("");
  const [vDpaStatus, setVDpaStatus] = useState<"SIGNED" | "PENDING">("PENDING");
  const [vDpaExpiry, setVDpaExpiry] = useState("");

  // Filter audit logs
  useEffect(() => {
    let list = auditLogs;
    if (searchEmail.trim()) {
      list = list.filter((l) => l.userEmail.toLowerCase().includes(searchEmail.toLowerCase()));
    }
    if (searchTable.trim()) {
      list = list.filter((l) => l.tableName.toLowerCase().includes(searchTable.toLowerCase()));
    }
    if (searchAction.trim()) {
      list = list.filter((l) => l.action === searchAction);
    }
    setFilteredLogs(list);
  }, [searchEmail, searchTable, searchAction, auditLogs]);

  // SLA Time Countdown Calculations
  const getSlaHoursLeft = (dueAtStr: Date) => {
    const hours = Math.round((new Date(dueAtStr).getTime() - Date.now()) / (1000 * 60 * 60));
    return hours;
  };

  const handleResolveTicket = async () => {
    if (!resolvingTicket || !resDetails.trim()) return;

    setLoading("RESOLVE");
    if (resolvingTicket.type === "REQUEST") {
      const res = await resolveRightsRequest(resolvingTicket.id, resApprove, resDetails);
      if (res.success) {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === resolvingTicket.id
              ? { ...r, status: resApprove ? "COMPLETED" : "REJECTED", responseDetails: resDetails }
              : r
          )
        );
        setSuccessMsg("Rights request resolved successfully!");
      } else {
        setErrorMsg(res.message || "Failed to resolve request");
      }
    } else {
      const res = await resolveGrievance(resolvingTicket.id, resDetails);
      if (res.success) {
        setGrievances((prev) =>
          prev.map((g) =>
            g.id === resolvingTicket.id
              ? { ...g, status: "COMPLETED", resolutionDetails: resDetails }
              : g
          )
        );
        setSuccessMsg("Grievance resolved and DPO notified successfully!");
      } else {
        setErrorMsg(res.message || "Failed to resolve grievance");
      }
    }
    setLoading(null);
    setResolvingTicket(null);
    setResDetails("");
  };

  const handleReportBreach = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading("BREACH");
    const categories = breachCategories.split(",").map((c) => c.trim()).filter(Boolean);

    const res = await reportDataBreach({
      description: breachDesc,
      affectedRecordsCount: breachCount,
      affectedDataCategories: categories,
      containmentActions: breachActions,
      severity: breachSeverity,
    });
    setLoading(null);

    if (res.success) {
      setSuccessMsg("Data breach logged. DPO automatically notified via email!");
      setShowBreachModal(false);
      setBreachDesc("");
      setBreachCount(0);
      setBreachCategories("");
      setBreachActions("");
      // Real-time reload would load breaches from db, simulating in state
      const newBreach: BreachLog = {
        id: Math.random().toString(),
        incidentReference: `BR-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
        detectedAt: new Date(),
        severity: breachSeverity,
        status: "DETECTED",
        description: breachDesc,
        affectedRecordsCount: breachCount,
        affectedDataCategories: categories,
        boardNotificationDeadline: new Date(Date.now() + 72 * 60 * 60 * 1000),
      };
      setBreachList((prev) => [newBreach, ...prev]);
    } else {
      setErrorMsg(res.message || "Failed to log breach");
    }
  };

  const handleAddVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading("VENDOR");
    const shared = vDataShared.split(",").map((c) => c.trim()).filter(Boolean);

    const res = await createVendor({
      vendorName: vName,
      vendorType: vType,
      dataShared: shared,
      purposeOfSharing: vPurpose,
      dpaStatus: vDpaStatus,
      ...(vDpaExpiry ? { dpaExpiresAt: vDpaExpiry } : {}),
    });
    setLoading(null);

    if (res.success) {
      setSuccessMsg("Vendor processor added successfully!");
      setShowVendorModal(false);
      setVName("");
      setVType("");
      setVDataShared("");
      setVPurpose("");
      setVDpaExpiry("");
      // Simulate reload
      const newV: Vendor = {
        id: Math.random().toString(),
        vendorName: vName,
        vendorType: vType,
        dataShared: shared,
        purposeOfSharing: vPurpose,
        dpaStatus: vDpaStatus,
        dpaExpiresAt: vDpaExpiry ? new Date(vDpaExpiry) : null,
      };
      setVendorList((prev) => [newV, ...prev]);
    } else {
      setErrorMsg(res.message || "Failed to add vendor");
    }
  };

  const handleToggleHold = async (recordId: string, table: "students" | "staff", currentHold: boolean) => {
    setLoading(`HOLD_${recordId}`);
    const res = await toggleLegalHold(recordId, table, !currentHold);
    setLoading(null);
    if (res.success) {
      setSuccessMsg("Legal hold status updated and logged to audit trail!");
    } else {
      setErrorMsg(res.message || "Failed to update legal hold");
    }
  };

  const handleManualRetentionRun = async () => {
    setLoading("RETENTION");
    const res = await triggerManualRetentionRun();
    setLoading(null);
    if (res.success && "softDeletedCount" in res) {
      setSuccessMsg(`Automated Purge Completed: Soft-deleted ${res.softDeletedCount} records; Hard-purged ${res.hardPurgedCount} records.`);
    } else {
      const errMsg = "message" in res ? res.message : "Failed to execute retention policy";
      setErrorMsg(String(errMsg));
    }
  };

  return (
    <div className="space-y-6">
      {/* Messages */}
      {successMsg && (
        <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 rounded-2xl text-sm flex justify-between items-center z-20">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg("")} className="font-bold text-xs hover:underline">Dismiss</button>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-2xl text-sm flex justify-between items-center z-20">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="font-bold text-xs hover:underline">Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 overflow-x-auto pb-1">
        {[
          { id: "overview", label: "Consent & Purges", icon: Shield },
          { id: "requests", label: "Rights Queue", icon: FileText },
          { id: "grievances", label: "Grievances", icon: AlertTriangle },
          { id: "vendors", label: "Vendor Processors", icon: Briefcase },
          { id: "breaches", label: "Breach Center", icon: AlertOctagon },
          { id: "explorer", label: "Audit Log Explorer", icon: Search },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`pb-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-1.5 shrink-0 ${
                activeTab === t.id
                  ? "border-indigo-600 text-indigo-650 dark:text-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}

      {/* Overview Consent & Purge */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Consent coverage */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">
                Real-Time Consent Coverage
              </h3>
              <p className="text-xs text-slate-400">
                Percentage of active students with granted consent flags (Total Active: <strong>{totalStudentsCount}</strong>).
              </p>
              <div className="flex flex-col gap-4">
                {consentMetrics.map((m) => (
                  <div key={m.purposeId} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-700 dark:text-slate-350">{m.labelEn}</span>
                      <span className="text-indigo-600">{m.percentage}% ({m.grantedCount} students)</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-650 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${m.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Retention and Purge scheduling */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">
                  Retention & Purge Center
                </h3>
                <button
                  onClick={handleManualRetentionRun}
                  disabled={loading === "RETENTION"}
                  className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider"
                >
                  {loading === "RETENTION" ? "Running Purge..." : "Run Retention Purge"}
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Active students/staff currently soft-deleted and scheduled for permanent hard purge (after 30-day grace period):
              </p>
              <div className="space-y-3 max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {softDeletedStudents.map((s) => {
                  const pName = `${decryptData(s.firstNameEncrypted) || ""} ${
                    decryptData(s.lastNameEncrypted) || ""
                  }`.trim();
                  const purgeDate = new Date(new Date(s.deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000);
                  const isHold = s.legalHold;

                  return (
                    <div key={s.id} className="pt-3 flex justify-between items-center">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{pName} (Student)</p>
                        <p className="text-[10px] text-slate-500">Purge due: {purgeDate.toLocaleDateString()}</p>
                      </div>
                      <button
                        onClick={() => handleToggleHold(s.id, "students", isHold)}
                        disabled={loading === `HOLD_${s.id}`}
                        className={`text-[9px] font-extrabold px-2.5 py-1.5 rounded-lg uppercase tracking-wider ${
                          isHold ? "bg-red-100 text-red-800" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        }`}
                      >
                        {isHold ? "Legal Hold Active" : "Place Legal Hold"}
                      </button>
                    </div>
                  );
                })}

                {softDeletedStaff.map((st) => {
                  const pName = `${decryptData(st.firstNameEncrypted) || ""} ${
                    decryptData(st.lastNameEncrypted) || ""
                  }`.trim();
                  const purgeDate = new Date(new Date(st.deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000);
                  const isHold = st.legalHold;

                  return (
                    <div key={st.id} className="pt-3 flex justify-between items-center">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{pName} (Staff)</p>
                        <p className="text-[10px] text-slate-500">Purge due: {purgeDate.toLocaleDateString()}</p>
                      </div>
                      <button
                        onClick={() => handleToggleHold(st.id, "staff", isHold)}
                        disabled={loading === `HOLD_${st.id}`}
                        className={`text-[9px] font-extrabold px-2.5 py-1.5 rounded-lg uppercase tracking-wider ${
                          isHold ? "bg-red-100 text-red-800" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        }`}
                      >
                        {isHold ? "Legal Hold Active" : "Place Legal Hold"}
                      </button>
                    </div>
                  );
                })}

                {softDeletedStudents.length === 0 && softDeletedStaff.length === 0 && (
                  <p className="text-xs text-slate-500 py-4 text-center">No records scheduled for deletion.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rights Requests SLA Queue */}
      {activeTab === "requests" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
            <h4 className="font-bold text-sm text-slate-800 dark:text-white">Active SLA Rights Requests Queue</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold">
                  <th className="p-3">Ticket</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">SLA Status</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Resolution Details</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {requests.map((r) => {
                  const hoursLeft = getSlaHoursLeft(r.dueAt);
                  const isOverdue = hoursLeft <= 0;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-850">
                      <td className="p-3 font-mono font-bold">{r.ticketNumber}</td>
                      <td className="p-3 font-bold text-slate-655">{r.requestType}</td>
                      <td className="p-3 text-slate-500 max-w-[200px] truncate">{r.description}</td>
                      <td className="p-3">
                        {r.status === "COMPLETED" || r.status === "REJECTED" ? (
                          <span className="text-slate-400">Resolved</span>
                        ) : isOverdue ? (
                          <span className="text-red-655 font-extrabold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> OVERDUE
                          </span>
                        ) : (
                          <span className="text-amber-600 font-bold flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 animate-pulse" /> {Math.ceil(hoursLeft / 24)}d left
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                            r.status === "COMPLETED"
                              ? "bg-green-105 text-green-800"
                              : r.status === "REJECTED"
                              ? "bg-red-105 text-red-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 italic max-w-[150px] truncate">
                        {r.responseDetails || "-"}
                      </td>
                      <td className="p-3 text-right">
                        {r.status === "SUBMITTED" && (
                          <button
                            onClick={() => setResolvingTicket({ id: r.id, type: "REQUEST" })}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider"
                          >
                            Resolve
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grievance Tickets */}
      {activeTab === "grievances" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
            <h4 className="font-bold text-sm text-slate-800 dark:text-white">Parent Grievance SLA Queue</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold">
                  <th className="p-3">Ticket</th>
                  <th className="p-3">Subject</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">SLA Status</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Resolution Details</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {grievances.map((g) => {
                  const hoursLeft = getSlaHoursLeft(g.dueAt);
                  const isOverdue = hoursLeft <= 0;

                  return (
                    <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-slate-850">
                      <td className="p-3 font-mono font-bold">{g.ticketNumber}</td>
                      <td className="p-3 font-bold text-slate-655">{g.subject}</td>
                      <td className="p-3 text-slate-500 max-w-[200px] truncate">{g.description}</td>
                      <td className="p-3">
                        {g.status === "COMPLETED" ? (
                          <span className="text-slate-400">Resolved</span>
                        ) : isOverdue ? (
                          <span className="text-red-655 font-extrabold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> OVERDUE
                          </span>
                        ) : (
                          <span className="text-amber-600 font-bold flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 animate-pulse" /> {Math.ceil(hoursLeft / 24)}d left
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                            g.status === "COMPLETED"
                              ? "bg-green-105 text-green-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {g.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 italic max-w-[150px] truncate">
                        {g.resolutionDetails || "-"}
                      </td>
                      <td className="p-3 text-right">
                        {g.status === "SUBMITTED" && (
                          <button
                            onClick={() => setResolvingTicket({ id: g.id, type: "GRIEVANCE" })}
                            className="bg-indigo-650 hover:bg-indigo-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider"
                          >
                            Resolve
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vendor Processors DPA */}
      {activeTab === "vendors" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">
              Vendor Register (Third-Party Data Processors)
            </h3>
            <button
              onClick={() => setShowVendorModal(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl"
            >
              Add Processor
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold">
                    <th className="p-3">Vendor Name</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Purpose</th>
                    <th className="p-3">DPA Status</th>
                    <th className="p-3">Shared Data Categories</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {vendorList.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-850">
                      <td className="p-3 font-bold text-slate-700 dark:text-slate-350">{v.vendorName}</td>
                      <td className="p-3 font-medium text-slate-500">{v.vendorType}</td>
                      <td className="p-3 text-slate-550 max-w-[200px] truncate">{v.purposeOfSharing}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                            v.dpaStatus === "SIGNED"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {v.dpaStatus}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500">
                        {Array.isArray(v.dataShared) ? v.dataShared.join(", ") : String(v.dataShared)}
                      </td>
                      <td className="p-3 text-right">
                        {v.dpaStatus !== "SIGNED" && (
                          <button
                            onClick={async () => {
                              setLoading(`V_${v.id}`);
                              const res = await updateVendorDpaStatus(v.id, "SIGNED");
                              setLoading(null);
                              if (res.success) {
                                setVendorList((prev) =>
                                  prev.map((item) =>
                                    item.id === v.id ? { ...item, dpaStatus: "SIGNED" } : item
                                  )
                                );
                                setSuccessMsg("Vendor DPA updated to SIGNED!");
                              }
                            }}
                            className="bg-indigo-650 hover:bg-indigo-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider"
                          >
                            Mark Signed
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Breach Center */}
      {activeTab === "breaches" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">
              Data Breach & Incident Management (72-hour board SLA)
            </h3>
            <button
              onClick={() => setShowBreachModal(true)}
              className="bg-red-600 hover:bg-red-750 text-white text-xs font-bold px-4 py-2 rounded-xl"
            >
              Report Breach
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {breachList.map((b) => {
              const hoursLeft = Math.round((new Date(b.boardNotificationDeadline).getTime() - Date.now()) / (1000 * 60 * 60));
              const isOverdue = hoursLeft <= 0;

              return (
                <div
                  key={b.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-6 rounded-2xl shadow-sm space-y-4"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-700 dark:text-slate-350">
                          {b.incidentReference}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                            b.severity === "CRITICAL" || b.severity === "HIGH"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-105 text-amber-800"
                          }`}
                        >
                          {b.severity}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[9px] rounded-full uppercase font-bold text-slate-500">
                          {b.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Detected: {new Date(b.detectedAt).toLocaleString()}
                      </p>
                    </div>

                    {/* 72h countdown status */}
                    <div className="text-right">
                      {b.status === "BOARD_NOTIFIED" || b.status === "PARENTS_NOTIFIED" || b.status === "CLOSED" ? (
                        <span className="text-xs font-bold text-emerald-650 flex items-center gap-1 justify-end">
                          <CheckCircle className="w-4 h-4" /> Board Notified
                        </span>
                      ) : isOverdue ? (
                        <span className="text-xs font-extrabold text-red-655 flex items-center gap-1 justify-end">
                          <AlertTriangle className="w-4 h-4" /> 72H SLA EXPIRED
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-amber-600 flex items-center gap-1 justify-end">
                          <Clock className="w-4 h-4 animate-pulse" /> {hoursLeft} hours left to notify Board
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                      <strong>Incident Details:</strong> {b.description}
                    </p>
                    <p className="text-xs text-slate-500">
                      <strong>Affected Records:</strong> {b.affectedRecordsCount} |{" "}
                      <strong>Affected Categories:</strong>{" "}
                      {Array.isArray(b.affectedDataCategories) ? b.affectedDataCategories.join(", ") : String(b.affectedDataCategories)}
                    </p>
                  </div>

                  {/* Actions to log board & parent notifications */}
                  <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                    {!b.boardNotifiedAt && (
                      <button
                        onClick={async () => {
                          setLoading(`BOARD_${b.id}`);
                          const res = await markBreachBoardNotified(b.id);
                          setLoading(null);
                          if (res.success) {
                            setBreachList((prev) =>
                              prev.map((item) =>
                                item.id === b.id
                                  ? { ...item, status: "BOARD_NOTIFIED", boardNotifiedAt: new Date() }
                                  : item
                              )
                            );
                            setSuccessMsg("Logged Board notification timestamp!");
                          }
                        }}
                        className="bg-indigo-650 hover:bg-indigo-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider"
                      >
                        Notify Board
                      </button>
                    )}
                    {!b.parentsNotifiedAt && (
                      <button
                        onClick={async () => {
                          setLoading(`PARENT_${b.id}`);
                          const res = await markBreachParentsNotified(b.id);
                          setLoading(null);
                          if (res.success) {
                            setBreachList((prev) =>
                              prev.map((item) =>
                                item.id === b.id
                                  ? { ...item, status: "PARENTS_NOTIFIED", parentsNotifiedAt: new Date() }
                                  : item
                              )
                            );
                            setSuccessMsg("Logged parent breach warnings notification templates dispatch!");
                          }
                        }}
                        className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-white text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider border border-slate-200 dark:border-slate-700"
                      >
                        Notify Parents
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {breachList.length === 0 && (
              <div className="p-12 text-center text-slate-500 bg-white dark:bg-slate-900 border rounded-2xl">
                No data breach incidents detected or logged. (Compliant State)
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audit Log Explorer */}
      {activeTab === "explorer" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Parent/User Email</label>
              <input
                type="text"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder="Filter by email..."
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-slate-850 dark:text-white focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Table Name</label>
              <input
                type="text"
                value={searchTable}
                onChange={(e) => setSearchTable(e.target.value)}
                placeholder="Filter by table (e.g. students)..."
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-slate-850 dark:text-white focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Audit Action</label>
              <select
                value={searchAction}
                onChange={(e) => setSearchAction(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-slate-850 dark:text-white focus:outline-none"
              >
                <option value="">All Actions</option>
                <option value="READ">READ (View PII)</option>
                <option value="WRITE">WRITE (Update PII)</option>
                <option value="DELETE">DELETE (Purge/Remove)</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold">
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">User Email</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Table Name</th>
                    <th className="p-3">Record ID</th>
                    <th className="p-3">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredLogs.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-850">
                      <td className="p-3 font-mono text-[10px] text-slate-500">
                        {new Date(l.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3 font-bold text-slate-700 dark:text-slate-350">{l.userEmail}</td>
                      <td className="p-3 font-semibold text-slate-500">{l.userRole}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                            l.action === "READ"
                              ? "bg-blue-100 text-blue-800"
                              : l.action === "WRITE"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {l.action}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-655 font-mono">{l.tableName}</td>
                      <td className="p-3 font-mono text-[10px] text-slate-450">{l.recordId || "-"}</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">{l.ipAddress}</td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">No logs match search filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Resolution Modal */}
      {resolvingTicket && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 rounded-2xl shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-wider">
              Resolve {resolvingTicket.type === "REQUEST" ? "Rights Request" : "Grievance Ticket"}
            </h3>

            {resolvingTicket.type === "REQUEST" && (
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    checked={resApprove}
                    onChange={() => setResApprove(true)}
                  />
                  Approve / Complete
                </label>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    checked={!resApprove}
                    onChange={() => setResApprove(false)}
                  />
                  Reject Request
                </label>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase">Resolution Notes / Action Taken</label>
              <textarea
                value={resDetails}
                onChange={(e) => setResDetails(e.target.value)}
                placeholder="Provide resolution details for this audit log..."
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-slate-855 dark:text-white focus:outline-none focus:border-indigo-500"
                rows={3}
                required
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResolvingTicket(null)}
                className="bg-white hover:bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-350 text-xs font-bold px-4 py-2.5 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResolveTicket}
                disabled={loading === "RESOLVE"}
                className="bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl"
              >
                Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Breach Modal */}
      {showBreachModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <form
            onSubmit={handleReportBreach}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 rounded-2xl shadow-xl space-y-4"
          >
            <h3 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <AlertOctagon className="w-5 h-5 text-red-600" /> Log Data Breach Incident
            </h3>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Severity</label>
              <select
                value={breachSeverity}
                onChange={(e: any) => setBreachSeverity(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-slate-850 dark:text-white focus:outline-none"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Incident Description</label>
              <textarea
                value={breachDesc}
                onChange={(e) => setBreachDesc(e.target.value)}
                placeholder="What occurred, what system was breached..."
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-slate-850 dark:text-white focus:outline-none"
                rows={2}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Affected Records Count</label>
                <input
                  type="number"
                  value={breachCount}
                  onChange={(e) => setBreachCount(parseInt(e.target.value) || 0)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-slate-850 dark:text-white focus:outline-none"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Data Categories (comma sep)</label>
                <input
                  type="text"
                  value={breachCategories}
                  onChange={(e) => setBreachCategories(e.target.value)}
                  placeholder="e.g. marks, addresses"
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-slate-850 dark:text-white focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Immediate Containment Actions Taken</label>
              <textarea
                value={breachActions}
                onChange={(e) => setBreachActions(e.target.value)}
                placeholder="e.g. Disabled compromised API endpoint, revoked DB credentials"
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-slate-850 dark:text-white focus:outline-none"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBreachModal(false)}
                className="bg-white hover:bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-350 text-xs font-bold px-4 py-2.5 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading === "BREACH"}
                className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl"
              >
                Log Incident
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Vendor Modal */}
      {showVendorModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <form
            onSubmit={handleAddVendor}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 rounded-2xl shadow-xl space-y-4"
          >
            <h3 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-wider">
              Add Third-Party Data Processor
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Vendor Name</label>
                <input
                  type="text"
                  value={vName}
                  onChange={(e) => setVName(e.target.value)}
                  placeholder="e.g. Razorpay"
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-slate-850 dark:text-white focus:outline-none"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Processor Type</label>
                <input
                  type="text"
                  value={vType}
                  onChange={(e) => setVType(e.target.value)}
                  placeholder="e.g. PAYMENT_GATEWAY"
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-slate-850 dark:text-white focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Data Categories Shared (comma sep)</label>
              <input
                type="text"
                value={vDataShared}
                onChange={(e) => setVDataShared(e.target.value)}
                placeholder="e.g. parent_name, fee_amount"
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-slate-850 dark:text-white focus:outline-none"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Purpose of Data Transfer</label>
              <input
                type="text"
                value={vPurpose}
                onChange={(e) => setVPurpose(e.target.value)}
                placeholder="e.g. Payment processing for school tuition fees"
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-slate-850 dark:text-white focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">DPA Status</label>
                <select
                  value={vDpaStatus}
                  onChange={(e: any) => setVDpaStatus(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-slate-850 dark:text-white focus:outline-none"
                >
                  <option value="SIGNED">SIGNED</option>
                  <option value="PENDING">PENDING</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Contract Expiry Date</label>
                <input
                  type="date"
                  value={vDpaExpiry}
                  onChange={(e) => setVDpaExpiry(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-slate-850 dark:text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowVendorModal(false)}
                className="bg-white hover:bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-350 text-xs font-bold px-4 py-2.5 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading === "VENDOR"}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl"
              >
                Add Processor
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
