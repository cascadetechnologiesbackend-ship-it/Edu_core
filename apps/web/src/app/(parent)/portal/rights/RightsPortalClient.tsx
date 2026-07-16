"use client";

import { useState } from "react";
import { raiseRightsRequest, raiseGrievanceTicket, fetchStudentCompleteData } from "../actions";
import { Shield, FileText, Copy } from "lucide-react";
import { decryptData } from "@/lib/encryption";

interface Student {
  id: string;
  firstNameEncrypted: string;
  lastNameEncrypted: string;
  admissionNumber: string;
}

interface RightsRequest {
  id: string;
  ticketNumber: string;
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

interface Props {
  students: Student[];
  initialRequests: RightsRequest[];
  initialGrievances: Grievance[];
}

export default function RightsPortalClient({
  students,
  initialRequests,
  initialGrievances,
}: Props) {
  const [activeStudentId, setActiveStudentId] = useState(students[0]?.id || "");
  const [requests, setRequests] = useState<RightsRequest[]>(initialRequests);
  const [grievances, setGrievances] = useState<Grievance[]>(initialGrievances);

  // Forms
  const [correctionDesc, setCorrectionDesc] = useState("");
  const [erasureDesc, setErasureDesc] = useState("");
  const [grievanceSubject, setGrievanceSubject] = useState("");
  const [grievanceDesc, setGrievanceDesc] = useState("");

  // Loading/Messages
  const [loading, setLoading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // JSON View Data
  const [jsonData, setJsonData] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const activeStudent = students.find((s) => s.id === activeStudentId);
  const activeStudentName = activeStudent
    ? `${decryptData(activeStudent.firstNameEncrypted) || ""} ${
        decryptData(activeStudent.lastNameEncrypted) || ""
      }`.trim()
    : "Student";

  const handleFetchData = async () => {
    setLoading("FETCH_DATA");
    setJsonData(null);
    const res = await fetchStudentCompleteData(activeStudentId);
    setLoading(null);
    if (res.success) {
      setJsonData(res.data);
    } else {
      setErrorMsg(res.message || "Failed to fetch student data");
    }
  };

  const handleCopyJson = () => {
    if (!jsonData) return;
    navigator.clipboard.writeText(JSON.stringify(jsonData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionDesc.trim()) return;

    setLoading("CORRECTION");
    const res = await raiseRightsRequest({
      studentId: activeStudentId,
      requestType: "CORRECTION",
      description: correctionDesc,
    });
    setLoading(null);

    if (res.success) {
      setSuccessMsg(`Correction request submitted! Ticket: ${res.ticketNumber}`);
      setCorrectionDesc("");
      // Add to local requests listing
      const newReq: RightsRequest = {
        id: Math.random().toString(),
        ticketNumber: res.ticketNumber || "RR-TEMP",
        requestType: "CORRECTION",
        description: correctionDesc,
        status: "SUBMITTED",
        dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      };
      setRequests((prev) => [newReq, ...prev]);
    } else {
      setErrorMsg(res.message || "Failed to submit request");
    }
  };

  const handleSubmitErasure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!erasureDesc.trim()) return;

    setLoading("ERASURE");
    const res = await raiseRightsRequest({
      studentId: activeStudentId,
      requestType: "ERASURE",
      description: erasureDesc,
    });
    setLoading(null);

    if (res.success) {
      setSuccessMsg(`Erasure request submitted! Deletion sequence has started. Ticket: ${res.ticketNumber}`);
      setErasureDesc("");
      const newReq: RightsRequest = {
        id: Math.random().toString(),
        ticketNumber: res.ticketNumber || "RR-TEMP",
        requestType: "ERASURE",
        description: erasureDesc,
        status: "SUBMITTED",
        dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      };
      setRequests((prev) => [newReq, ...prev]);
    } else {
      setErrorMsg(res.message || "Failed to submit request");
    }
  };

  const handleSubmitGrievance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grievanceSubject.trim() || !grievanceDesc.trim()) return;

