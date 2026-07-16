"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveRoute, saveRouteStop } from "./actions";
import { Plus, MapPin, RefreshCw, Navigation } from "lucide-react";

type RouteStop = {
  id: string;
  stopName: string;
  stopOrder: number;
  gpsLatitude: string | null;
  gpsLongitude: string | null;
  estimatedArrivalTime: string | null;
};

type Vehicle = {
  id: string;
  busNumber: string;
  registrationNumber: string;
};

type Route = {
  id: string;
  routeName: string;
  routeCode: string | null;
  vehicleId: string | null;
  stops: RouteStop[];
  vehicle: Vehicle | null;
};

export default function RoutesStopsTab({
  routesList,
  vehicles,
  isAdmin,
}: {
  routesList: Route[];
  vehicles: Vehicle[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [showRouteForm, setShowRouteForm] = useState(false);
  const [showStopForm, setShowStopForm] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState("");

  const [routeData, setRouteData] = useState({
    routeName: "",
    routeCode: "",
    vehicleId: "",
  });

  const [stopData, setStopData] = useState({
    stopName: "",
    stopOrder: 1,
    gpsLatitude: "",
    gpsLongitude: "",
    estimatedArrivalTime: "07:30",
  });

  const handleRouteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await saveRoute({
        routeName: routeData.routeName,
        routeCode: routeData.routeCode,
        ...(routeData.vehicleId ? { vehicleId: routeData.vehicleId } : {}),
      });
      setShowRouteForm(false);
      setRouteData({ routeName: "", routeCode: "", vehicleId: "" });
      router.refresh();
    });
  };

  const handleStopSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await saveRouteStop({
        routeId: selectedRouteId,
        stopName: stopData.stopName,
        stopOrder: stopData.stopOrder,
        estimatedArrivalTime: stopData.estimatedArrivalTime,
        ...(stopData.gpsLatitude ? { gpsLatitude: stopData.gpsLatitude } : {}),
        ...(stopData.gpsLongitude
          ? { gpsLongitude: stopData.gpsLongitude }
          : {}),
      });
      setShowStopForm(false);
      setStopData({
        stopName: "",
        stopOrder: 1,
        gpsLatitude: "",
        gpsLongitude: "",
        estimatedArrivalTime: "07:30",
      });
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">
          Routes & Stops Directory
        </h2>
        {isAdmin && (
          <button
            onClick={() => {
              if (vehicles.length > 0) {
                setRouteData((prev) => ({
                  ...prev,
                  vehicleId: vehicles[0]?.id || "",
                }));
              }
              setShowRouteForm(true);
            }}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            <Plus className="w-4 h-4" /> Add Route
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {routesList.length === 0 ? (
          <div className="md:col-span-2 bg-white dark:bg-slate-900 shadow border border-gray-200 dark:border-slate-800 rounded-xl p-12 text-center text-gray-500">
            <Navigation className="w-12 h-12 mx-auto mb-3 text-gray-300 animate-pulse" />
            <p className="font-semibold text-sm">
              No transport routes created yet.
            </p>
          </div>
        ) : (
          routesList.map((route) => (
            <div
              key={route.id}
              className="bg-white dark:bg-slate-900 shadow border border-gray-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                    {route.routeName}
                  </h3>
                  <p className="text-xs text-gray-400">
                    Route Code: {route.routeCode || "N/A"} | Assigned Bus:{" "}
                    {route.vehicle ? route.vehicle.busNumber : "None"}
                  </p>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => {
                      setSelectedRouteId(route.id);
                      setStopData((prev) => ({
                        ...prev,
                        stopOrder: route.stops.length + 1,
                      }));
                      setShowStopForm(true);
                    }}
                    className="flex items-center gap-1 text-primary hover:text-primary/90 text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Stop
                  </button>
                )}
              </div>

              {/* Stops Timeline */}
              <div className="space-y-4 relative border-l-2 border-gray-100 dark:border-slate-800 pl-4 ml-2">
                {route.stops.length === 0 ? (
                  <p className="text-xs text-gray-500 italic pl-2">
                    No stops added yet.
                  </p>
                ) : (
                  route.stops
                    .sort((a, b) => a.stopOrder - b.stopOrder)
                    .map((stop) => (
                      <div
                        key={stop.id}
                        className="relative flex justify-between items-start group"
                      >
                        {/* Circle Bullet */}
                        <div className="absolute -left-[23px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-white dark:ring-slate-900" />
                        <div>
                          <p className="text-sm font-semibold text-gray-800 dark:text-white pl-2">
                            {stop.stopOrder}. {stop.stopName}
                          </p>
                          {stop.gpsLatitude && (
                            <p className="text-[10px] text-gray-400 pl-2">
                              GPS: {stop.gpsLatitude}, {stop.gpsLongitude}
                            </p>
                          )}
                        </div>
                        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          {stop.estimatedArrivalTime || "--:--"}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showRouteForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleRouteSubmit}
            className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-md w-full border border-gray-200 dark:border-slate-800 space-y-4 shadow-xl"
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Create Transport Route
            </h3>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Route Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Route 3 - Karve Road"
                value={routeData.routeName}
                onChange={(e) =>
                  setRouteData({ ...routeData, routeName: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Route Code
              </label>
              <input
                type="text"
                placeholder="e.g. R-03"
                value={routeData.routeCode}
                onChange={(e) =>
                  setRouteData({ ...routeData, routeCode: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Assigned Vehicle
              </label>
              <select
                value={routeData.vehicleId}
                onChange={(e) =>
                  setRouteData({ ...routeData, vehicleId: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Unassigned</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.busNumber} ({v.registrationNumber})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowRouteForm(false)}
                className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="bg-primary hover:bg-primary/95 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60 flex items-center gap-1"
              >
                {isPending && (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                )}
                Create Route
              </button>
            </div>
          </form>
        </div>
      )}

      {showStopForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleStopSubmit}
            className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-md w-full border border-gray-200 dark:border-slate-800 space-y-4 shadow-xl"
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Add Stop to Route
            </h3>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Stop Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Kothrud Depo"
                value={stopData.stopName}
                onChange={(e) =>
                  setStopData({ ...stopData, stopName: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Stop Order Sequence *
                </label>
                <input
                  type="number"
                  required
                  value={stopData.stopOrder}
                  onChange={(e) =>
                    setStopData({
                      ...stopData,
                      stopOrder: parseInt(e.target.value),
                    })
                  }
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Est. Arrival Time *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 07:30"
                  value={stopData.estimatedArrivalTime}
                  onChange={(e) =>
                    setStopData({
                      ...stopData,
                      estimatedArrivalTime: e.target.value,
                    })
                  }
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Latitude
                </label>
                <input
                  type="text"
                  placeholder="e.g. 18.5204"
                  value={stopData.gpsLatitude}
                  onChange={(e) =>
                    setStopData({ ...stopData, gpsLatitude: e.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Longitude
                </label>
                <input
                  type="text"
                  placeholder="e.g. 73.8567"
                  value={stopData.gpsLongitude}
                  onChange={(e) =>
                    setStopData({ ...stopData, gpsLongitude: e.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowStopForm(false)}
                className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="bg-primary hover:bg-primary/95 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60 flex items-center gap-1"
              >
                {isPending && (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                )}
                Add Stop
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
