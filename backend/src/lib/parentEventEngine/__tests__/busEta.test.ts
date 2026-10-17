import { describe, it, expect } from "vitest";
import {
  haversineDistance,
  isInsideCommuteWindow,
  findNearestStop,
  calculateEtaMinutes,
  computeBusTracking,
} from "../busEta";
import { RouteStopSnapshot, GpsPingSnapshot } from "../types";

describe("Parent Event Engine: Bus ETA & Tracking", () => {
  // Test stop coordinates along a realistic route (e.g. South Delhi / Ring Road)
  const sampleStops: RouteStopSnapshot[] = [
    { id: "stop-1", stopOrder: 1, lat: 28.5355, lng: 77.209, name: "Saket Metro", estimatedTime: "07:15" },
    { id: "stop-2", stopOrder: 2, lat: 28.5494, lng: 77.2185, name: "Malviya Nagar", estimatedTime: "07:22" },
    { id: "stop-3", stopOrder: 3, lat: 28.5677, lng: 77.2433, name: "Moolchand", estimatedTime: "07:35" },
    { id: "stop-4", stopOrder: 4, lat: 28.5901, lng: 77.2269, name: "Lodhi Road", estimatedTime: "07:48" },
    { id: "stop-5", stopOrder: 5, lat: 28.6139, lng: 77.209, name: "School Terminal", estimatedTime: "08:00" },
  ];

  describe("haversineDistance", () => {
    it("calculates exact zero for identical coordinates", () => {
      const dist = haversineDistance(28.5355, 77.209, 28.5355, 77.209);
      expect(dist).toBe(0);
    });

    it("calculates realistic distance between Saket and Malviya Nagar (~1.8km)", () => {
      const dist = haversineDistance(28.5355, 77.209, 28.5494, 77.2185);
      // Roughly 1.8km (1800m +/- 300m)
      expect(dist).toBeGreaterThan(1500);
      expect(dist).toBeLessThan(2200);
    });
  });

  describe("isInsideCommuteWindow", () => {
    it("returns true on a Wednesday morning at 07:15 (inside 06:30-08:30)", () => {
      const wedMorning = new Date("2026-10-14T07:15:00");
      expect(isInsideCommuteWindow(wedMorning)).toBe(true);
    });

    it("returns true on a Tuesday afternoon at 15:30 (inside 14:00-17:30)", () => {
      const tueAfternoon = new Date("2026-10-13T15:30:00");
      expect(isInsideCommuteWindow(tueAfternoon)).toBe(true);
    });

    it("returns false on a weekday midday at 11:30", () => {
      const weekdayMidday = new Date("2026-10-15T11:30:00");
      expect(isInsideCommuteWindow(weekdayMidday)).toBe(false);
    });

    it("returns false on a weekday night at 21:00", () => {
      const weekdayNight = new Date("2026-10-15T21:00:00");
      expect(isInsideCommuteWindow(weekdayNight)).toBe(false);
    });

    it("returns false on Sunday during morning hours (AC-P3: no commute tracking on weekends)", () => {
      const sundayMorning = new Date("2026-10-18T07:30:00");
      expect(isInsideCommuteWindow(sundayMorning)).toBe(false);
    });
  });

  describe("findNearestStop", () => {
    it("identifies Malviya Nagar stop when bus is near its coordinates", () => {
      const result = findNearestStop(28.55, 77.219, sampleStops);
      expect(result).not.toBeNull();
      expect(result?.stop.id).toBe("stop-2");
      expect(result?.distanceMeters).toBeLessThan(200);
    });
  });

  describe("calculateEtaMinutes", () => {
    it("computes reasonable ETA in minutes with 2 stops remaining", () => {
      const eta = calculateEtaMinutes(3500, 30, 2, 60);
      // 3.5km at 30km/h = 7 mins transit + 2 mins dwell = ~9 mins
      expect(eta).toBeGreaterThanOrEqual(8);
      expect(eta).toBeLessThanOrEqual(11);
    });
  });

  describe("computeBusTracking lifecycle states", () => {
    it("returns SCHEDULED when no GPS ping is provided", () => {
      const result = computeBusTracking(null, sampleStops, "stop-3");
      expect(result.lifecycleState).toBe("SCHEDULED");
      expect(result.stopsAway).toBe(2);
      expect(result.isApproaching).toBe(false);
    });

    it("returns EN_ROUTE when bus is at Stop 1 and student stop is Stop 4 (> 2 stops away)", () => {
      const ping: GpsPingSnapshot = {
        lat: 28.5355,
        lng: 77.209,
        speed: 35,
        recordedAt: new Date().toISOString(),
      };
      const result = computeBusTracking(ping, sampleStops, "stop-4");
      expect(result.lifecycleState).toBe("EN_ROUTE");
      expect(result.stopsAway).toBe(3);
      expect(result.isApproaching).toBe(false);
      expect(result.hasPassed).toBe(false);
    });

    it("returns APPROACHING when bus is 2 stops away from student stop", () => {
      const ping: GpsPingSnapshot = {
        lat: 28.5494,
        lng: 77.2185, // At Stop 2 (Malviya Nagar)
        speed: 28,
        recordedAt: new Date().toISOString(),
      };
      // Student is at Stop 4 (Lodhi Road)
      const result = computeBusTracking(ping, sampleStops, "stop-4");
      expect(result.lifecycleState).toBe("APPROACHING");
      expect(result.stopsAway).toBe(2);
      expect(result.isApproaching).toBe(true);
      expect(result.summaryText.en).toContain("2 stops away");
    });

    it("returns ARRIVED when bus is within 100m of student stop", () => {
      const ping: GpsPingSnapshot = {
        lat: 28.5678,
        lng: 77.2432, // Right at Stop 3 (Moolchand)
        speed: 0,
        recordedAt: new Date().toISOString(),
      };
      const result = computeBusTracking(ping, sampleStops, "stop-3");
      expect(result.lifecycleState).toBe("ARRIVED");
      expect(result.stopsAway).toBe(0);
      expect(result.isApproaching).toBe(true);
      expect(result.summaryText.en).toContain("arrived at Moolchand");
    });

    it("returns DEPARTED when bus has progressed past the student stop", () => {
      const ping: GpsPingSnapshot = {
        lat: 28.5901,
        lng: 77.2269, // At Stop 4
        speed: 30,
        recordedAt: new Date().toISOString(),
      };
      // Student stop was Stop 2 (already passed)
      const result = computeBusTracking(ping, sampleStops, "stop-2");
      expect(result.lifecycleState).toBe("DEPARTED");
      expect(result.hasPassed).toBe(true);
      expect(result.stopsAway).toBe(0);
      expect(result.summaryText.en).toContain("departed");
    });
  });
});