    setLoading("GRIEVANCE");
    const res = await raiseGrievanceTicket({
      subject: grievanceSubject,
      description: grievanceDesc,
    });
    setLoading(null);

    if (res.success) {
      setSuccessMsg(`Grievance ticket raised! Ticket: ${res.ticketNumber}`);
      setGrievanceSubject("");
      setGrievanceDesc("");
      const newGriev: Grievance = {
        id: Math.random().toString(),
        ticketNumber: res.ticketNumber || "GR-TEMP",
        subject: grievanceSubject,
        description: grievanceDesc,
        status: "SUBMITTED",
        dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      };
      setGrievances((prev) => [newGriev, ...prev]);
    } else {
      setErrorMsg(res.message || "Failed to raise grievance");
    }
  };

  return (
    <div className="space-y-8">
      {/* Messages */}
      {successMsg && (
        <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 text-green-800 dark:text-green-300 rounded-2xl text-sm flex justify-between items-center">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg("")} className="font-bold text-xs hover:underline">Dismiss</button>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 rounded-2xl text-sm flex justify-between items-center">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="font-bold text-xs hover:underline">Dismiss</button>
        </div>
      )}

      {/* Student Selector */}
      {students.length > 1 && (
        <div className="flex border border-slate-200 dark:border-slate-800 rounded-xl p-1 bg-slate-50 dark:bg-slate-900 max-w-md">
          {students.map((s) => {
            const name = `${decryptData(s.firstNameEncrypted) || ""} ${
              decryptData(s.lastNameEncrypted) || ""
            }`.trim();
            return (
              <button
                key={s.id}
                onClick={() => {
                  setActiveStudentId(s.id);
                  setJsonData(null);
                }}
                className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
                  activeStudentId === s.id
                    ? "bg-white dark:bg-slate-800 text-indigo-650 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
      )}

      {/* exercise sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* View Data Right */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <Shield className="w-5 h-5" />
            <h3 className="font-bold text-base">Right to Access Data</h3>
          </div>
          <p className="text-xs text-slate-500">
            You have the legal right under Section 11 of the DPDP Act to obtain a summary of {activeStudentName}&apos;s personal data processed by the school.
          </p>
          <button
            onClick={handleFetchData}
            disabled={loading === "FETCH_DATA"}
            className="w-full bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-bold py-2.5 rounded-xl transition-all uppercase tracking-wider"
          >
            {loading === "FETCH_DATA" ? "Retrieving Ledger..." : "View My Child's Data"}
          </button>
        </div>

        {/* Correction Right */}
        <form
          onSubmit={handleSubmitCorrection}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4"
        >
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <FileText className="w-5 h-5" />
            <h3 className="font-bold text-base">Right to Correction</h3>
          </div>
          <p className="text-xs text-slate-500">
            Request correction of inaccurate or incomplete personal information for {activeStudentName} (e.g. spelling corrections, updated family contact details).
          </p>
          <textarea
            value={correctionDesc}
            onChange={(e) => setCorrectionDesc(e.target.value)}
            placeholder="Describe the inaccurate field and what the correct value should be..."
            className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-slate-850 dark:text-white focus:outline-none focus:border-indigo-500"
            rows={2}
            required
          />
          <button
            type="submit"
            disabled={loading === "CORRECTION"}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold py-2.5 rounded-xl transition-all uppercase tracking-wider"
          >
            {loading === "CORRECTION" ? "Submitting..." : "Submit Correction Request"}
          </button>
        </form>

        {/* Erasure Right */}
        <form
          onSubmit={handleSubmitErasure}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4"
        >
          <div className="flex items-center gap-2 text-red-655 dark:text-red-400">
            <Shield className="w-5 h-5" />
            <h3 className="font-bold text-base">Right to Erasure</h3>
          </div>
          <p className="text-xs text-slate-500">
            Request erasure of personal data that is no longer necessary for {activeStudentName}&apos;s school admission purpose. Initiates a mandatory 30-day workflow.
          </p>
          <textarea
            value={erasureDesc}
            onChange={(e) => setErasureDesc(e.target.value)}
            placeholder="Describe which data should be erased and reason..."
            className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-slate-850 dark:text-white focus:outline-none focus:border-indigo-500"
            rows={2}
            required
          />
          <button
            type="submit"
            disabled={loading === "ERASURE"}
            className="w-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-2.5 rounded-xl transition-all uppercase tracking-wider"
          >
            {loading === "ERASURE" ? "Submitting..." : "Submit Erasure Request"}
          </button>
        </form>
      </div>

      {/* JSON Viewer */}
      {jsonData && (
        <div className="bg-slate-950 text-slate-100 p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex justify-between items-center">
            <span className="font-mono text-xs text-slate-400 font-bold uppercase tracking-wider">
              Student Personal Data Summary Ledger (SAR Export)
            </span>
            <button
              onClick={handleCopyJson}
              className="bg-slate-900 hover:bg-slate-850 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-1.5 transition-all"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? "Copied!" : "Copy JSON"}
            </button>
          </div>
          <div className="overflow-auto max-h-96 font-mono text-xs p-3 bg-slate-900/60 rounded-xl border border-slate-850 text-emerald-400">
            <pre>{JSON.stringify(jsonData, null, 2)}</pre>
          </div>
        </div>
      )}

      {/* Raise Grievance */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
        <h3 className="font-bold text-base text-slate-800 dark:text-white mb-4">
          Grievance Redressal (Section 13)
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          If you have a query, issue, or complaint regarding how your minor child&apos;s data is handled, raise a grievance ticket directly to the Data Protection Officer (DPO). The school resolves grievances within a maximum SLA of 30 days.
        </p>

        <form onSubmit={handleSubmitGrievance} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3 md:col-span-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase">Subject</label>
              <input
                type="text"
                value={grievanceSubject}
                onChange={(e) => setGrievanceSubject(e.target.value)}
                placeholder="e.g. Consent withdrawal delay, mismatch in health records"
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-slate-850 dark:text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase">Detailed Description</label>
              <textarea
                value={grievanceDesc}
                onChange={(e) => setGrievanceDesc(e.target.value)}
                placeholder="Provide detailed description of your grievance..."
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-slate-850 dark:text-white focus:outline-none focus:border-indigo-500"
                rows={3}
                required
              />
            </div>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={loading === "GRIEVANCE"}
              className="bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-bold px-6 py-2.5 rounded-xl uppercase tracking-wider shadow-md"
            >
              {loading === "GRIEVANCE" ? "Raising Ticket..." : "Submit Grievance Ticket"}
            </button>
          </div>
        </form>
      </div>

      {/* Ticket Logs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Rights Requests Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
            <h4 className="font-bold text-sm text-slate-850 dark:text-white">Rights Requests Log</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold">
                  <th className="p-3">Ticket</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">SLA Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-850">
                    <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-350">{r.ticketNumber}</td>
                    <td className="p-3 font-semibold text-slate-650 dark:text-slate-400">{r.requestType}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                          r.status === "COMPLETED"
                            ? "bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 font-medium">
                      {new Date(r.dueAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {requests.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">No requests raised yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Grievances Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
            <h4 className="font-bold text-sm text-slate-850 dark:text-white">Grievances Tickets Log</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold">
                  <th className="p-3">Ticket</th>
                  <th className="p-3">Subject</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">SLA Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {grievances.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-slate-850">
                    <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-350">{g.ticketNumber}</td>
                    <td className="p-3 font-semibold text-slate-650 dark:text-slate-400 truncate max-w-[150px]">{g.subject}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                          g.status === "COMPLETED"
                            ? "bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                        }`}
                      >
                        {g.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 font-medium">
                      {new Date(g.dueAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {grievances.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">No grievances raised yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
