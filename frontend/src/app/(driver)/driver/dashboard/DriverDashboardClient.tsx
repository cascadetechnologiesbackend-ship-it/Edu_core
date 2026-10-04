"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Bus,
  Navigation,
  MapPin,
  Play,
  Square,
  Radio,
  Gauge,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldCheck,
  Loader2,
} from "lucide-react";

const LiveMap = dynamic(() => import("@/app/(admin)/transport/LiveMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[280px] w-full rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 text-xs">
      <Loader2 className="w-4 h-4 animate-spin mr-2 text-indigo-400" />
      Loading Route Map...
    </div>
  ),
});

interface DriverDashboardClientProps {
  driver: {
    id: string;
    name: string;
    licence: string;
    mobile: string;
  };
  vehicle: {
    id: string;
    busNumber: string;
    registrationNumber: string;
    capacity?: number;
  } | null;
  route: {
    id: string;
    routeName: string;
  } | null;
  stops: Array<{
    id: string;
    stopName: string;
    stopOrder: number;
    gpsLatitude?: string | null;
    gpsLongitude?: string | null;
    estimatedArrivalTime?: string | null;
  }>;
}

export default function DriverDashboardClient({
  driver,
  vehicle,
  route,
  stops,
}: DriverDashboardClientProps) {
  const [isTripActive, setIsTripActive] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{
    lat: number;
    lng: number;
    speed?: number;
  } | null>(null);
  const [pingsSent, setPingsSent] = useState(0);
  const [lastPingTime, setLastPingTime] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [completedStops, setCompletedStops] = useState<Set<string>>(new Set());

  const watchIdRef = useRef<number | null>(null);
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize bus position near first stop
  useEffect(() => {
    const firstStop = stops[0];
    if (firstStop?.gpsLatitude && firstStop?.gpsLongitude) {
      setCurrentCoords({
        lat: parseFloat(firstStop.gpsLatitude),
        lng: parseFloat(firstStop.gpsLongitude),
        speed: 0,
      });
    }
  }, [stops]);

  // Dispatch ping to server
  const sendPingToServer = async (lat: number, lng: number, speed: number) => {
    if (!vehicle?.id) return;
    try {
      await fetch("/api/webhooks/gps-ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: vehicle.id,
          latitude: lat,
          longitude: lng,
          speed,
        }),
      });
      setPingsSent((p) => p + 1);
      setLastPingTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Failed to send GPS ping:", err);
    }
  };

  // Start Trip & GPS Watcher
  const handleStartTrip = () => {
    if (!vehicle?.id) {
      alert("No vehicle assigned. Cannot broadcast GPS without vehicle ID.");
      return;
    }

    setIsTripActive(true);
    setGeoError(null);

    if ("geolocation" in navigator) {
      try {
        const id = navigator.geolocation.watchPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const speed = pos.coords.speed ? pos.coords.speed * 3.6 : 0; // m/s to km/h

            setCurrentCoords({ lat, lng, speed });
            sendPingToServer(lat, lng, speed);
          },
          (err) => {
            console.warn("Geolocation watch error, activating fallback simulator:", err.message);
            setGeoError("Using device simulation (GPS permission denied or unavailable).");
            startFallbackSimulation();
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
        );
        watchIdRef.current = id;
      } catch {
        startFallbackSimulation();
      }
    } else {
      startFallbackSimulation();
    }
  };

  // Fallback simulation for testing / desktop devices
  const startFallbackSimulation = () => {
    if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);

    let stopIdx = 0;
    simulationIntervalRef.current = setInterval(() => {
      const targetStop = stops[stopIdx % Math.max(1, stops.length)];
      const baseLat = targetStop?.gpsLatitude ? parseFloat(targetStop.gpsLatitude) : 18.5204;
      const baseLng = targetStop?.gpsLongitude ? parseFloat(targetStop.gpsLongitude) : 73.8567;

      const lat = baseLat + (Math.random() - 0.5) * 0.003;
      const lng = baseLng + (Math.random() - 0.5) * 0.003;
      const speed = Math.floor(25 + Math.random() * 20);

      setCurrentCoords({ lat, lng, speed });
      sendPingToServer(lat, lng, speed);

      stopIdx++;
    }, 8000);
  };

  // Stop Trip
  const handleStopTrip = () => {
    setIsTripActive(false);
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
  };

  // Toggle stop passed status
  const toggleStopPassed = (stopId: string) => {
    const next = new Set(completedStops);
    if (next.has(stopId)) next.delete(stopId);
    else next.add(stopId);
    setCompletedStops(next);
  };

  return (
    <div className="space-y-4">
      {/* ─── 1. Vehicle & Route Hero Card ────────────────────────────────────── */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/60 to-slate-900 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  isTripActive
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-slate-800 text-slate-400 border border-slate-700"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isTripActive ? "bg-emerald-400 animate-ping" : "bg-slate-500"
                  }`}
                />
                {isTripActive ? "TRIP IN PROGRESS" : "TRIP IDLE"}
              </span>
              <span className="text-xs text-slate-400">
                Licence: {driver.licence}
              </span>
            </div>

            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Bus className="w-6 h-6 text-amber-400" />
              {vehicle ? vehicle.busNumber : "No Bus Assigned"}
            </h1>
            <p className="text-xs text-indigo-300 font-medium mt-0.5">
              Route: {route ? route.routeName : "Default Transit Route"}
              {vehicle?.registrationNumber && ` • Reg: ${vehicle.registrationNumber}`}
            </p>
          </div>

          {/* Telemetry pill */}
          <div className="text-right">
            <div className="text-2xl font-black text-emerald-400 font-mono">
              {currentCoords?.speed != null ? Math.round(currentCoords.speed) : 0}
              <span className="text-xs font-sans text-slate-400 font-normal ml-1">
                km/h
              </span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Live Speed</div>
          </div>
        </div>

        {geoError && (
          <div className="mt-3 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{geoError}</span>
          </div>
        )}
      </div>

      {/* ─── 2. Real Mini Leaflet Map ────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-md">
        <LiveMap
          stops={stops}
          busPosition={currentCoords}
          height="280px"
          zoom={14}
        />
      </div>

      {/* ─── 3. Telemetry Mini Badges ────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            Pings Broadcast
          </div>
          <div className="text-lg font-bold text-white font-mono mt-0.5">
            {pingsSent}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            Last Ping
          </div>
          <div className="text-xs font-semibold text-indigo-400 mt-1 truncate">
            {lastPingTime || "Not started"}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            Stops Cleared
          </div>
          <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
            {completedStops.size} / {stops.length}
          </div>
        </div>
      </div>

      {/* ─── 4. Route Stops Checklist ───────────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-indigo-400" />
            Scheduled Bus Stops
          </h2>
          <span className="text-[11px] text-slate-400">
            Tap stop to mark reached
          </span>
        </div>

        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {stops.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">
              No stops assigned for this bus yet.
            </p>
          ) : (
            stops.map((stop) => {
              const isDone = completedStops.has(stop.id);
              return (
                <button
                  key={stop.id}
                  type="button"
                  onClick={() => toggleStopPassed(stop.id)}
                  className={`w-full text-left flex items-center justify-between p-3 rounded-xl transition border ${
                    isDone
                      ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-300"
                      : "bg-slate-800/50 hover:bg-slate-800 border-slate-700/60 text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                        isDone
                          ? "bg-emerald-500 text-white"
                          : "bg-indigo-600/30 text-indigo-400 border border-indigo-500/40"
                      }`}
                    >
                      {isDone ? "✓" : stop.stopOrder}
                    </div>
                    <div>
                      <div className="text-xs font-semibold">{stop.stopName}</div>
                      {stop.estimatedArrivalTime && (
                        <div className="text-[10px] text-slate-400">
                          ETA: {stop.estimatedArrivalTime}
                        </div>
                      )}
                    </div>
                  </div>

                  {isDone ? (
                    <span className="text-[11px] font-bold text-emerald-400">
                      Reached
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500">
                      Pending
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ─── 5. BIG Primary CTA in Heatmap Thumb Comfort Zone ─────────────────── */}
      <div className="pt-2 sticky bottom-20 md:static z-20">
        {!isTripActive ? (
          <button
            type="button"
            onClick={handleStartTrip}
            className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] font-black text-white text-base tracking-wider transition-all shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-3 uppercase"
          >
            <Play className="w-6 h-6 fill-current" />
            Start Trip (Broadcast GPS)
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStopTrip}
            className="w-full py-4 px-6 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-[0.99] font-black text-white text-base tracking-wider transition-all shadow-xl shadow-rose-600/30 flex items-center justify-center gap-3 uppercase animate-pulse"
          >
            <Square className="w-6 h-6 fill-current" />
            End Trip (Stop GPS)
          </button>
        )}
      </div>
    </div>
  );
}
