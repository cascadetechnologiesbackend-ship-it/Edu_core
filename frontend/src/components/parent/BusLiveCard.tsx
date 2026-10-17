"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Bus, Clock, MapPin, Gauge, ChevronDown, ChevronUp, ExternalLink, Navigation } from "lucide-react";
import { DerivedFeedCard } from "./FeedCard";

// Dynamically import Leaflet map with SSR disabled to prevent window reference errors
const BusLiveMap = dynamic(() => import("./BusLiveMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[180px] w-full rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
      <div className="w-5 h-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      <span>Connecting to bus GPS...</span>
    </div>
  ),
});

interface BusLiveCardProps {
  card: DerivedFeedCard;
  locale?: string;
}

// Micro-progress step definitions
const LIFECYCLE_STEPS = [
  { key: "SCHEDULED", labelEn: "Scheduled", labelHi: "निर्धारित" },
  { key: "EN_ROUTE", labelEn: "En route", labelHi: "रास्ते में" },
  { key: "APPROACHING", labelEn: "N stops away", labelHi: "नजदीक" },
  { key: "ARRIVED", labelEn: "Arrived", labelHi: "पहुँच गई" },
  { key: "DEPARTED", labelEn: "Departed", labelHi: "प्रस्थान" },
];

export function BusLiveCard({ card, locale = "en" }: BusLiveCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isHi = locale === "hi";

  const {
    routeName = "Route",
    stopName = "Your stop",
    stopsAway = 0,
    isApproaching = false,
    lifecycleState = "EN_ROUTE",
    etaMinutes = 10,
    estimatedArrival = "--:--",
    vehiclePing = null,
    stopCoords = null,
    routeStops = [],
    distanceMeters = 0,
  } = card.payload || {};

  const distanceKm = (distanceMeters / 1000).toFixed(1);
  const busSpeedKmh = Math.round(vehiclePing?.speed || 25);

  // Determine current active step index for micro-progress
  const getStepIndex = (state: string) => {
    switch (state) {
      case "SCHEDULED":
        return 0;
      case "EN_ROUTE":
        return 1;
      case "APPROACHING":
        return 2;
      case "ARRIVED":
        return 3;
      case "DEPARTED":
      case "COMPLETED":
        return 4;
      default:
        return 1;
    }
  };

  const activeStepIdx = getStepIndex(lifecycleState);

  // Collapsed Chip View (Zero-clutter convenience)
  if (isCollapsed) {
    return (
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/40 shadow-sm transition-all hover:border-emerald-500">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <Bus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
            {routeName}:{" "}
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              {lifecycleState === "ARRIVED"
                ? isHi ? "स्टॉप पर पहुँच गई!" : "Arrived at stop!"
                : stopsAway > 0
                ? isHi ? `${stopsAway} स्टॉप दूर (~${etaMinutes} मि)` : `${stopsAway} stops away (~${etaMinutes}m)`
                : isHi ? "रास्ते में है" : "En route"}
            </span>
          </div>
        </div>
        <button
          onClick={() => setIsCollapsed(false)}
          className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-emerald-600 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800"
        >
          <span>{isHi ? "विस्तार" : "Expand"}</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-emerald-500/50 bg-white dark:bg-slate-900 shadow-md p-4 sm:p-5 transition-all">
      {/* ── Top Header Strip ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <Bus className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {isHi ? card.title.hi : card.title.en}
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400" />
              <span>{routeName} &bull; {stopName}</span>
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsCollapsed(true)}
          title="Collapse to compact chip"
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      {/* ── Swiggy/Zepto Micro-Progress Lifecycle Bar ──────────────────────── */}
      <div className="my-3 px-1">
        <div className="relative flex items-center justify-between">
          <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-1 bg-slate-100 dark:bg-slate-800 -z-0" />
          <div
            className="absolute top-1/2 left-0 -translate-y-1/2 h-1 bg-emerald-500 transition-all duration-500 -z-0"
            style={{ width: `${(activeStepIdx / (LIFECYCLE_STEPS.length - 1)) * 100}%` }}
          />

          {LIFECYCLE_STEPS.map((step, idx) => {
            const isCompleted = idx < activeStepIdx;
            const isCurrent = idx === activeStepIdx;
            const stepLabel =
              step.key === "APPROACHING" && stopsAway > 0
                ? isHi ? `${stopsAway} स्टॉप दूर` : `${stopsAway} stops away`
                : isHi ? step.labelHi : step.labelEn;

            return (
              <div key={step.key} className="flex flex-col items-center relative z-10">
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center border-2 transition-all ${
                    isCurrent
                      ? "bg-emerald-500 border-white dark:border-slate-900 ring-2 ring-emerald-400 scale-110"
                      : isCompleted
                      ? "bg-emerald-600 border-emerald-600"
                      : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  }`}
                >
                  {isCompleted && (
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  )}
                </div>
                <span
                  className={`text-[9px] sm:text-[10px] mt-1 font-medium whitespace-nowrap ${
                    isCurrent
                      ? "text-emerald-700 dark:text-emerald-300 font-bold"
                      : isCompleted
                      ? "text-slate-600 dark:text-slate-400"
                      : "text-slate-400 dark:text-slate-600"
                  }`}
                >
                  {stepLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Leaflet Mini-Map ──────────────────────────────────────────────── */}
      <div className="my-3">
        <BusLiveMap
          busPosition={vehiclePing ? { lat: vehiclePing.lat, lng: vehiclePing.lng, speed: vehiclePing.speed } : null}
          studentStop={stopCoords ? { lat: stopCoords.lat, lng: stopCoords.lng, name: stopName } : null}
          routeStops={routeStops}
          height="180px"
          zoom={14}
          interactive={false}
        />
      </div>

      {/* ── Live Stats Strip ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-center">
        <div>
          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
            <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>{isHi ? "पहुँच समय" : "Est. Arrival"}</span>
          </div>
          <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">
            {estimatedArrival}
          </div>
        </div>

        <div className="border-x border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
            <Gauge className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>{isHi ? "बस गति" : "Speed"}</span>
          </div>
          <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">
            {busSpeedKmh} km/h
          </div>
        </div>

        <div>
          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
            <Navigation className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>{isHi ? "दूरी" : "Distance"}</span>
          </div>
          <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">
            {distanceKm} km
          </div>
        </div>
      </div>

      {/* ── Card Action Strip ─────────────────────────────────────────────── */}
      <div className="mt-3.5 flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1 flex-1">
          {isHi ? card.summary.hi : card.summary.en}
        </p>

        <Link
          href="/parent/bus"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition-colors shrink-0"
        >
          <span>{isHi ? "पूरा मैप देखें" : "Full Map"}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
