/**
 * Parent Event Engine: Bus ETA & Commute Window Engine (Spec v1.0)
 *
 * Pure, rule-based GPS calculations:
 * 1. Haversine distance between bus GPS coordinates and route stops.
 * 2. Nearest stop identification and stops-away derivation from stopOrder.
 * 3. Commute window evaluation (default 06:30-08:30 and 14:00-17:30 local, Mon-Fri).
 * 4. Micro-progress lifecycle state calculation:
 *    Scheduled -> En route -> N stops away -> Arrived at stop -> Departed -> Completed
 * 5. ETA projection from speed and stop dwell time.
 */

import { GpsPingSnapshot, RouteStopSnapshot } from "./types";

export type BusLifecycleState =
  | "SCHEDULED"
  | "EN_ROUTE"
  | "APPROACHING"
  | "ARRIVED"
  | "DEPARTED"
  | "COMPLETED";

export interface CommuteWindowOptions {
  morningStart?: string; // "06:30"
  morningEnd?: string;   // "08:30"
  eveningStart?: string; // "14:00"
  eveningEnd?: string;   // "17:30"
  allowWeekends?: boolean;
}

/**
 * Calculates great-circle distance between two geographic coordinates using Haversine formula.
 * Returns distance in meters.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Radius of Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Evaluates whether a given timestamp falls within the school's configured commute windows.
 * Default windows: Weekdays (Mon-Fri) 06:30-08:30 and 14:00-17:30 local time.
 */
export function isInsideCommuteWindow(
  date: Date,
  options: CommuteWindowOptions = {}
): boolean {
  const day = date.getDay(); // 0 = Sun, 6 = Sat
  if (!options.allowWeekends && (day === 0 || day === 6)) {
    return false;
  }

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const currentMinute = hours * 60 + minutes;

  const parseMinutes = (timeStr: string, fallbackMinutes: number) => {
    if (!timeStr) return fallbackMinutes;
    const parts = timeStr.split(":");
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    return Number.isNaN(h) || Number.isNaN(m) ? fallbackMinutes : h * 60 + m;
  };

  const morningStart = parseMinutes(options.morningStart || "06:30", 390); // 6*60+30 = 390
  const morningEnd = parseMinutes(options.morningEnd || "08:30", 510);     // 8*60+30 = 510
  const eveningStart = parseMinutes(options.eveningStart || "14:00", 840); // 14*60 = 840
  const eveningEnd = parseMinutes(options.eveningEnd || "17:30", 1050);    // 17*60+30 = 1050

  const isMorning = currentMinute >= morningStart && currentMinute <= morningEnd;
  const isEvening = currentMinute >= eveningStart && currentMinute <= eveningEnd;

  return isMorning || isEvening;
}

/**
 * Finds the closest stop along the route to the given coordinates.
 */
export function findNearestStop(
  currentLat: number,
  currentLon: number,
  stops: RouteStopSnapshot[]
): { stop: RouteStopSnapshot; distanceMeters: number; index: number } | null {
  if (!stops || stops.length === 0) return null;

  let closestStop: RouteStopSnapshot | null = null;
  let minDistance = Infinity;
  let closestIndex = -1;

  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    if (!s || s.lat == null || s.lng == null) continue;
    const dist = haversineDistance(currentLat, currentLon, s.lat, s.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestStop = s;
      closestIndex = i;
    }
  }

  return closestStop ? { stop: closestStop, distanceMeters: minDistance, index: closestIndex } : null;
}

/**
 * Computes ETA in minutes based on distance, estimated vehicle speed, remaining stops, and dwell time.
 */
