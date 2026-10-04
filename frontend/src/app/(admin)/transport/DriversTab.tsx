"use client";

import { useState } from "react";
import {
  User,
  Plus,
  Bus,
  Phone,
  FileText,
  Mail,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  KeyRound,
  AlertCircle,
} from "lucide-react";
import {
  createDriver,
  toggleDriverStatus,
  deleteDriver,
} from "./actions";

interface DriverItem {
  id: string;
  name: string;
  mobile: string;
  licenceNumber: string;
  vehicleId: string | null;
  vehicleBusNumber: string | null;
  vehicleRegNumber: string | null;
  loginEmail: string;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date | string;
}

interface DriversTabProps {
  driversList: DriverItem[];
  vehiclesList: any[];
  isAdmin: boolean;
}

export default function DriversTab({
  driversList: initialDrivers,
  vehiclesList,
  isAdmin,
}: DriversTabProps) {
  const [drivers, setDrivers] = useState<DriverItem[]>(initialDrivers);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdInfo, setCreatedInfo] = useState<{
    email: string;
    password: string;
    name: string;
  } | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [licenceNumber, setLicenceNumber] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [email, setEmail] = useState("");

  const resetForm = () => {
    setName("");
    setMobile("");
    setLicenceNumber("");
    setVehicleId("");
    setEmail("");
    setError(null);
  };

  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !mobile.trim() || !licenceNumber.trim()) {
      setError("Name, mobile number, and licence number are required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await createDriver({
        name,
        mobile,
        licenceNumber,
        vehicleId: vehicleId || undefined,
        email: email || undefined,
      });

      if (!res.success) {
        setError(res.message || "Failed to create driver");
        setLoading(false);
        return;
      }

      setCreatedInfo({
        name,
        email: res.loginEmail || "",
        password: res.defaultPassword || "",
      });

      // Update local state
      const newDriver: DriverItem = {
        id: res.driverId || String(Date.now()),
        name,
        mobile,
        licenceNumber,
        vehicleId: vehicleId || null,
        vehicleBusNumber:
          vehiclesList.find((v) => v.id === vehicleId)?.busNumber || null,
        vehicleRegNumber:
          vehiclesList.find((v) => v.id === vehicleId)?.registrationNumber ||
          null,
        loginEmail: res.loginEmail || "",
        isActive: true,
        mustChangePassword: true,
        createdAt: new Date(),
      };

      setDrivers([newDriver, ...drivers]);
      resetForm();
    } catch (err: any) {
      setError(err?.message || "Failed to create driver.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, current: boolean) => {
    try {
      await toggleDriverStatus(id, !current);
      setDrivers(
        drivers.map((d) => (d.id === id ? { ...d, isActive: !current } : d))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate and remove this driver?"))
      return;
    try {
      await deleteDriver(id);
      setDrivers(drivers.filter((d) => d.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 border border-slate-800 text-white shadow-lg">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-400" />
            School Bus Drivers & Login Accounts
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Register bus drivers with authorized DRIVER role accounts. Drivers receive their login credentials via SMS with a link to the mobile PWA driver app.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              resetForm();
              setCreatedInfo(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm transition shadow-md shadow-indigo-600/20 whitespace-nowrap self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Add New Driver
          </button>
        )}
      </div>

      {/* Drivers Table / Cards */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800/60 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider border-b border-gray-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Driver Name</th>
                <th className="py-3.5 px-4">Contact & Licence</th>
                <th className="py-3.5 px-4">Assigned Vehicle</th>
                <th className="py-3.5 px-4">PWA Login Username</th>
                <th className="py-3.5 px-4">Account Status</th>
                {isAdmin && <th className="py-3.5 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60 text-gray-800 dark:text-slate-200 font-medium">
              {drivers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-gray-400 dark:text-slate-500 text-sm"
                  >
                    No drivers registered yet. Click &quot;Add New Driver&quot; to create a driver account.
                  </td>
                </tr>
              ) : (
                drivers.map((driver) => (
                  <tr
                    key={driver.id}
                    className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                          {driver.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {driver.name}
                          </div>
                          <div className="text-xs text-gray-400 dark:text-slate-500">
                            Registered on{" "}
                            {new Date(driver.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-slate-300">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          <span>{driver.mobile}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
                          <FileText className="w-3.5 h-3.5 text-gray-400" />
                          <span>Licence: {driver.licenceNumber}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {driver.vehicleBusNumber ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                          <Bus className="w-3.5 h-3.5" />
                          {driver.vehicleBusNumber}
                          {driver.vehicleRegNumber && (
                            <span className="text-gray-400 dark:text-slate-500 font-normal">
                              ({driver.vehicleRegNumber})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-slate-500 italic">
                          Unassigned
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-mono text-gray-600 dark:text-slate-400">
                          <Mail className="w-3.5 h-3.5 text-gray-400" />
                          {driver.loginEmail}
                        </div>
                        {driver.mustChangePassword ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <KeyRound className="w-2.5 h-2.5" /> First Login Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <ShieldCheck className="w-2.5 h-2.5" /> Password Set
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {driver.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                          <CheckCircle className="w-3.5 h-3.5" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40">
                          <XCircle className="w-3.5 h-3.5" /> Inactive
                        </span>
                      )}
                    </td>

                    {isAdmin && (
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() =>
                              handleToggleStatus(driver.id, driver.isActive)
                            }
                            className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 transition"
                          >
                            {driver.isActive ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            onClick={() => handleDelete(driver.id)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                            title="Delete Driver"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Driver Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Add New Bus Driver
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Creates an authorized driver account with mobile PWA access.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1"
              >
                ✕
              </button>
            </div>

            {createdInfo ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-400">
                    <CheckCircle className="w-5 h-5" /> Driver Account Created!
                  </div>
                  <p className="text-xs text-slate-300">
                    Credentials have been sent to the driver via SMS. Please share these details with the driver:
                  </p>
                  <div className="bg-slate-900/90 p-3 rounded-lg font-mono text-xs text-slate-200 space-y-1 border border-slate-800">
                    <div>
                      <span className="text-slate-400">Driver:</span> {createdInfo.name}
                    </div>
                    <div>
                      <span className="text-slate-400">Login Username:</span>{" "}
                      <span className="text-indigo-400">{createdInfo.email}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Default Password:</span>{" "}
                      <span className="text-emerald-400">{createdInfo.password}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    The driver will be prompted to change their password when they first log in.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setCreatedInfo(null);
                  }}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateDriver} className="space-y-4">
                {error && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1">
                    Driver Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1">
                      10-Digit Mobile *
                    </label>
                    <input
                      type="tel"
                      required
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-[10px] text-gray-400 dark:text-slate-500">
                      Used for default password `Driver@last4`
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1">
                      Driving Licence No. *
                    </label>
                    <input
                      type="text"
                      required
                      value={licenceNumber}
                      onChange={(e) => setLicenceNumber(e.target.value)}
                      placeholder="e.g. MH122020000456"
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1">
                    Assigned Vehicle
                  </label>
                  <select
                    value={vehicleId}
                    onChange={(e) => setVehicleId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- No vehicle assigned initially --</option>
                    {vehiclesList.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.busNumber} ({v.registrationNumber}) - Capacity: {v.capacity}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1">
                    Custom Login Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Auto-generated if left blank"
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 font-medium text-sm transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-md shadow-indigo-600/20 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Driver & Send SMS"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
