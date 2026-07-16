"use client";

import { useState, useEffect } from "react";
import { submitGpsPing } from "./actions";
import { Play, Square, Bus, Navigation, MapPin } from "lucide-react";

type RouteStop = {
  id: string;
  stopName: string;
  stopOrder: number;
  gpsLatitude: string | null;
  gpsLongitude: string | null;
};

type Route = {
  id: string;
  routeName: string;
  vehicleId: string | null;
  stops: RouteStop[];
};

export default function GPSTrackingTab({ routes }: { routes: Route[] }) {
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [currentLat, setCurrentLat] = useState("18.5204");
  const [currentLng, setCurrentLng] = useState("73.8567");
  const [currentSpeed, setCurrentSpeed] = useState("0");
  const [statusMsg, setStatusMsg] = useState("Ready for simulation");

  const selectedRoute =
    routes.find((r) => r.id === selectedRouteId) || routes[0];
  const sortedStops = selectedRoute
    ? [...selectedRoute.stops].sort((a, b) => a.stopOrder - b.stopOrder)
    : [];

  useEffect(() => {
    if (routes.length > 0 && !selectedRouteId) {
      setSelectedRouteId(routes[0]?.id || "");
    }
  }, [routes, selectedRouteId]);

  // Visual Coordinates Helper for SVG mapping
  // Map lat/long to X/Y inside a 400x300 canvas
  const getCoordinates = (latStr: string | null, lngStr: string | null) => {
    const lat = parseFloat(latStr || "18.5204");
    const lng = parseFloat(lngStr || "73.8567");

    // Center point (approx Pune region Wakad)
    const centerLat = 18.6;
    const centerLng = 73.77;

    // Scale factors
    const scaleX = 4000;
    const scaleY = 4000;

    const x = 200 + (lng - centerLng) * scaleX;
    const y = 150 - (lat - centerLat) * scaleY;

    // Boundary constraints
    return {
      x: Math.max(20, Math.min(380, x)),
      y: Math.max(20, Math.min(280, y)),
    };
  };

  const handleSimulate = async () => {
    if (!selectedRoute || sortedStops.length === 0) return;
    setIsSimulating(true);
    setStatusMsg("Starting Route Simulation...");

    const vehicleId =
      selectedRoute.vehicleId || "00000000-0000-0000-0000-000000000000";

    for (let i = 0; i < sortedStops.length; i++) {
      const stop = sortedStops[i];
      if (!stop) continue;

      setCurrentStopIndex(i);
      const lat = stop.gpsLatitude || "18.6";
      const lng = stop.gpsLongitude || "73.77";

      setCurrentLat(lat);
      setCurrentLng(lng);
      setCurrentSpeed((30 + Math.floor(Math.random() * 20)).toString());
      setStatusMsg(`Bus reached Stop ${stop.stopOrder}: ${stop.stopName}`);

      // Call database server action to insert GPS ping
      try {
        await submitGpsPing({
          vehicleId,
          latitude: lat,
          longitude: lng,
          speed: (30 + Math.floor(Math.random() * 20)).toString(),
        });
      } catch (e) {
        console.error("Failed to insert mock GPS ping", e);
      }

      // Pause for visual step in the loop
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    setIsSimulating(false);
    setStatusMsg("Trip simulation completed! Bus reached destination.");
    setCurrentSpeed("0");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">
          Live GPS Tracker & Simulator
        </h2>
        <div className="flex gap-2">
          <select
            value={selectedRouteId}
            onChange={(e) => {
              setSelectedRouteId(e.target.value);
              setCurrentStopIndex(0);
            }}
            disabled={isSimulating}
            className="rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.routeName}
              </option>
            ))}
          </select>

          <button
            onClick={handleSimulate}
            disabled={isSimulating || sortedStops.length === 0}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60"
          >
            {isSimulating ? (
              <>
                <Square className="w-4 h-4" /> Simulating...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Simulate live trip
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Panel */}
        <div className="bg-white dark:bg-slate-900 shadow border border-gray-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider">
            Simulation Details
          </h3>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500">Trip Status</p>
              <p className="text-sm font-semibold text-gray-950 dark:text-white">
                {statusMsg}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Latitude</p>
                <p className="text-sm font-mono font-semibold text-gray-950 dark:text-white">
                  {currentLat}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Longitude</p>
                <p className="text-sm font-mono font-semibold text-gray-950 dark:text-white">
                  {currentLng}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Speed</p>
                <p className="text-sm font-semibold text-primary">
                  {currentSpeed} km/h
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Active Vehicle</p>
                <p className="text-xs text-gray-400">
                  {selectedRoute?.vehicleId
                    ? "BUS-01 (Registered)"
                    : "Unassigned"}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 dark:border-slate-800 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase">
              Route Progress
            </p>
            <div className="space-y-1">
              {sortedStops.map((stop, i) => (
                <div
                  key={stop.id}
                  className={`flex justify-between items-center text-xs p-1.5 rounded transition ${
                    i === currentStopIndex && isSimulating
                      ? "bg-primary/10 text-primary font-bold"
                      : "text-gray-600 dark:text-gray-400"
                  }`}
                >
                  <span>
                    {stop.stopOrder}. {stop.stopName}
                  </span>
                  {i < currentStopIndex && (
                    <span className="text-green-500 font-semibold">Passed</span>
                  )}
                  {i === currentStopIndex && isSimulating && (
                    <span className="animate-pulse">Active</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Map Panel */}
        <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-xl relative overflow-hidden h-[400px]">
          {/* Custom Grid Map Gridlines */}
          <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]" />

          {/* SVG Map Layout */}
          <svg
            className="absolute inset-0 w-full h-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Draw Path between stops */}
            {sortedStops.length > 1 && (
              <path
                d={sortedStops
                  .map((stop, i) => {
                    const coords = getCoordinates(
                      stop.gpsLatitude,
                      stop.gpsLongitude,
                    );
                    return `${i === 0 ? "M" : "L"} ${coords.x} ${coords.y}`;
                  })
                  .join(" ")}
                fill="none"
                stroke="#6366f1"
                strokeWidth="4"
                strokeDasharray="4 4"
                className="opacity-75"
              />
            )}

            {/* School location representation */}
            <circle
              cx="200"
              cy="150"
              r="10"
              fill="#ef4444"
              className="animate-ping opacity-30"
            />
            <circle cx="200" cy="150" r="6" fill="#ef4444" />
            <text
              x="200"
              y="135"
              fill="#ef4444"
              fontSize="10"
              fontWeight="bold"
              textAnchor="middle"
            >
              SCHOOL
            </text>

            {/* Route Stops */}
            {sortedStops.map((stop) => {
              const coords = getCoordinates(
                stop.gpsLatitude,
                stop.gpsLongitude,
              );
              return (
                <g key={stop.id}>
                  <circle cx={coords.x} cy={coords.y} r="5" fill="#6366f1" />
                  <text
                    x={coords.x}
                    y={coords.y - 8}
                    fill="#a5b4fc"
                    fontSize="9"
                    textAnchor="middle"
                    className="font-semibold"
                  >
                    {stop.stopName}
                  </text>
                </g>
              );
            })}

            {/* Simulated Live Bus Indicator */}
            {sortedStops.length > 0 && (
              <g
                transform={`translate(${getCoordinates(currentLat, currentLng).x - 12}, ${
                  getCoordinates(currentLat, currentLng).y - 12
                })`}
              >
                <circle
                  cx="12"
                  cy="12"
                  r="16"
                  fill="#3b82f6"
                  className="animate-ping opacity-25"
                />
                <rect
                  x="2"
                  y="2"
                  width="20"
                  height="20"
                  rx="4"
                  fill="#3b82f6"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                <foreignObject x="4" y="4" width="16" height="16">
                  <div className="w-full h-full flex items-center justify-center text-white">
                    <Bus className="w-3.5 h-3.5" />
                  </div>
                </foreignObject>
              </g>
            )}
          </svg>

          {/* Controls overlay */}
          <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur border border-slate-800 text-[10px] text-gray-400 p-2.5 rounded-lg space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span>Red Dot = School Campus</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span>Blue Line = Bus Stop Route</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-blue-500" />
              <span>Blue Box = Active Vehicle</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
