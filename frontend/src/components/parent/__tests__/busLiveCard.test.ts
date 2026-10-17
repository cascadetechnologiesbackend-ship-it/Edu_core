import { describe, it, expect } from "vitest";
import React from "react";
import {
  deriveParentFeed,
  isInsideCommuteWindow,
} from "../../../../../backend/src/lib/parentEventEngine/deriveParentFeed";
import {
  computeBusTracking,
  calculateEtaMinutes,
  haversineDistance,
} from "../../../../../backend/src/lib/parentEventEngine/busEta";
import { ParentDataSnapshot, RouteStopSnapshot } from "../../../../../backend/src/lib/parentEventEngine/types";
import { BusLiveCard } from "../BusLiveCard";

describe("Phase P5: BusLiveCard & Commute Window Engine (AC-P3)", () => {
  const studentId = "student-ward-1";
  const morningCommute = new Date("2026-10-14T07:30:00"); // Wednesday 7:30 AM
  const middayOutsideWindow = new Date("2026-10-14T12:00:00"); // Wednesday 12:00 PM
  const sundayMorning = new Date("2026-10-18T07:30:00"); // Sunday 7:30 AM

  const mockRouteStops: RouteStopSnapshot[] = [
    { id: "stop-1", stopOrder: 1, lat: 28.5355, lng: 77.209, name: "Saket Metro", estimatedTime: "07:15" },
    { id: "stop-2", stopOrder: 2, lat: 28.5494, lng: 77.2185, name: "Malviya Nagar", estimatedTime: "07:22" },
    { id: "stop-3", stopOrder: 3, lat: 28.5677, lng: 77.2433, name: "Moolchand", estimatedTime: "07:35" },
    { id: "stop-4", stopOrder: 4, lat: 28.5901, lng: 77.2269, name: "Lodhi Road", estimatedTime: "07:48" },
  ];

  it("AC-P3 Invariant: Renders BusLiveCard during weekday commute window with active bus pass", () => {
    expect(isInsideCommuteWindow(morningCommute)).toBe(true);

    const snapshot: ParentDataSnapshot = {
      busPass: {
        isActive: true,
        routeId: "route-blue",
        routeName: "Route 4 Blue",
        stopId: "stop-3",
        stopName: "Moolchand",
        stopOrder: 3,
        stopCoords: { lat: 28.5677, lng: 77.2433 },
      },
      routeStops: mockRouteStops,
      latestBusPing: {
        lat: 28.5494,
        lng: 77.2185, // Bus at Malviya Nagar (Stop 2) -> 1 stop away from Moolchand
        speed: 26,
        recordedAt: morningCommute.toISOString(),
      },
      isCommuteWindowOverride: true,
    };

    const feed = deriveParentFeed(studentId, morningCommute, snapshot);
    expect(feed).toHaveLength(1);

    const busCard = feed[0]!;
    expect(busCard.cardType).toBe("BusLiveCard");
    expect(busCard.priority).toBe(100); // Pinned to top during commute
    expect(busCard.payload.stopsAway).toBe(1);
    expect(busCard.payload.isApproaching).toBe(true);
    expect(busCard.tier).toBe("T1_action_required");
    expect(busCard.title.en).toContain("1 stop away");
  });

  it("AC-P3 Invariant: Strictly DOES NOT render BusLiveCard outside commute window", () => {
    expect(isInsideCommuteWindow(middayOutsideWindow)).toBe(false);

    const snapshot: ParentDataSnapshot = {
      busPass: {
        isActive: true,
        routeId: "route-blue",
        stopId: "stop-3",
        stopOrder: 3,
      },
      routeStops: mockRouteStops,
      isCommuteWindowOverride: false,
    };

    const feed = deriveParentFeed(studentId, middayOutsideWindow, snapshot);
    expect(feed).toHaveLength(0); // Zero cards -> Calm home feed!
  });

  it("AC-P3 Invariant: Strictly DOES NOT render on weekends even at commute hours", () => {
    expect(isInsideCommuteWindow(sundayMorning)).toBe(false);

    const snapshot: ParentDataSnapshot = {
      busPass: {
        isActive: true,
        routeId: "route-blue",
        stopId: "stop-3",
        stopOrder: 3,
      },
      isCommuteWindowOverride: false,
    };

    const feed = deriveParentFeed(studentId, sundayMorning, snapshot);
    expect(feed).toHaveLength(0);
  });

  it("AC-P3 Invariant: Strictly DOES NOT render if student has no active bus pass", () => {
    const snapshot: ParentDataSnapshot = {
      busPass: {
        isActive: false, // Inactive pass
        routeId: "route-blue",
        stopId: "stop-3",
        stopOrder: 3,
      },
      isCommuteWindowOverride: true,
    };

    const feed = deriveParentFeed(studentId, morningCommute, snapshot);
    expect(feed).toHaveLength(0);
  });

  it("Calculates realistic ETA minutes and Haversine distance", () => {
    const distanceMeters = haversineDistance(28.5494, 77.2185, 28.5677, 77.2433);
    expect(distanceMeters).toBeGreaterThan(2000); // ~2.8 km
    expect(distanceMeters).toBeLessThan(4000);

    const eta = calculateEtaMinutes(distanceMeters, 25, 1);
    expect(eta).toBeGreaterThanOrEqual(6);
    expect(eta).toBeLessThanOrEqual(12);
  });

  it("BusLiveCard component element initializes properly with tracking payload", () => {
    const card = {
      id: "bus-live-card-1",
      studentId: "student-1",
      cardType: "BusLiveCard" as const,
      tier: "T1_action_required" as const,
      priority: 100,
      title: { en: "School Bus is 2 stops away", hi: "स्कूल बस 2 स्टॉप दूर है" },
      summary: { en: "Bus approaching Moolchand", hi: "बस मूलचंद पहुँच रही है" },
      payload: {
        routeName: "Route 4 Blue",
        stopName: "Moolchand",
        stopsAway: 2,
        isApproaching: true,
        lifecycleState: "APPROACHING",
        etaMinutes: 8,
        estimatedArrival: "07:35 AM",
        vehiclePing: { lat: 28.5494, lng: 77.2185, speed: 28 },
        stopCoords: { lat: 28.5677, lng: 77.2433 },
        routeStops: mockRouteStops,
        distanceMeters: 2800,
      },
      activatedAt: morningCommute,
      expiresAt: new Date(morningCommute.getTime() + 7200000),
    };

    const element = React.createElement(BusLiveCard, { card, locale: "en" });
    expect(element).toBeDefined();
    expect(element.props.card.id).toBe("bus-live-card-1");
    expect(element.props.card.payload.stopsAway).toBe(2);
  });
});
