"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveVehicle } from "./actions";
import { Plus, Bus, ShieldAlert, RefreshCw } from "lucide-react";

type Vehicle = {
  id: string;
  busNumber: string;
  registrationNumber: string;
  capacity: number;
  make: string | null;
  model: string | null;
  yearOfManufacture: number | null;
  driverName: string;
  driverLicence: string;
  driverMobile: string;
  conductorName: string | null;
  conductorMobile: string | null;
};

export default function VehiclesTab({
  vehicles,
  isAdmin,
}: {
  vehicles: Vehicle[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    busNumber: "",
    registrationNumber: "",
    capacity: 40,
    make: "",
    model: "",
    yearOfManufacture: new Date().getFullYear(),
    driverName: "",
    driverLicence: "",
    driverMobile: "",
    conductorName: "",
    conductorMobile: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await saveVehicle(formData);
      setShowForm(false);
      // Reset form
      setFormData({
        busNumber: "",
        registrationNumber: "",
        capacity: 40,
        make: "",
        model: "",
        yearOfManufacture: new Date().getFullYear(),
        driverName: "",
        driverLicence: "",
        driverMobile: "",
        conductorName: "",
        conductorMobile: "",
      });
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">Vehicles & Drivers Directory</h2>
        {isAdmin && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            <Plus className="w-4 h-4" /> Add Vehicle
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 shadow border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {vehicles.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-gray-500">
            <Bus className="w-12 h-12 mb-3 text-gray-300 animate-pulse" />
            <p className="font-semibold text-sm">No vehicles registered yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800 text-left text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Bus Number</th>
                  <th className="px-6 py-3">Registration</th>
                  <th className="px-6 py-3">Capacity</th>
                  <th className="px-6 py-3">Driver Details (PII Encrypted)</th>
                  <th className="px-6 py-3">Conductor</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                {vehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">{v.busNumber}</td>
                    <td className="px-6 py-4">
                      <div>{v.registrationNumber}</div>
                      <div className="text-xs text-gray-400">
                        {v.make} {v.model} ({v.yearOfManufacture})
                      </div>
                    </td>
                    <td className="px-6 py-4">{v.capacity} Seats</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900 dark:text-white">{v.driverName}</div>
                      <div className="text-xs text-gray-400">Licence: {v.driverLicence}</div>
                      <div className="text-xs text-gray-400">Mobile: {v.driverMobile}</div>
                    </td>
                    <td className="px-6 py-4">
                      {v.conductorName ? (
                        <>
                          <div className="text-gray-900 dark:text-white">{v.conductorName}</div>
                          <div className="text-xs text-gray-400">{v.conductorMobile}</div>
                        </>
                      ) : (
                        <span className="text-gray-400 italic">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Active
                      </span>
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
            className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-lg w-full border border-gray-200 dark:border-slate-800 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Register New Vehicle</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Bus Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BUS-03"
                  value={formData.busNumber}
                  onChange={(e) => setFormData({ ...formData, busNumber: e.target.value })}
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Registration Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MH-12-AB-1234"
                  value={formData.registrationNumber}
                  onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Capacity *</label>
                <input
                  type="number"
                  required
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Make</label>
                <input
                  type="text"
                  placeholder="Tata / Ashok Leyland"
                  value={formData.make}
                  onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Model</label>
                <input
                  type="text"
                  placeholder="Starbus"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-slate-800 pt-4 space-y-4">
              <h4 className="font-semibold text-sm text-primary">Driver Details (Mandatory PII Encryption)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Driver Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.driverName}
                    onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Licence Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.driverLicence}
                    onChange={(e) => setFormData({ ...formData, driverLicence: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Driver Mobile *</label>
                <input
                  type="text"
                  required
                  value={formData.driverMobile}
                  onChange={(e) => setFormData({ ...formData, driverMobile: e.target.value })}
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-slate-800 pt-4 space-y-4">
              <h4 className="font-semibold text-sm text-primary">Conductor Details (Optional)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Conductor Name</label>
                  <input
                    type="text"
                    value={formData.conductorName}
                    onChange={(e) => setFormData({ ...formData, conductorName: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Conductor Mobile</label>
                  <input
                    type="text"
                    value={formData.conductorMobile}
                    onChange={(e) => setFormData({ ...formData, conductorMobile: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
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
                disabled={isPending}
                className="bg-primary hover:bg-primary/95 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60 flex items-center gap-1"
              >
                {isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Save Vehicle
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
