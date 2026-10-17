"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bus,
  Clock,
  MapPin,
  Gauge,
  Navigation,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Phone,
  RefreshCw,
} from "lucide-react";

// Dynamically import Leaflet map with SSR disabled
const BusLiveMap = dynamic(() => import("@/components/parent/BusLiveMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] w-full rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-slate-500 text-sm gap-3">
      <div className="w-7 h-7 rounded-full border-3 border-emerald-500 border-t-transparent animate-spin" />
      <span>Loading OpenStreetMap Live Tracking Engine...</span>
    </div>
  ),
});

export default function ParentBusPage() {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Fetch parent students list or use active student
  const { data: busData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["parent-bus-tracking", selectedStudentId],
    queryFn: async () => {
      // First get studentId from feed context if not set
      let studentId = selectedStudentId;
      if (!studentId) {
        const studentRes = await fetch("/api/parent/feed");
        if (studentRes.ok) {
          const studentJson = await studentRes.json();
          // Fallback or use studentId if provided
        }
      }

      // Fetch bus tracking endpoint
      const res = await fetch(`/api/parent/bus${studentId ? `?studentId=${studentId}` : ""}`);
      if (!res.ok) {
        throw new Error("Failed to load bus data");
      }
      return res.json();
    },
    // Poll every 60s (Tier 1 poll) if inside commute window
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.isCommuteWindow ? 60000 : false;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 flex flex-col items-center justify-center text-slate-500">
        <div className="w-8 h-8 rounded-full border-3 border-emerald-500 border-t-transparent animate-spin mb-3" />
        <p className="text-sm font-medium">Loading transport schedule...</p>
      </div>
    );
  }

  const {
    hasBusPass,
    isCommuteWindow,
    designatedStop,
    route,
    vehicle,
    stops = [],
    tracking,
    latestPing,
  } = busData || {};

  // Case 1: Student has no active bus pass
  if (!hasBusPass) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <Link
            href="/parent/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Today</span>
          </Link>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
              <Bus className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              No Active School Bus Pass
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Your child is not currently registered on a school bus route. To request transport service, please contact the school administration.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Case 2: Outside commute window -> Strictly show Schedule View, NEVER a live map (AC-P3)
  if (!isCommuteWindow) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 pb-24">
        <div className="max-w-3xl mx-auto space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Link
              href="/parent/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Today</span>
            </Link>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Schedule View</span>
            </span>
          </div>

          {/* Calm Notice Banner (AC-P3) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/80 flex items-center justify-center text-blue-700 dark:text-blue-300 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-blue-950 dark:text-blue-200">
                Live GPS Tracking is Off-Duty
              </h3>
              <p className="text-xs text-blue-800/80 dark:text-blue-300/80 mt-1 leading-relaxed">
                Live vehicle tracking automatically activates on the home feed and map during morning (06:30 - 08:30 AM) and afternoon (02:00 - 05:30 PM) commute hours on school days. Below is your official route timetable.
              </p>
            </div>
          </div>

          {/* Child Designated Stop Spotlight */}
          {designatedStop && (
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-blue-500/30 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider text-blue-600 dark:text-blue-400 uppercase">
                  Your Child&apos;s Designated Stop
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  Stop #{designatedStop.stopOrder}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {designatedStop.name}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {route?.name || "School Bus Route"} ({vehicle?.busNumber || "Bus"})
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Scheduled Time</div>
                  <div className="text-base font-bold text-blue-600 dark:text-blue-400">
                    {designatedStop.scheduledTime || "07:30 AM"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Full Route Stops Schedule */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Complete Route Schedule
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {stops.length} stops along {route?.name || "Route"}
                </p>
              </div>
              <span className="text-xs text-slate-400">Mon &ndash; Fri</span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {stops.map((stop: any) => {
                const isDesignated = designatedStop?.id === stop.id;
                return (
                  <div
                    key={stop.id}
                    className={`p-3.5 sm:p-4 flex items-center justify-between transition-colors ${
                      isDesignated
                        ? "bg-blue-50/50 dark:bg-blue-950/30 font-semibold"
                        : "hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          isDesignated
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {stop.stopOrder}
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                          <span>{stop.name}</span>
                          {isDesignated && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                              Your Stop
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                      {stop.estimatedTime || "--:--"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Case 3: Inside Commute Window -> Full Interactive Live Map & Tracking
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 pb-24">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Top Navigation Strip */}
        <div className="flex items-center justify-between">
          <Link
            href="/parent/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Today</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              title="Refresh GPS"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin text-emerald-500" : ""}`} />
            </button>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              LIVE COMMUTE GPS
            </span>
          </div>
        </div>

        {/* Live Map Box */}
        <div className="shadow-lg rounded-2xl overflow-hidden">
          <BusLiveMap
            busPosition={latestPing}
            studentStop={
              designatedStop
                ? {
                    lat: designatedStop.lat,
                    lng: designatedStop.lng,
                    name: designatedStop.name,
                  }
                : null
            }
            routeStops={stops}
            height="420px"
            zoom={14}
            interactive={true}
          />
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-3 gap-2.5 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Estimated Arrival</span>
            </div>
            <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {tracking?.estimatedArrivalFormatted || "In Transit"}
            </div>
          </div>

          <div className="border-x border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <Navigation className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Stops Away</span>
            </div>
            <div className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {tracking?.stopsAway !== undefined
                ? tracking.stopsAway === 0
                  ? "At Stop"
                  : `${tracking.stopsAway} stops`
                : "--"}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <Gauge className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Bus Speed</span>
            </div>
            <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {Math.round(latestPing?.speed || 25)} km/h
            </div>
          </div>
        </div>

        {/* Live Human Summary */}
        <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between gap-3">
          <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed font-medium">
            {tracking?.summaryText?.en || "School bus is in transit along route."}
          </p>
          <span className="text-[11px] text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
            Updated just now
          </span>
        </div>

        {/* Route Stops Checklist with live tracking progression */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Stop Progression ({route?.name || "Route"})
            </span>
            <span className="text-[11px] text-slate-500">{vehicle?.busNumber || "Bus"}</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {stops.map((stop: any) => {
              const isDesignated = designatedStop?.id === stop.id;
              const isNearest = tracking?.nearestStop?.id === stop.id;
              const hasPassed = tracking?.nearestStop
                ? stop.stopOrder < tracking.nearestStop.stopOrder
                : false;

              return (
                <div
                  key={stop.id}
                  className={`p-3 sm:p-3.5 flex items-center justify-between transition-colors ${
                    isDesignated
                      ? "bg-blue-50/40 dark:bg-blue-950/20"
                      : isNearest
                      ? "bg-emerald-50/40 dark:bg-emerald-950/20"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                        hasPassed
                          ? "bg-slate-200 dark:bg-slate-800 text-slate-500"
                          : isNearest
                          ? "bg-emerald-500 text-white ring-2 ring-emerald-300"
                          : isDesignated
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {hasPassed ? <CheckCircle2 className="w-3.5 h-3.5" /> : stop.stopOrder}
                    </div>

                    <div className="text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <span>{stop.name}</span>
                      {isDesignated && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                          Your Stop
                        </span>
                      )}
                      {isNearest && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                          Bus Current
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="text-[11px] font-mono text-slate-500">
                    {stop.estimatedTime || "--:--"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
