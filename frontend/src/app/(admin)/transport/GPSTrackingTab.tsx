"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  Bus,
  Navigation,
  MapPin,
  Activity,
  Gauge,
  Clock,
  Radio,
  Send,
  Loader2,
  CheckCircle,
} from "lucide-react";

// Dynamically import LiveMap with SSR disabled to prevent Leaflet window reference errors
const LiveMap = dynamic(() => import("./LiveMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[460px] w-full rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 text-sm">
      <Loader2 className="w-5 h-5 animate-spin mr-2 text-indigo-500" />
      Loading OpenStreetMap Leaflet Engine...
    </div>
  ),
});

type RouteStop = {
  id: string;
  stopName: string;
  stopOrder: number;
  gpsLatitude: string | null;
  gpsLongitude: string | null;
  estimatedArrivalTime?: string | null;
};

type Route = {
  id: string;
  routeName: string;
  vehicleId: string | null;
  vehicle?: {
    id: string;
    busNumber: string;
    registrationNumber: string;
  } | null;
  stops: RouteStop[];
};

export default function GPSTrackingTab({ routes }: { routes: Route[] }) {
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [livePosition, setLivePosition] = useState<{
    lat: number;
    lng: number;
    speed?: number;
  } | null>(null);
  const [lastPingTime, setLastPingTime] = useState<string | null>(null);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [isSendingTestPing, setIsSendingTestPing] = useState(false);

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

  // Poll live GPS ping from database every 6 seconds
  useEffect(() => {
    const vehicleId = selectedRoute?.vehicleId || selectedRoute?.vehicle?.id;
    if (!vehicleId) {
      setLivePosition(null);
      setIsLiveConnected(false);
      return;
    }

    let isSubscribed = true;

    async function fetchPing() {
      try {
        const res = await fetch(`/api/transport/live-ping?vehicleId=${vehicleId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.ping && isSubscribed) {
          setLivePosition({
            lat: data.ping.latitude,
            lng: data.ping.longitude,
            speed: data.ping.speed,
          });
          setLastPingTime(new Date(data.ping.recordedAt).toLocaleTimeString());
          setIsLiveConnected(true);
        } else if (isSubscribed && !livePosition) {
          // Default to first route stop if available
          const firstStop = sortedStops[0];
          if (firstStop?.gpsLatitude && firstStop?.gpsLongitude) {
            setLivePosition({
              lat: parseFloat(firstStop.gpsLatitude),
              lng: parseFloat(firstStop.gpsLongitude),
              speed: 0,
            });
          }
        }
      } catch (err) {
        console.error("Error polling live GPS ping:", err);
      }
    }

    fetchPing();
    const interval = setInterval(fetchPing, 6000);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [selectedRoute?.vehicleId, selectedRoute?.vehicle?.id, sortedStops]);

  // Handler to dispatch a simulated / test GPS ping
  const handleSendTestPing = async () => {
    const vehicleId = selectedRoute?.vehicleId || selectedRoute?.vehicle?.id;
    if (!vehicleId) {
      alert("No vehicle is assigned to this route yet.");
      return;
    }

    setIsSendingTestPing(true);
    try {
      // Pick next stop or slight variation
      const baseLat = sortedStops[0]?.gpsLatitude
        ? parseFloat(sortedStops[0].gpsLatitude)
        : 18.5204;
      const baseLng = sortedStops[0]?.gpsLongitude
        ? parseFloat(sortedStops[0].gpsLongitude)
        : 73.8567;

      const randomLat = baseLat + (Math.random() - 0.5) * 0.005;
      const randomLng = baseLng + (Math.random() - 0.5) * 0.005;
      const speed = Math.floor(25 + Math.random() * 20);

      const res = await fetch("/api/webhooks/gps-ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId,
          latitude: randomLat,
          longitude: randomLng,
          speed,
        }),
      });

      if (res.ok) {
        setLivePosition({ lat: randomLat, lng: randomLng, speed });
        setLastPingTime(new Date().toLocaleTimeString());
        setIsLiveConnected(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSendingTestPing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 border border-slate-800 text-white shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isLiveConnected
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isLiveConnected
                    ? "bg-emerald-400 animate-ping"
                    : "bg-amber-400"
                }`}
              />
              {isLiveConnected ? "GPS Signal Active" : "Waiting for Broadcast"}
            </span>
            <span className="text-xs text-slate-400">
              OpenStreetMap Real-World Tracking
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            Fleet GPS Operations & Telemetry
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedRouteId}
            onChange={(e) => setSelectedRouteId(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-800/90 text-white px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.routeName} {r.vehicle ? `(${r.vehicle.busNumber})` : ""}
              </option>
            ))}
          </select>

          <button
            onClick={handleSendTestPing}
            disabled={isSendingTestPing || !selectedRoute?.vehicleId}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
            title="Send test coordinates to verify map polling"
          >
            {isSendingTestPing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Send Test Ping
          </button>
        </div>
      </div>

      {/* Telemetry Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Assigned Bus
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Bus className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {selectedRoute?.vehicle?.busNumber || "Bus Unassigned"}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {selectedRoute?.vehicle?.registrationNumber || selectedRoute?.routeName}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Current Speed
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Gauge className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {livePosition?.speed != null ? `${livePosition.speed.toFixed(0)} km/h` : "0 km/h"}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            Real-time speed telemetry
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Last Ping
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {lastPingTime || "Never"}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            Auto-refreshing every 6s
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Route Stops
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {sortedStops.length} Stops
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            Configured on {selectedRoute?.routeName}
          </div>
        </div>
      </div>

      {/* Main Map + Stop Sequence Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stops Sequence Sidebar */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
              <Navigation className="w-4 h-4 text-indigo-500" />
              Route Stops & ETAs
            </h3>
            <span className="text-xs text-gray-400">
              {sortedStops.length} stops
            </span>
          </div>

          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {sortedStops.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">
                No stops configured for this route yet.
              </p>
            ) : (
              sortedStops.map((stop, i) => (
                <div
                  key={stop.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 text-xs"
                >
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">
                    {stop.stopOrder}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-white truncate">
                      {stop.stopName}
                    </div>
                    {stop.estimatedArrivalTime && (
                      <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                        ETA: {stop.estimatedArrivalTime}
                      </div>
                    )}
                  </div>
                  {stop.gpsLatitude && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                      📍 Geo-tagged
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Real Leaflet Map */}
        <div className="lg:col-span-2">
          <LiveMap
            stops={sortedStops}
            busPosition={livePosition}
            height="460px"
          />
        </div>
      </div>
    </div>
  );
}
