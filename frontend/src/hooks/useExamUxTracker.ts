"use client";

import { useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { KNOWN_UX_ELEMENTS, type KnownUxScreen, type UxEventPayload } from "@/lib/telemetryRegistry";

// In-memory telemetry buffer
let eventQueue: UxEventPayload[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

const BATCH_INTERVAL_MS = 2000;
const MAX_BATCH_SIZE = 25;

/**
 * Flushes buffered UX interaction events to /api/ux-events via navigator.sendBeacon
 * or keepalive fetch.
 */
export function flushUxEvents() {
  if (eventQueue.length === 0) return;

  const batch = eventQueue.splice(0, MAX_BATCH_SIZE);
  const payload = JSON.stringify({ events: batch });

  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    const success = navigator.sendBeacon("/api/ux-events", blob);
    if (!success) {
      // Fallback to keepalive fetch if sendBeacon fails (e.g. queue full)
      fetch("/api/ux-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } else if (typeof fetch !== "undefined") {
    fetch("/api/ux-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }
}

function scheduleFlush() {
  if (flushTimeout) return;
  flushTimeout = setTimeout(() => {
    flushTimeout = null;
    flushUxEvents();
  }, BATCH_INTERVAL_MS);
}

/**
 * Programmatic event tracker for non-click or synthetic actions (tab switches, filters).
 */
export function trackUxEvent(
  screen: string,
  elementId: string,
  elementLabel?: string,
  action: UxEventPayload["action"] = "click",
) {
  const label =
    elementLabel ||
    KNOWN_UX_ELEMENTS[screen as KnownUxScreen]?.[elementId] ||
    elementId;

  eventQueue.push({
    screen,
    elementId,
    elementLabel: label,
    action,
  });

  if (eventQueue.length >= MAX_BATCH_SIZE) {
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    flushUxEvents();
  } else {
    scheduleFlush();
  }
}

/**
 * Client-side hook for automatic declarative click capture on elements carrying `data-ux-id`.
 */
export function useExamUxTracker() {
  const pathname = usePathname();

  const handleGlobalClick = useCallback(
    (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest("[data-ux-id]");
      if (!target) return;

      const elementId = target.getAttribute("data-ux-id");
      if (!elementId) return;

      const screen = pathname || window.location.pathname;
      const elementLabel =
        target.getAttribute("data-ux-label") ||
        KNOWN_UX_ELEMENTS[screen as KnownUxScreen]?.[elementId] ||
        target.textContent?.trim().slice(0, 60) ||
        elementId;

      const action = (target.getAttribute("data-ux-action") || "click") as UxEventPayload["action"];

      trackUxEvent(screen, elementId, elementLabel, action);
    },
    [pathname],
  );

  useEffect(() => {
    document.addEventListener("click", handleGlobalClick, true);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushUxEvents();
      }
    };

    const handlePageHide = () => {
      flushUxEvents();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("click", handleGlobalClick, true);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      flushUxEvents();
    };
  }, [handleGlobalClick]);
}
