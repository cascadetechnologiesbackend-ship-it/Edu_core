"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBusPass } from "./actions";
import {
  Plus,
  QrCode,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from "lucide-react";

type RouteStop = {
  id: string;
  stopName: string;
  stopOrder: number;
};

type Route = {
  id: string;
  routeName: string;
  stops: RouteStop[];
};

type StudentWithConsent = {
  id: string;
  name: string;
  hasTransportConsent: boolean;
};

type BusPass = {
  id: string;
  passNumber: string;
  studentId: string;
  routeId: string;
  routeStopId: string;
  validFrom: string;
  validTo: string;
  qrCodeData: string;
  studentName: string;
  routeName: string;
  stopName: string;
};

export default function BusPassesTab({
  passes,
  students,
  routes,
  isAdmin,
}: {
  passes: BusPass[];
  students: StudentWithConsent[];
  routes: Route[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [formData, setFormData] = useState({
    studentId: "",
    routeId: "",
    routeStopId: "",
    validFrom: new Date().toISOString().split("T")[0] || "",
    validTo:
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0] || "",
  });

  const selectedStudent = students.find((s) => s.id === formData.studentId);
  const selectedRoute = routes.find((r) => r.id === formData.routeId);
  const stopsForSelectedRoute = selectedRoute?.stops || [];

  const handleOpenForm = () => {
    setFormData({
      studentId: students[0]?.id || "",
      routeId: routes[0]?.id || "",
      routeStopId: routes[0]?.stops[0]?.id || "",
      validFrom: new Date().toISOString().split("T")[0] || "",
      validTo:
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0] || "",
    });
    setErrorMsg("");
    setSuccessMsg("");
    setShowForm(true);
  };

  const handleRouteSelectChange = (routeId: string) => {
    const routeObj = routes.find((r) => r.id === routeId);
    setFormData((prev) => ({
      ...prev,
      routeId,
      routeStopId: routeObj?.stops[0]?.id || "",
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    // Extra safeguard: UI prevention
    if (selectedStudent && !selectedStudent.hasTransportConsent) {
      setErrorMsg(
        "DPDP Compliance Block: Verifiable parental consent is missing or withdrawn for transport data processing.",
      );
      return;
    }

    startTransition(async () => {
      try {
        const res = await saveBusPass(formData);
        if (res.success) {
          setSuccessMsg(`Successfully created Bus Pass ${res.passNumber}!`);
          setTimeout(() => {
            setShowForm(false);
            router.refresh();
          }, 1500);
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to create bus pass.");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">
          Student Bus Passes Directory
        </h2>
        {isAdmin && (
          <button
            onClick={handleOpenForm}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            <Plus className="w-4 h-4" /> Map Student / Issue Pass
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 shadow border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {passes.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-gray-500">
            <QrCode className="w-12 h-12 mb-3 text-gray-300 animate-pulse" />
            <p className="font-semibold text-sm">
              No student bus passes generated yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800 text-left text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Pass Number</th>
                  <th className="px-6 py-3">Student Name</th>
                  <th className="px-6 py-3">Assigned Route & Stop</th>
                  <th className="px-6 py-3">Validity</th>
                  <th className="px-6 py-3">Offline Pass Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                {passes.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-gray-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                      {p.passNumber}
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                      {p.studentName}
                    </td>
                    <td className="px-6 py-4">
                      <div>{p.routeName}</div>
                      <div className="text-xs text-gray-400">
                        Stop: {p.stopName}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      <div>
                        From: {new Date(p.validFrom).toLocaleDateString()}
                      </div>
                      <div>To: {new Date(p.validTo).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-gray-100 dark:bg-slate-800 p-2 rounded-lg border border-gray-200 dark:border-slate-700 flex items-center justify-center">
                          <QrCode className="w-8 h-8 text-primary" />
                        </div>
                        <div
                          className="text-[10px] text-gray-400 font-mono select-all max-w-[200px] truncate"
                          title={p.qrCodeData}
                        >
                          {p.qrCodeData}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-md w-full border border-gray-200 dark:border-slate-800 space-y-4 shadow-xl"
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Map Student & Issue Pass
            </h3>

            {errorMsg && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-3 rounded-lg flex items-start gap-2 text-xs text-red-800 dark:text-red-400">
                <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 p-3 rounded-lg flex items-start gap-2 text-xs text-green-800 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Student Name *
              </label>
              <select
                value={formData.studentId}
                onChange={(e) =>
                  setFormData({ ...formData, studentId: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {!s.hasTransportConsent && "(No Consent)"}
                  </option>
                ))}
              </select>
            </div>

            {/* DPDP Consent Indicator */}
            {selectedStudent && (
              <div
                className={`p-3 rounded-lg border text-xs flex gap-2 items-start ${
                  selectedStudent.hasTransportConsent
                    ? "bg-green-50 dark:bg-green-950/10 border-green-200 dark:border-green-900 text-green-800 dark:text-green-400"
                    : "bg-amber-50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-400"
                }`}
              >
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    {selectedStudent.hasTransportConsent
                      ? "Verifiable Consent Active"
                      : "Verifiable Consent Missing / Withdrawn"}
                  </p>
                  <p className="text-[10px] opacity-90 mt-0.5">
                    {selectedStudent.hasTransportConsent
                      ? "Parental consent verified for transport processing. Pass generation is authorized under DPDP Act Sec 9."
                      : "Parental consent is not active. Allocations will be blocked by system security policies."}
                  </p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Route *
              </label>
              <select
                value={formData.routeId}
                onChange={(e) => handleRouteSelectChange(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              >
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.routeName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Route Stop *
              </label>
              <select
                value={formData.routeStopId}
                onChange={(e) =>
                  setFormData({ ...formData, routeStopId: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              >
                {stopsForSelectedRoute.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.stopName}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Valid From *
                </label>
                <input
                  type="date"
                  required
                  value={formData.validFrom}
                  onChange={(e) =>
                    setFormData({ ...formData, validFrom: e.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Valid To *
                </label>
                <input
                  type="date"
                  required
                  value={formData.validTo}
                  onChange={(e) =>
                    setFormData({ ...formData, validTo: e.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  isPending ||
                  (selectedStudent && !selectedStudent.hasTransportConsent)
                }
                className="bg-primary hover:bg-primary/95 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60 flex items-center gap-1"
              >
                {isPending && (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                )}
                Map & Issue Pass
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