export function calculateEtaMinutes(
  distanceMeters: number,
  currentSpeedKmh: number = 25,
  stopsRemaining: number = 0,
  stopDwellSeconds: number = 60
): number {
  // Clamp speed to realistic urban school bus transit (15 km/h to 60 km/h, default 25 km/h)
  const effectiveSpeedKmh = Math.max(15, Math.min(60, currentSpeedKmh > 0 ? currentSpeedKmh : 25));
  const speedMetersPerSecond = (effectiveSpeedKmh * 1000) / 3600;
  
  const transitSeconds = distanceMeters / speedMetersPerSecond;
  const dwellSeconds = Math.max(0, stopsRemaining) * stopDwellSeconds;
  const totalSeconds = transitSeconds + dwellSeconds;

  return Math.max(1, Math.round(totalSeconds / 60));
}

export interface BusTrackingResult {
  lifecycleState: BusLifecycleState;
  stopsAway: number;
  nearestStop: RouteStopSnapshot | null;
  studentStop: RouteStopSnapshot | null;
  distanceToStudentStopMeters: number;
  etaMinutes: number;
  estimatedArrivalFormatted: string;
  isApproaching: boolean;
  hasPassed: boolean;
  summaryText: {
    en: string;
    hi: string;
  };
}

/**
 * Derives real-time bus tracking status, stops away, lifecycle state, and ETA
 * for a student given latest GPS ping and sorted route stops.
 */
export function computeBusTracking(
  latestPing: GpsPingSnapshot | null,
  routeStops: RouteStopSnapshot[],
  studentStopId: string,
  now: Date = new Date()
): BusTrackingResult {
  // Sort route stops by stopOrder ascending
  const sortedStops = [...routeStops].sort((a, b) => a.stopOrder - b.stopOrder);
  const studentStop = sortedStops.find((s) => s.id === studentStopId) || sortedStops[0] || null;
  const studentStopOrder = studentStop?.stopOrder ?? 1;

  // Default when no ping or bus not running yet
  if (!latestPing || sortedStops.length === 0 || !studentStop) {
    const stopsAway = Math.max(0, studentStopOrder - 1);
    return {
      lifecycleState: "SCHEDULED",
      stopsAway,
      nearestStop: sortedStops[0] || null,
      studentStop,
      distanceToStudentStopMeters: 0,
      etaMinutes: 15,
      estimatedArrivalFormatted: studentStop?.estimatedTime || "--:--",
      isApproaching: false,
      hasPassed: false,
      summaryText: {
        en: `Scheduled pickup at ${studentStop?.name || "your stop"}.`,
        hi: `${studentStop?.name || "आपके स्टॉप"} पर निर्धारित पिकअप।`,
      },
    };
  }

  // Find nearest stop to current bus GPS location
  const nearestResult = findNearestStop(latestPing.lat, latestPing.lng, sortedStops);
  const fallbackStop = sortedStops[0];
  const lastStop = sortedStops[sortedStops.length - 1];
  if (!fallbackStop || !lastStop) {
    return {
      lifecycleState: "SCHEDULED",
      stopsAway: Math.max(0, studentStopOrder - 1),
      nearestStop: fallbackStop || null,
      studentStop,
      distanceToStudentStopMeters: 0,
      etaMinutes: 15,
      estimatedArrivalFormatted: studentStop?.estimatedTime || "--:--",
      isApproaching: false,
      hasPassed: false,
      summaryText: {
        en: `Scheduled pickup at ${studentStop?.name || "your stop"}.`,
        hi: `${studentStop?.name || "आपके स्टॉप"} पर निर्धारित पिकअप।`,
      },
    };
  }

  const nearestStop = nearestResult?.stop || fallbackStop;
  const distanceToNearestMeters = nearestResult?.distanceMeters || 0;
  const currentBusStopOrder = nearestStop.stopOrder;

  // Distance directly to student stop
  const distanceToStudentStopMeters = haversineDistance(
    latestPing.lat,
    latestPing.lng,
    studentStop.lat,
    studentStop.lng
  );

  // Check if bus has completed its full route
  const isTerminus = nearestStop.id === lastStop.id && distanceToNearestMeters < 150;

  // Determine state transitions
  let lifecycleState: BusLifecycleState = "EN_ROUTE";
  let stopsAway = Math.max(0, studentStopOrder - currentBusStopOrder);
  const hasPassed = currentBusStopOrder > studentStopOrder;

  if (isTerminus && hasPassed) {
    lifecycleState = "COMPLETED";
    stopsAway = 0;
  } else if (hasPassed) {
    lifecycleState = "DEPARTED";
    stopsAway = 0;
  } else if (currentBusStopOrder === studentStopOrder && distanceToStudentStopMeters <= 120) {
    // Bus is physically at student's stop
    lifecycleState = "ARRIVED";
    stopsAway = 0;
  } else if (stopsAway <= 2 && stopsAway > 0) {
    lifecycleState = "APPROACHING";
  } else if (stopsAway > 2) {
    lifecycleState = "EN_ROUTE";
  } else if (stopsAway === 0 && distanceToStudentStopMeters > 120) {
    // Very near the stop but hasn't fully arrived
    lifecycleState = "APPROACHING";
    stopsAway = 1;
  }

  const isApproaching = lifecycleState === "APPROACHING" || lifecycleState === "ARRIVED";

  // Calculate ETA
  const remainingStops = Math.max(0, studentStopOrder - currentBusStopOrder);
  const etaMinutes =
    lifecycleState === "ARRIVED"
      ? 0
      : lifecycleState === "DEPARTED" || lifecycleState === "COMPLETED"
      ? 0
      : calculateEtaMinutes(distanceToStudentStopMeters, latestPing.speed, remainingStops);

  // Formatted arrival time
  const arrivalDate = new Date(now.getTime() + etaMinutes * 60000);
  const hours = arrivalDate.getHours();
  const minutes = arrivalDate.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
  const estimatedArrivalFormatted =
    lifecycleState === "ARRIVED"
      ? "Arrived now"
      : lifecycleState === "DEPARTED"
      ? "Departed"
      : lifecycleState === "COMPLETED"
      ? "Trip completed"
      : `${displayHours}:${displayMinutes} ${ampm}`;

  // Formulate concise human microcopy
  let summaryEn = "";
  let summaryHi = "";

  switch (lifecycleState) {
    case "ARRIVED":
      summaryEn = `Bus has arrived at ${studentStop.name}. Please board promptly.`;
      summaryHi = `बस ${studentStop.name} पर पहुँच गई है। कृपया तुरंत सवार हों।`;
      break;
    case "APPROACHING":
      summaryEn = `Bus is ${stopsAway} stop${stopsAway > 1 ? "s" : ""} away from ${studentStop.name} (~${etaMinutes} min).`;
      summaryHi = `बस ${studentStop.name} से ${stopsAway} स्टॉप दूर है (लगभग ${etaMinutes} मिनट)।`;
      break;
    case "DEPARTED":
      summaryEn = `Bus departed ${studentStop.name} and is on route to next stops.`;
      summaryHi = `बस ${studentStop.name} से निकल चुकी है और अगले स्टॉप की ओर है।`;
      break;
    case "COMPLETED":
      summaryEn = `Bus route has concluded at final terminal.`;
      summaryHi = `बस मार्ग अंतिम पड़ाव पर समाप्त हो गया है।`;
      break;
    case "EN_ROUTE":
    default:
      summaryEn = `Bus is en route. Approaching ${nearestStop.name} (Stop ${currentBusStopOrder} of ${sortedStops.length}).`;
      summaryHi = `बस रास्ते में है। ${nearestStop.name} (स्टॉप ${currentBusStopOrder}/${sortedStops.length}) की ओर बढ़ रही है।`;
      break;
  }

  return {
    lifecycleState,
    stopsAway,
    nearestStop,
    studentStop,
    distanceToStudentStopMeters,
    etaMinutes,
    estimatedArrivalFormatted,
    isApproaching,
    hasPassed,
    summaryText: {
      en: summaryEn,
      hi: summaryHi,
    },
  };
}
